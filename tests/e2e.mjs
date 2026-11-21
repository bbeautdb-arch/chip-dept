// ทดสอบครบวงจร: npm run build && npx vite preview --port 4174 & แล้ว node tests/e2e.mjs [chromium|webkit]
import { chromium, webkit } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

const BROWSER = process.argv[2] ?? 'chromium'
const BASE = process.env.BASE ?? 'http://localhost:4174/chip-dept/'
const OUT = process.env.OUT ?? '/workspace/chip-dept-shots'
mkdirSync(OUT, { recursive: true })
const exp = JSON.parse(readFileSync('tests/expected.json', 'utf8'))
const fix = JSON.parse(readFileSync('tests/expected-fixed.json', 'utf8')) // คำนวณอิสระโดย tests/calc-verify-fixed.ts
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const th = (n, d = 2) => n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d })
const B = await (BROWSER === 'webkit' ? webkit : chromium).launch()

async function ctxFor(w, h) {
  const ctx = await B.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: BROWSER === 'chromium' && w < 900, hasTouch: w < 900, locale: 'th-TH', timezoneId: 'Asia/Bangkok', acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const urls = []
  page.on('request', (r) => urls.push(r.url()))
  page.on('dialog', (d) => d.accept())
  return { ctx, page, errors, urls }
}
async function importSeed(page) {
  await page.goto(BASE)
  await page.getByTestId('import-seed').click()
  await page.getByText(/นำเข้าแล้ว \d+ รายการ/).waitFor({ timeout: 8000 })
}
async function calcText(page, d, s) {
  await page.goto(`${BASE}#/entry?d=${d}&s=${s}`)
  await page.getByTestId('calc').waitFor()
  await page.waitForTimeout(150)
  return (await page.getByTestId('calc').innerText()).replace(/\s+/g, ' ')
}
const has = (txt, n, d = 2) => txt.includes(th(n, d))
async function setMode(page, excel) {
  await page.goto(`${BASE}#/settings`)
  await page.getByTestId('formula-mode').getByRole('button', { name: excel ? 'ตรงตาม Excel เดิมทุกจุด' : 'สูตรที่แก้แล้ว (แนะนำ)' }).click()
  await page.locator('button.btn.green', { hasText: 'บันทึก' }).click()
  await page.getByText('บันทึกการตั้งค่าแล้ว').waitFor({ timeout: 5000 })
}

