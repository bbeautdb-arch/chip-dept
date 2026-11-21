// ส่งข้อมูลขึ้น Google Sheet ผ่าน Apps Script (เมื่อเจ้าของตั้งค่าลิงก์แล้วเท่านั้น)
// โปรโตคอล: POST {action:'push', items:[...]} และ GET ?action=pull&since=<ms>
// ใช้ text/plain เพื่อไม่ต้องผ่าน CORS preflight ของ Apps Script
import type { Entry, Issue } from './types'
import { outbox, clearOutbox, putEntries, putIssue, getKV, setKV, allEntries, getSettings, saveSettings, mergeSettings } from './db'

export interface SyncResult { pushed: number; pulled: number; error?: string }

export async function syncNow(url: string): Promise<SyncResult> {
  if (!url) return { pushed: 0, pulled: 0, error: 'ยังไม่ได้ตั้งค่าลิงก์ Google Sheet' }
  if (!navigator.onLine) return { pushed: 0, pulled: 0, error: 'ไม่มีอินเทอร์เน็ต ข้อมูลยังเก็บไว้ในเครื่อง จะส่งให้เมื่อออนไลน์' }
  try {
    const items = await outbox()
    let pushed = 0
    if (items.length) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'push', items: items.map((i) => ({ kind: i.kind, payload: i.payload })) }) })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'ส่งไม่สำเร็จ')
      await clearOutbox(items.map((i) => i.key))
      pushed = items.length
    }
    const since = (await getKV<number>('lastPull')) ?? 0
    const res2 = await fetch(`${url}${url.includes('?') ? '&' : '?'}action=pull&since=${since}`)
    const j2 = await res2.json()
    if (!j2.ok) throw new Error(j2.error || 'ดึงข้อมูลไม่สำเร็จ')
    const local = new Map((await allEntries()).map((e) => [e.id, e]))
    const newer: Entry[] = []
    for (const e of (j2.entries ?? []) as Entry[]) {
      const l = local.get(e.id)
      if (!l || l.updatedAt < e.updatedAt) newer.push(e)
    }
    await putEntries(newer, false)
    for (const i of (j2.issues ?? []) as Issue[]) await putIssue(i, false)
    if (j2.settings && j2.settings.updatedAt > ((await getKV<number>('settingsAt')) ?? 0)) {
      const local = await getSettings()
      await saveSettings({ ...mergeSettings(j2.settings), syncUrl: local.syncUrl })
      await setKV('settingsAt', j2.settings.updatedAt)
    }
    await setKV('lastPull', j2.now ?? Date.now())
    await setKV('lastSync', Date.now())
    return { pushed, pulled: newer.length }
  } catch (err) {
    return { pushed: 0, pulled: 0, error: 'เชื่อมต่อ Google Sheet ไม่สำเร็จ: ' + (err as Error).message }
  }
}
