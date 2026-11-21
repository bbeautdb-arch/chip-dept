// ชั้นข้อมูล: เก็บในเครื่อง (IndexedDB) + คิวรอส่งขึ้น Google Sheet (outbox)
import { openDB, type IDBPDatabase } from 'idb'
import type { Entry, Issue, Settings } from './types'
import { DEFAULT_SETTINGS } from './defaults'

export interface OutboxItem { key: string; kind: 'entry' | 'issue' | 'settings'; payload: Entry | Issue | (Settings & { updatedAt: number }); queuedAt: number }

let dbp: Promise<IDBPDatabase> | null = null
function db() {
  dbp ??= openDB('chip-dept', 1, {
    upgrade(d) {
      const e = d.createObjectStore('entries', { keyPath: 'id' })
      e.createIndex('date', 'date')
      d.createObjectStore('issues', { keyPath: 'id' })
      d.createObjectStore('kv')
      d.createObjectStore('outbox', { keyPath: 'key' })
    },
  })
  return dbp
}

export async function allEntries(): Promise<Entry[]> { return (await db()).getAll('entries') }
export async function putEntry(e: Entry, queue = true) {
  const d = await db()
  const tx = d.transaction(['entries', 'outbox'], 'readwrite')
  await tx.objectStore('entries').put(e)
  if (queue) await tx.objectStore('outbox').put({ key: 'entry:' + e.id, kind: 'entry', payload: e, queuedAt: Date.now() } satisfies OutboxItem)
  await tx.done
}
export async function putEntries(list: Entry[], queue = false) {
  const d = await db()
  const tx = d.transaction(['entries', 'outbox'], 'readwrite')
  for (const e of list) {
    await tx.objectStore('entries').put(e)
    if (queue) await tx.objectStore('outbox').put({ key: 'entry:' + e.id, kind: 'entry', payload: e, queuedAt: Date.now() })
  }
  await tx.done
}
export async function deleteEntry(id: string) { await (await db()).delete('entries', id) }

export async function allIssues(): Promise<Issue[]> { return (await db()).getAll('issues') }
export async function putIssue(i: Issue, queue = true) {
  const d = await db()
  const tx = d.transaction(['issues', 'outbox'], 'readwrite')
  await tx.objectStore('issues').put(i)
  if (queue) await tx.objectStore('outbox').put({ key: 'issue:' + i.id, kind: 'issue', payload: i, queuedAt: Date.now() } satisfies OutboxItem)
  await tx.done
}
export async function deleteIssue(id: string) { await (await db()).delete('issues', id) }

export async function getSettings(): Promise<Settings> {
  const s = (await (await db()).get('kv', 'settings')) as Partial<Settings> | undefined
  return mergeSettings(s)
}
export function mergeSettings(s?: Partial<Settings>): Settings {
  if (!s) return structuredClone(DEFAULT_SETTINGS)
  // ตั้งค่าเก่า (ก่อนมีตัวเลือกแบบสูตร) ให้ใช้สูตรที่แก้แล้วเป็นค่าเริ่มต้น
  if (!s.formulaMode) s = { ...s, formulaMode: 'fixed', ftBase: 'kwh' }
  return { ...structuredClone(DEFAULT_SETTINGS), ...s, rates: { ...DEFAULT_SETTINGS.rates, ...(s.rates ?? {}) } }
}
export async function saveSettings(s: Settings, queue = false) {
  const d = await db()
  await d.put('kv', s, 'settings')
  if (queue) {
    const updatedAt = Date.now()
    await d.put('kv', updatedAt, 'settingsAt')
    await d.put('outbox', { key: 'settings', kind: 'settings', payload: { ...s, syncUrl: '', updatedAt }, queuedAt: updatedAt } satisfies OutboxItem)
  }
}
export async function getKV<T>(k: string): Promise<T | undefined> { return (await db()).get('kv', k) }
export async function setKV(k: string, v: unknown) { await (await db()).put('kv', v, k) }

export async function outbox(): Promise<OutboxItem[]> { return (await db()).getAll('outbox') }
export async function clearOutbox(keys: string[]) {
  const d = await db()
  const tx = d.transaction('outbox', 'readwrite')
  for (const k of keys) await tx.store.delete(k)
  await tx.done
}
export async function wipeAll() {
  const d = await db()
  for (const s of ['entries', 'issues', 'outbox'] as const) await d.clear(s)
}

export function deviceId(): string {
  let id = localStorage.getItem('chip-dept-device')
  if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('chip-dept-device', id) }
  return id
}