// ---------------- มือถือ ----------------
{
  const { ctx, page, errors, urls } = await ctxFor(390, 844)
  await page.goto(BASE)
  check('มือถือ: เปิดแอปได้ หัวข้อ "โรงชิพ"', (await page.locator('h1').first().innerText()).includes('โรงชิพ'))
  check('มือถือ: แจ้งว่าข้อมูลอยู่ในเครื่องเท่านั้น', await page.getByTestId('local-banner').isVisible())
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-home-empty.png` })
  await importSeed(page)
  check('นำเข้าข้อมูล พ.ย. 2569 (96 รายการ)', await page.getByText('นำเข้าแล้ว 96 รายการ').isVisible())
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-home.png` })

  // เทียบตัวเลขที่แอปคำนวณกับ Excel แถวจริง
  const D = exp.days
  for (const d of ['2026-11-04', '2026-11-11', '2026-11-16']) {
    const t = await calcText(page, d, 'yuka'); const y = D[d].yuka, F = fix.days[d]
    check(`ยูคา ${d} (สูตรแก้แล้ว): ต้นทุน ${th(F.yukaCost)} และแผน ${th(F.yukaPlan)} บ./ตัน ตรงค่าคำนวณอิสระ`, has(t, F.yukaCost) && has(t, F.yukaPlan))
    check(`ยูคา ${d}: kWh/ตัน ${th(y.kwhPerTon)} และสต๊อกรวม ${th(y.stockAll)}`, has(t, y.kwhPerTon) && has(t, y.stockAll))
  }
  for (const d of ['2026-11-05', '2026-11-10', '2026-11-15']) {
    const t = await calcText(page, d, 'fuel'); const f = D[d].fuel
    check(`เชื้อเพลิง ${d}: ต้นทุน ${th(f.costPerTon)} บ./ตัน ตรง Excel`, has(t, f.costPerTon))
    check(`เชื้อเพลิง ${d}: สต๊อกไม้ท่อน ${th(f.stockLog)} ตรง Excel`, has(t, f.stockLog))
    check(`เชื้อเพลิง ${d} (สูตรแก้แล้ว): แผน ${th(fix.days[d].fuelPlan)} บ./ตัน และสต๊อกชิพ ${th(fix.days[d].fuelStockChip)}`, has(t, fix.days[d].fuelPlan) && has(t, fix.days[d].fuelStockChip))
  }
  for (const d of ['2026-11-01', '2026-11-07']) {
    const t = await calcText(page, d, 'edge'); const b = D[d].board
    check(`ขอบบอร์ด ${d}: ต้นทุนรวม ${th(b.costPerTon)} บ./ตัน ตรงไฟล์สรุปต้นทุนสับบอร์ด`, has(t, b.costPerTon))
    check(`ขอบบอร์ด ${d}: ตัน ${th(b.tons, 3)} และค่าแรง ${th(b.labor)}`, has(t, b.tons, 3) && has(t, b.labor))
  }
  {
    const t = await calcText(page, '2026-11-02', 'meters')
    check(`มิเตอร์ 2026-11-02: ค่าไฟรวม 4 มิเตอร์ ${th(D['2026-11-02'].summary.baht, 0)} บาท ตรง summary`, has(t, D['2026-11-02'].summary.baht, 0))
  }
  {
    const t = await calcText(page, '2026-11-16', 'machines'); const m = D['2026-11-16'].machines
    check(`จักรกล 2026-11-16: Loader โรงชิพ ${th(m.chip)} และ BH ${th(m.bhTotal)}`, has(t, m.chip) && has(t, m.bhTotal))
  }
  {
    const t = await calcText(page, '2026-11-10', 'shifts')
    check(`รายกะ 2026-11-10: ยอดไม้ 3 กะ ${th(D['2026-11-10'].shifts.yukaTons)} ตัน`, has(t, D['2026-11-10'].shifts.yukaTons))
  }
  await page.goto(`${BASE}#/entry?d=2026-11-16&s=yuka`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-entry-yuka.png` })
  await page.goto(`${BASE}#/entry?d=2026-11-16&s=meters`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-entry-meters.png` })

  // รายงาน
  await page.goto(`${BASE}#/report`)
  await page.getByTestId('kpi-tons').waitFor()
  const M = exp.month
  const yTxt = await page.getByTestId('line-yuka').innerText(), fTxt = await page.getByTestId('line-fuel').innerText(), eTxt = await page.getByTestId('line-edge').innerText()
  check(`รายงาน: ยูคาสับได้รวม ${th(M.yuka.total)} ตัน ตรง Excel`, yTxt.includes(th(M.yuka.total)))
  check(`รายงาน: เชื้อเพลิงสับได้รวม ${th(M.fuel.total)} ตัน ตรง Excel`, fTxt.includes(th(M.fuel.total)))
  check(`รายงาน: ขอบบอร์ดสับได้รวม ${th(M.edge.chipped)} ตัน ตรง Excel`, eTxt.includes(th(M.edge.chipped)))
  check(`รายงาน (สูตรแก้แล้ว): ยูคาต้นทุน ${th(fix.month.yukaCost)} แผน ${th(fix.month.yukaPlan)} · เชื้อเพลิงแผน ${th(fix.month.fuelPlan)}`, has(yTxt, fix.month.yukaCost) && has(yTxt, fix.month.yukaPlan) && has(fTxt, fix.month.fuelPlan))
  check('รายงาน: รวมเรื่องผิดปกติเป็นกลุ่ม (กะที่เดินเครื่องติดลบ)', (await page.getByTestId('anomalies').innerText()).includes('เวลาหยุดรวมเกิน'))
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-report.png` })
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-report-full.png`, fullPage: true })
  await page.getByRole('button', { name: 'ขอบบอร์ด', exact: true }).click()
  check(`รายงานขอบบอร์ด: ค่าดำเนินการ ${th(M.board.opPerTon)} บ./ตัน ตรงไฟล์สรุปต้นทุน`, (await page.getByTestId('edge-op').innerText()).includes(th(M.board.opPerTon)))
  await page.getByRole('button', { name: 'ไม้ยูคา', exact: true }).click()
  await page.waitForTimeout(300)
  check(`รายงานยูคา (สูตรแก้แล้ว): ค่าแรง+ไฟ/ตัน ${th(fix.month.yukaLaborElec)} (นับค่าแรงเฉพาะวันที่ลงแล้ว)`, has(await page.locator('main').innerText(), fix.month.yukaLaborElec))
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-report-yuka.png`, fullPage: true })

  // สลับเป็นโหมด "ตรงตาม Excel เดิม" ต้องได้ตัวเลขเท่า Excel
  await setMode(page, true)
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-settings-mode.png` })
  for (const d of ['2026-11-04', '2026-11-11', '2026-11-16']) {
    const t = await calcText(page, d, 'yuka'); const y = D[d].yuka
    check(`โหมด Excel ยูคา ${d}: ต้นทุน ${th(y.costPerTon)} แผน ${th(y.planPerTon)} ตรง Excel`, has(t, y.costPerTon) && has(t, y.planPerTon))
  }
  {
    const t = await calcText(page, '2026-11-10', 'fuel'); const f = D['2026-11-10'].fuel
    check(`โหมด Excel เชื้อเพลิง 2026-11-10: แผน ${th(f.planPerTon)} สต๊อกชิพ ${th(f.stockChip)} ตรง Excel`, has(t, f.planPerTon) && has(t, f.stockChip))
  }
  await page.goto(`${BASE}#/report`); await page.getByTestId('kpi-tons').waitFor()
  await page.getByRole('button', { name: 'ไม้ยูคา', exact: true }).click(); await page.waitForTimeout(200)
  check(`โหมด Excel รายงานยูคา: ค่าแรง+ไฟ/ตัน ${th(M.yuka.laborElecPerTon)} ตรง Excel (T38)`, has(await page.locator('main').innerText(), M.yuka.laborElecPerTon))
  await page.getByRole('button', { name: 'ไม้เชื้อเพลิง', exact: true }).click(); await page.waitForTimeout(200)
  check(`โหมด Excel รายงานเชื้อเพลิง: ค่าแรง+ไฟ/ตัน ${th(M.fuel.laborElecPerTon)} ตรง Excel (AH38)`, has(await page.locator('main').innerText(), M.fuel.laborElecPerTon))
  await setMode(page, false)
  await page.goto(`${BASE}#/report`); await page.getByTestId('kpi-tons').waitFor()
  check('กลับเป็นสูตรแก้แล้ว: รายงานยูคากลับเป็นค่าเดิม', has(await page.getByTestId('line-yuka').innerText(), fix.month.yukaCost))

  // ส่งออก Excel / CSV
  await page.getByRole('button', { name: 'ภาพรวม', exact: true }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-xlsx').click()])
  const xp = `${OUT}/${BROWSER}-export.xlsx`; await dl.saveAs(xp)
  const wb = XLSX.read(readFileSync(xp))
  const s1 = XLSX.utils.sheet_to_json(wb.Sheets['สรุปรายวัน'])
  const y1 = XLSX.utils.sheet_to_json(wb.Sheets['ต้นทุนสับไม้ยูคา'])
  check('ส่งออก Excel: มี 8 ชีต (สรุป, ยูคา, เชื้อเพลิง, ขอบบอร์ด, มิเตอร์, จักรกล, รายกะ, ปัญหา)', wb.SheetNames.length === 8, wb.SheetNames.join(', '))
  check(`ส่งออก Excel: 16 วัน และต้นทุนยูคา 16 พ.ย. = ${th(fix.days['2026-11-16'].yukaCost)}`, s1.length === 16 && Math.abs(y1[15]['ต้นทุนผลิต (บ./ตัน)'] - fix.days['2026-11-16'].yukaCost) < 0.01, `${s1.length} แถว, ${y1[15]?.['ต้นทุนผลิต (บ./ตัน)']}`)
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()])
  const cp = `${OUT}/${BROWSER}-export.csv`; await dl2.saveAs(cp)
  const csv = readFileSync(cp, 'utf8')
  check('ส่งออก CSV: เปิดใน Excel ภาษาไทยได้ (มี BOM) 17 บรรทัด', csv.charCodeAt(0) === 0xfeff && csv.trim().split('\n').length === 17)

  // ลงค่าใหม่ 17 พ.ย. (วันที่ขาด)
  await page.goto(`${BASE}#/entry?d=2026-11-17&s=yuka`)
  await page.locator('#yuka-logIn').fill('200')
  await page.locator('#yuka-chipped').fill('200')
  await page.locator('#yuka-silo').fill('150')
  await page.waitForTimeout(150)
  let t = (await page.getByTestId('calc').innerText()).replace(/\s+/g, ' ')
  check('ลงค่าใหม่: คำนวณสดทันที สต๊อกชิพรวม 987.63+200-150 = 1,037.63', t.includes('1,037.63'))
  await page.getByTestId('save').click()
  await page.locator('#who').fill('สมชาย ทดสอบ')
  await page.getByRole('button', { name: 'ตกลง' }).click()
  await page.getByTestId('save').click()
  await page.getByText('บันทึกไม้ยูคา 17 พ.ย. 69 แล้ว').waitFor({ timeout: 5000 })
  check('ลงค่าใหม่: ถามชื่อผู้บันทึกครั้งแรก แล้วบันทึกสำเร็จ', true)
  check('ลงค่าใหม่: แสดงชื่อผู้บันทึก', (await page.locator('.savebar .who').innerText()).includes('สมชาย ทดสอบ'))
  await page.locator('#yuka-chipped').fill('2000')
  await page.waitForTimeout(150)
  check('ตรวจค่าผิดปกติ: สับได้ 2,000 ตัน ขึ้นเตือน "สูงกว่าปกติ"', (await page.locator('[data-field=yuka-chipped] .msg').innerText()).includes('สูงกว่าปกติ'))
  await page.locator('#yuka-chipped').fill('200')

  await page.goto(`${BASE}#/entry?d=2026-11-17&s=meters`)
  const pre = await page.locator('#m-mcc27-r08').inputValue()
  const seed = JSON.parse(readFileSync('public/seed-2569-11.json', 'utf8'))
  const want = seed.entries.find((e) => e.date === '2026-11-16' && e.section === 'meters').data.mcc27.r08n
  check(`มิเตอร์: ช่อง 08:00 ดึงเลข 08:00 พรุ่งนี้ของเมื่อวานมาให้เอง (${pre})`, Number(pre) === want, `${pre} vs ${want}`)
  await page.locator('#m-mcc27-r09').fill(String(Number(pre) - 10))
  await page.waitForTimeout(150)
  check('มิเตอร์: ใส่เลขถอยหลัง ขึ้นเตือนสีแดง', (await page.locator('[data-field=m-mcc27-r09] .msg').innerText()).includes('มิเตอร์ถอยหลัง'))
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-meter-error.png` })

  await page.goto(`${BASE}#/entry?d=2026-11-17&s=shifts`)
  await page.locator('#sh-yuka-A-rest').fill('9')
  await page.waitForTimeout(150)
  check('รายกะ: เวลาหยุดเกินกะ แจ้งเดินเครื่องติดลบ', (await page.locator('.shift').first().innerText()).includes('เวลาหยุดรวมเกิน'))

  await page.goto(`${BASE}#/history`)
  await page.waitForTimeout(300)
  const h17 = await page.getByTestId('history-item').nth(1).innerText()
  check('ประวัติ: 17 พ.ย. แสดงคนลง "สมชาย ทดสอบ"', h17.includes('สมชาย ทดสอบ'), h17.replace(/\s+/g, ' ').slice(0, 80))
  await page.screenshot({ path: `${OUT}/${BROWSER}-phone-history.png` })

  // ปัญหาเครื่องจักร
  await page.goto(`${BASE}#/issues`)
  await page.getByRole('button', { name: 'แจ้งใหม่' }).click()
  await page.locator('#is-machine').fill('สายพาน BC5')
  await page.locator('#is-problem').fill('สายพานลื่น')
  await page.getByRole('button', { name: 'บันทึก' }).click()
  await page.waitForTimeout(300)
  check('แจ้งปัญหาเครื่องจักร: บันทึกและแสดงในรายการ (รวม 2 รายการเดิมจาก Excel)', (await page.locator('.list').innerText()).includes('สายพานลื่น') && (await page.locator('.list').innerText()).includes('WO680655'))

  // PWA / ออฟไลน์ / ขอบเขต
  await page.goto(BASE)
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, script: r.active?.scriptURL } }).catch((e) => ({ error: String(e) }))
  check('PWA: service worker จำกัดอยู่ใต้ /chip-dept/ เท่านั้น', !!sw.scope && new URL(sw.scope).pathname === '/chip-dept/' && new URL(sw.script).pathname === '/chip-dept/sw.js', JSON.stringify(sw))
  const man = await (await page.request.get(BASE + 'manifest.webmanifest')).json()
  check('PWA: manifest scope/start_url = /chip-dept/ และมีไอคอนของตัวเอง', man.scope === '/chip-dept/' && man.start_url === '/chip-dept/' && man.icons.length === 3)
  const rootSw = await page.request.get(new URL('/sw.js', BASE).toString())
  check('ขอบเขต: ไม่มี sw.js ที่รากโดเมน (ไม่ไปทับแอปอื่น)', rootSw.status() === 404, String(rootSw.status()))
  const outside = urls.filter((u) => u.startsWith(new URL('/', BASE).toString()) && !u.startsWith(BASE))
  check('ขอบเขต: ทุกไฟล์ที่โหลดอยู่ใต้ /chip-dept/', outside.length === 0, outside.slice(0, 3).join(' '))
  if (!sw.error) {
    await page.reload(); await page.waitForTimeout(800)
    await ctx.setOffline(true)
    await page.reload()
    await page.waitForTimeout(800)
    const okOff = (await page.locator('h1').first().innerText()).includes('โรงชิพ')
    await page.goto(`${BASE}#/history`); await page.waitForTimeout(300)
    check('ออฟไลน์: เปิดแอปได้และข้อมูลยังอยู่', okOff && (await page.getByTestId('history-item').count()) > 10)
    await ctx.setOffline(false)
  }
  check('มือถือ: ไม่มี error ในหน้าเว็บ', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

// ---------------- แท็บเล็ต ----------------
{
  const { ctx, page, errors } = await ctxFor(820, 1180)
  await importSeed(page)
  await page.waitForTimeout(2600)
  await page.goto(`${BASE}#/entry?d=2026-11-16&s=yuka`)
  await page.waitForTimeout(400)
  const box = await page.getByTestId('calc').boundingBox()
  check('แท็บเล็ต: ช่องคำนวณอัตโนมัติอยู่ข้างฟอร์ม (2 คอลัมน์)', box && box.x > 400, JSON.stringify(box))
  await page.screenshot({ path: `${OUT}/${BROWSER}-tablet-entry-yuka.png` })
  await page.goto(`${BASE}#/entry?d=2026-11-10&s=shifts`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-tablet-entry-shifts.png` })
  await page.goto(`${BASE}#/report`)
  await page.getByTestId('kpi-tons').waitFor(); await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-tablet-report.png` })
  await page.screenshot({ path: `${OUT}/${BROWSER}-tablet-report-full.png`, fullPage: true })
  check('แท็บเล็ต: ไม่มี error', errors.length === 0, errors.slice(0, 3).join(' | '))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('แท็บเล็ต: ไม่มีส่วนล้นจอแนวนอน', !overflow)
  await ctx.close()
}

// ---------------- เดสก์ท็อป ----------------
{
  const { ctx, page, errors } = await ctxFor(1366, 900)
  await importSeed(page)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `${OUT}/${BROWSER}-desktop-home.png` })
  await page.goto(`${BASE}#/report`)
  await page.getByTestId('kpi-tons').waitFor(); await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-desktop-report.png`, fullPage: true })
  await page.goto(`${BASE}#/entry?d=2026-11-16&s=meters`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-desktop-entry-meters.png` })
  await page.goto(`${BASE}#/settings`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${BROWSER}-desktop-settings.png`, fullPage: true })
  check('เดสก์ท็อป: ไม่มี error', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}
// มือถือ: ไม่ล้นจอ
{
  const { ctx, page } = await ctxFor(390, 844)
  await importSeed(page); await page.waitForTimeout(2600)
  let bad = []
  for (const r of ['#/', '#/entry?d=2026-11-16&s=yuka', '#/entry?d=2026-11-16&s=fuel', '#/entry?d=2026-11-16&s=meters', '#/entry?d=2026-11-16&s=shifts', '#/report', '#/history', '#/settings', '#/issues']) {
    await page.goto(BASE + r); await page.waitForTimeout(250)
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) bad.push(r)
  }
  check('มือถือ: ทุกหน้าไม่ล้นจอแนวนอน', bad.length === 0, bad.join(' '))
  await ctx.close()
}
await B.close()
const pass = results.filter((r) => r.ok).length
console.log(`\n${BROWSER}: ผ่าน ${pass}/${results.length}`)
writeFileSync(`${OUT}/${BROWSER}-results.json`, JSON.stringify(results, null, 1))
process.exit(pass === results.length ? 0 : 1)
