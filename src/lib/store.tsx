import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Entry, Issue, SectionId, SectionDataMap, Settings } from './types'
import * as db from './db'
import { computeAll, type ByDate, type DayCalc } from './calc'
import { groupByDate, seedToEntries, type SeedFile } from './seed'
import { today, addDays } from './dates'
import { syncNow, type SyncResult } from './sync'

interface Store {
  ready: boolean
  entries: Entry[]
  byDate: ByDate
  calc: Record<string, DayCalc>
  issues: Issue[]
  settings: Settings
  user: string
  setUser: (n: string) => void
  saveSection: <S extends SectionId>(date: string, section: S, data: SectionDataMap[S]) => Promise<void>
  removeSection: (date: string, section: SectionId) => Promise<void>
  saveIssue: (i: Issue) => Promise<void>
  removeIssue: (id: string) => Promise<void>
  updateSettings: (s: Settings) => Promise<void>
  importSeed: () => Promise<number>
  restore: (j: { entries: Entry[]; issues: Issue[]; settings?: Settings }) => Promise<void>
  wipe: () => Promise<void>
  pending: number
  sync: () => Promise<SyncResult>
  lastSync: number | null
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => { const s = useContext(Ctx); if (!s) throw new Error('no store'); return s }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [settings, setSettings] = useState<Settings>(db.mergeSettings())
  const [user, setUserS] = useState(() => localStorage.getItem('chip-dept-user') ?? '')
  const [pending, setPending] = useState(0)
  const [lastSync, setLastSync] = useState<number | null>(null)

  const reload = useCallback(async () => {
    const [e, i, s, o, ls] = await Promise.all([db.allEntries(), db.allIssues(), db.getSettings(), db.outbox(), db.getKV<number>('lastSync')])
    setEntries(e); setIssues(i); setSettings(s); setPending(o.length); setLastSync(ls ?? null)
  }, [])
  useEffect(() => { reload().then(() => setReady(true)) }, [reload])

  const byDate = useMemo(() => groupByDate(entries), [entries])
  const calc = useMemo(() => {
    const last = entries.reduce((m, e) => (e.date > m ? e.date : m), today())
    return computeAll(byDate, settings, addDays(last, 1))
  }, [byDate, settings, entries])

  // ส่ง/รับอัตโนมัติเมื่อตั้งลิงก์ Google Sheet แล้ว: ตอนเปิดแอป ทุก 5 นาที ตอนกลับมาออนไลน์ และหลังบันทึก
  const syncUrl = settings.syncUrl
  const autoSync = useCallback(async () => {
    if (!syncUrl || !navigator.onLine) return
    const r = await syncNow(syncUrl)
    if (!r.error) await reload()
  }, [syncUrl, reload])
  useEffect(() => {
    if (!syncUrl) return
    autoSync()
    const t = setInterval(autoSync, 5 * 60 * 1000)
    window.addEventListener('online', autoSync)
    return () => { clearInterval(t); window.removeEventListener('online', autoSync) }
  }, [syncUrl, autoSync])

  const setUser = (n: string) => { localStorage.setItem('chip-dept-user', n); setUserS(n) }

  const store: Store = {
    ready, entries, byDate, calc, issues, settings, user, setUser, pending, lastSync,
    saveSection: async (date, section, data) => {
      const e: Entry = { id: `${date}|${section}`, date, section, data: data as never, by: user || 'ไม่ระบุชื่อ', updatedAt: Date.now(), device: db.deviceId() }
      await db.putEntry(e)
      await reload()
      void autoSync()
    },
    removeSection: async (date, section) => { await db.deleteEntry(`${date}|${section}`); await reload() },
    saveIssue: async (i) => { await db.putIssue({ ...i, updatedAt: Date.now() }); await reload(); void autoSync() },
    removeIssue: async (id) => { await db.deleteIssue(id); await reload() },
    updateSettings: async (s) => { await db.saveSettings(s, true); await reload() },
    importSeed: async () => {
      const res = await fetch(import.meta.env.BASE_URL + 'seed-2569-11.json')
      const seed = (await res.json()) as SeedFile
      const list = seedToEntries(seed, db.deviceId())
      await db.putEntries(list, false)
      const s = await db.getSettings()
      const overrides = { ...s.holidayOverrides }
      await db.saveSettings({ ...s, opening: seed.opening, holidayOverrides: overrides })
      for (const i of seed.issues) {
        await db.putIssue({ ...i, id: i.wo || crypto.randomUUID(), updatedAt: Date.now() } as Issue, false)
      }
      await reload()
      return list.length
    },
    restore: async (j) => {
      await db.putEntries(j.entries, false)
      for (const i of j.issues) await db.putIssue(i, false)
      if (j.settings) await db.saveSettings(db.mergeSettings(j.settings))
      await reload()
    },
    wipe: async () => { await db.wipeAll(); await reload() },
    sync: async () => { const r = await syncNow(settings.syncUrl); await reload(); return r },
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
