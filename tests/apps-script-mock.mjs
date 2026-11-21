// ทดสอบ Code.gs แบบจำลอง SpreadsheetApp (ไม่ได้ deploy จริง)
import { readFileSync } from 'fs'
const sheets = {}
function mkSheet(name) {
  const rows = []
  const sh = {
    rows,
    appendRow: (r) => rows.push([...r]), setFrozenRows() {},
    getLastRow: () => rows.length, getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] ?? [])[c - 1 + j] ?? '')),
      getValue: () => (rows[r - 1] ?? [])[c - 1],
      setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => { rows[r - 1 + i] ??= []; rows[r - 1 + i][c - 1 + j] = x })),
    }),
  }
  return sh
}
const ss = { getSheetByName: (n) => sheets[n] ?? null, insertSheet: (n) => (sheets[n] = mkSheet(n)) }
const g = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ss },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
}
const code = readFileSync('apps-script/Code.gs', 'utf8')
const api = new Function(...Object.keys(g), code + '; return { doPost, doGet }')(...Object.values(g))
const seed = JSON.parse(readFileSync('public/seed-2569-11.json', 'utf8'))
const items = seed.entries.slice(0, 12).map((p) => ({ kind: 'entry', payload: { ...p, by: 'ทดสอบ', updatedAt: 1000, device: 'x' } }))
items.push({ kind: 'settings', payload: { a: 1, updatedAt: 5 } })
let r = api.doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'push', items }) } })
console.log('push', r.ok, r.saved)
const p1 = api.doGet({ parameter: { action: 'pull', since: '0' } })
console.log('pull', p1.ok, p1.entries.length, !!p1.settings)
// older update must not overwrite
api.doPost({ parameter: {}, postData: { contents: JSON.stringify({ action: 'push', items: [{ kind: 'entry', payload: { ...items[0].payload, by: 'เก่า', updatedAt: 1 } }] }) } })
const p2 = api.doGet({ parameter: { action: 'pull', since: '0' } })
console.log('older-ignored', p2.entries.find((e) => e.id === items[0].payload.id).by === 'ทดสอบ')
const p3 = api.doGet({ parameter: { action: 'pull', since: String(p1.now + 1e9) } })
console.log('since-filter', p3.entries.length === 0)
console.log('readable sheets', Object.keys(sheets).join(','), 'yuka rows', sheets['ไม้ยูคา']?.rows.length)
