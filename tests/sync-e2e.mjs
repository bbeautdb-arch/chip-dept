// จำลอง Apps Script ด้วย Code.gs จริง บน http://localhost:4175 แล้วให้ 2 "เครื่อง" ส่ง/รับข้อมูลกัน
import http from 'http'
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
const sheets = {}
function mkSheet() { const rows = []; return { rows, appendRow: (r) => rows.push([...r]), setFrozenRows() {}, getLastRow: () => rows.length, getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
  getRange: (r, c, nr = 1, nc = 1) => ({ getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] ?? [])[c - 1 + j] ?? '')), getValue: () => (rows[r - 1] ?? [])[c - 1],
    setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => { rows[r - 1 + i] ??= []; rows[r - 1 + i][c - 1 + j] = x })) }) } }
const ss = { getSheetByName: (n) => sheets[n] ?? null, insertSheet: (n) => (sheets[n] = mkSheet()) }
const g = { SpreadsheetApp: { getActiveSpreadsheet: () => ss }, LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => t }) } }
const api = new Function(...Object.keys(g), readFileSync('apps-script/Code.gs', 'utf8') + '; return { doPost, doGet }')(...Object.values(g))
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const parameter = Object.fromEntries(u.searchParams)
  let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
    const out = req.method === 'POST' ? api.doPost({ parameter, postData: { contents: body } }) : api.doGet({ parameter })
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(out) }) }).listen(4175)
const URL_ = 'http://localhost:4175/exec'
const b = await chromium.launch()
const ok = []; const check = (n, c, d = '') => { ok.push(c); console.log(c ? 'PASS' : 'FAIL', n, d) }
async function device(name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage()
  await p.goto('http://localhost:4174/chip-dept/#/settings'); await p.waitForTimeout(800)
  await p.locator('#set-sync').fill(URL_); await p.locator('button.btn.green', { hasText: 'บันทึก' }).click(); await p.waitForTimeout(1500)
  await p.evaluate((n) => localStorage.setItem('chip-dept-user', n), name)
  return p }
const A = await device('เครื่อง A'); const B = await device('เครื่อง B')
await A.goto('http://localhost:4174/chip-dept/#/entry?d=2026-11-18&s=yuka'); await A.reload(); await A.waitForTimeout(800)
await A.locator('#yuka-logIn').fill('123.45'); await A.locator('#yuka-chipped').fill('120')
await A.getByTestId('save').click(); await A.waitForTimeout(2500)
check('ส่งขึ้น Sheet แล้ว (แถวใน entries)', (sheets.entries?.rows.length ?? 0) >= 2, String(sheets.entries?.rows.length))
check('มีแผ่นอ่านง่าย "ไม้ยูคา"', !!sheets['ไม้ยูคา'], sheets['ไม้ยูคา']?.rows[0]?.slice(0, 6).join(' | '))
await B.goto('http://localhost:4174/chip-dept/#/settings'); await B.waitForTimeout(400)
await B.getByText('ส่ง/รับข้อมูลตอนนี้').click(); await B.waitForTimeout(1500)
await B.goto('http://localhost:4174/chip-dept/#/entry?d=2026-11-18&s=yuka'); await B.waitForTimeout(1000)
const v = await B.locator('#yuka-logIn').inputValue()
check('เครื่อง B ได้ข้อมูลที่เครื่อง A ลง', v === '123.45', v)
const who = await B.locator('body').innerText()
check('เครื่อง B เห็นชื่อผู้บันทึก "เครื่อง A"', who.includes('เครื่อง A'))
await b.close(); srv.close()
console.log(`sync: ผ่าน ${ok.filter(Boolean).length}/${ok.length}`)
