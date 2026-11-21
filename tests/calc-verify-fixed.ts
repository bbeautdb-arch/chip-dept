// โหมด "สูตรที่แก้แล้ว" (ค่าเริ่มต้น): คำนวณแยกอิสระในไฟล์นี้จากข้อมูลดิบ + ตัวเลขส่วนประกอบที่ Excel คำนวณไว้
// แล้วเทียบกับแอป พร้อมพิมพ์ตาราง ก่อน (Excel) → หลัง (แก้แล้ว) ของตัวเลขทั้งเดือน 1–16 พ.ย. 2569
import { readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS } from '../src/lib/defaults.ts'
import { computeAll, aggregate } from '../src/lib/calc.ts'
import { seedToEntries, groupByDate, applySeedSettings, type SeedFile } from '../src/lib/seed.ts'

const seed: SeedFile = JSON.parse(readFileSync('public/seed-2569-11.json', 'utf8'))
const exp = JSON.parse(readFileSync('tests/expected.json', 'utf8'))
const raw: Record<string, Record<string, any>> = {}
for (const e of seed.entries as any[]) (raw[e.date] ??= {})[e.section] = e.data

const FT = 0.1972, LABOR = 713 * 6 + 1368, PLAN_Y = 7818.393, PLAN_F = 2803.357
let pass = 0, fail = 0
const rows: string[] = []
function cmp(label: string, app: number | null | undefined, want: number | null | undefined, tol = 1e-6) {
  const ok = app != null && want != null && Math.abs(app - want) <= tol * Math.max(1, Math.abs(want))
  if (ok) pass++; else { fail++; rows.push(`FAIL ${label}: app=${app} independent=${want}`) }
}

// ---- แอป: ค่าเริ่มต้น (ต้องเป็นสูตรที่แก้แล้ว)
if (DEFAULT_SETTINGS.formulaMode !== 'fixed' || DEFAULT_SETTINGS.ftBase !== 'kwh') { fail++; rows.push('FAIL ค่าเริ่มต้นไม่ใช่สูตรที่แก้แล้ว') } else pass++
const sF = applySeedSettings(seed, DEFAULT_SETTINGS)
const sX = applySeedSettings(seed, { ...DEFAULT_SETTINGS, formulaMode: 'excel', ftBase: 'baht' })
const byDate = groupByDate(seedToEntries(seed))
const cF = computeAll(byDate, sF, '2026-11-16'), cX = computeAll(byDate, sX, '2026-11-16')

// ---- คำนวณอิสระ (ไม่ใช้โค้ดในแอป)
let stockChip = seed.opening.fuel.stockChip
const indDays: Record<string, any> = {}
const ind = { yFt: 0, fFt: 0, yCost: 0, yTons: 0, yPlan: 0, fPlan: 0, fTons: 0, yElec: 0, fElec: 0, yLog: 0, days: 0 }
for (const d of Object.keys(exp.days).sort()) {
  const Y = exp.days[d].yuka, F = exp.days[d].fuel, y = raw[d].yuka, f = raw[d].fuel
  // 1) FT = kWh × 0.1972
  const yFt = Y.kwh * FT, fFt = F.kwh * FT
  cmp(`${d} ยูคา FT`, cF[d].yuka.ft, yFt); cmp(`${d} เชื้อเพลิง FT`, cF[d].fuel.ft, fFt)
  // 2) ยูคา ต้นทุน/ตัน: S+T+U+V+W+X+Y+Z+AA นับครั้งเดียว ÷ G
  const G = y.chipped + y.fromStock + y.fromBig
  const yCostDay = Y.elec + LABOR + Y.loader + (Y.bh ?? 0) + yFt + Y.demand + y.heavyOther + y.repair + y.blade
  cmp(`${d} ยูคา ต้นทุน/ตัน`, cF[d].yuka.costPerTon, yCostDay / G)
  // 6) ยูคา แผน = (U+S+T+Z+W+X+Y + AD) ÷ G (รวมสับได้ เหมือนต้นทุนจริง)
  const yPlanDay = Y.loader + Y.elec + LABOR + y.repair + yFt + Y.demand + y.heavyOther + PLAN_Y
  cmp(`${d} ยูคา แผน/ตัน`, cF[d].yuka.planPerTon, yPlanDay / G)
  // 3) เชื้อเพลิง แผน = (ค่าไฟ AG + ซ่อม AO + ค่าแรง AH + AR) ÷ H  (ไม่บวกตันสต๊อก)
  const H = f.chipped + f.fromWaitLog + f.press1 + f.press2
  const fPlanDay = F.elec + (f.pm + f.cm) + LABOR + PLAN_F
  cmp(`${d} เชื้อเพลิง แผน/ตัน`, cF[d].fuel.planPerTon, fPlanDay / H)
  // เชื้อเพลิง ต้นทุน/ตัน (ข้อ 5 คงแบบ Excel: ไม่รวม FT/Demand) ต้องเท่า Excel
  cmp(`${d} เชื้อเพลิง ต้นทุน/ตัน (คง Excel)`, cF[d].fuel.costPerTon, F.costPerTon, 1e-4)
  // 4) สต๊อกชิพสับเอง = ก่อนหน้า + D+E+F+G − M ทุกวัน
  stockChip += H - f.usePile
  cmp(`${d} เชื้อเพลิง สต๊อกชิพ`, cF[d].fuel.stockChip, stockChip)
  indDays[d] = { yukaCost: yCostDay / G, yukaPlan: yPlanDay / G, fuelPlan: fPlanDay / H, fuelStockChip: stockChip }
  ind.yFt += yFt; ind.fFt += fFt; ind.yCost += yCostDay; ind.yTons += G; ind.yPlan += yPlanDay; ind.fPlan += fPlanDay; ind.fTons += H
  ind.yElec += Y.elec; ind.fElec += F.elec; ind.yLog += y.logIn; ind.days++
}
// 9) ค่าแรงเดือน = เฉพาะวันที่ลงค่าแล้ว (16 วัน)
const aF = aggregate(Object.values(cF), byDate, sF), aX = aggregate(Object.values(cX), byDate, sX)
cmp('เดือน ยูคา ค่าแรง', aF.yuka.labor, ind.days * LABOR); cmp('เดือน เชื้อเพลิง ค่าแรง', aF.fuel.labor, ind.days * LABOR)
cmp('เดือน ยูคา ค่าแรง+ไฟ/ตัน', aF.yuka.laborElecPerTon, (ind.days * LABOR + ind.yElec) / ind.yLog)
cmp('เดือน เชื้อเพลิง ค่าแรง+ไฟ/ตัน', aF.fuel.laborElecPerTon, (ind.days * LABOR + ind.fElec) / ind.fTons)
cmp('เดือน ยูคา FT', aF.yuka.ft, ind.yFt); cmp('เดือน ยูคา แผน/ตัน', aF.yuka.planPerTon, ind.yPlan / ind.yTons)
cmp('เดือน เชื้อเพลิง แผน/ตัน', aF.fuel.planPerTon, ind.fPlan / ind.fTons)
cmp('เดือน ยูคา ต้นทุน/ตัน', aF.yuka.costPerTon, ind.yCost / ind.yTons)
// โหมด Excel ต้องได้ค่าแรงเดือนเท่า Excel (31 แถว)
cmp('โหมด Excel: ค่าแรงเดือนยูคา = Excel', aX.yuka.labor, exp.month.yuka.labor)

const f2 = (n: number | null) => (n == null ? '–' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const table = [
  ['ตัวเลขทั้งเดือน 1–16 พ.ย. 2569', 'ก่อน (แบบ Excel)', 'หลัง (แก้แล้ว)'],
  ['ยูคา ต้นทุนเฉลี่ย บ./ตัน', f2(aX.yuka.costPerTon), f2(aF.yuka.costPerTon)],
  ['ยูคา ค่า FT รวม บาท', f2(aX.yuka.ft), f2(aF.yuka.ft)],
  ['ยูคา ต้นทุนตามแผน บ./ตัน', f2(aX.yuka.planPerTon), f2(aF.yuka.planPerTon)],
  ['ยูคา ค่าแรงรวม บาท', f2(aX.yuka.labor), f2(aF.yuka.labor)],
  ['ยูคา ค่าแรง+ไฟ/ตัน (T38)', f2(aX.yuka.laborElecPerTon), f2(aF.yuka.laborElecPerTon)],
  ['เชื้อเพลิง ต้นทุนเฉลี่ย บ./ตัน', f2(aX.fuel.costPerTon), f2(aF.fuel.costPerTon)],
  ['เชื้อเพลิง ค่า FT รวม บาท (ไม่นับในต้นทุน ข้อ 5)', f2(aX.fuel.ft), f2(aF.fuel.ft)],
  ['เชื้อเพลิง ต้นทุนตามแผน บ./ตัน', f2(aX.fuel.planPerTon), f2(aF.fuel.planPerTon)],
  ['เชื้อเพลิง ค่าแรงรวม บาท', f2(aX.fuel.labor), f2(aF.fuel.labor)],
  ['เชื้อเพลิง ค่าแรง+ไฟ/ตัน (AH38)', f2(aX.fuel.laborElecPerTon), f2(aF.fuel.laborElecPerTon)],
  ['เชื้อเพลิง สต๊อกชิพสับเอง 16 พ.ย. ตัน', f2(cX['2026-11-16'].fuel.stockChip), f2(cF['2026-11-16'].fuel.stockChip)],
  ['ยูคา แผน/ตัน วันที่ 11 พ.ย.', f2(cX['2026-11-11'].yuka.planPerTon), f2(cF['2026-11-11'].yuka.planPerTon)],
  ['ทั้งแผนก ต้นทุนเฉลี่ย บ./ตัน', f2(aX.costPerTon), f2(aF.costPerTon)],
].map((r) => r.join(' | ')).join('\n')
const out = rows.join('\n') + `\n\nรวม: ผ่าน ${pass} / ไม่ตรง ${fail}\n\n` + table + '\n'
console.log(out)
writeFileSync('tests/calc-verify-fixed-result.txt', out)
// ค่าที่คำนวณอิสระ ใช้ตรวจหน้าจอใน e2e
writeFileSync('tests/expected-fixed.json', JSON.stringify({
  days: indDays,
  month: { yukaCost: ind.yCost / ind.yTons, yukaPlan: ind.yPlan / ind.yTons, fuelPlan: ind.fPlan / ind.fTons, yukaFt: ind.yFt,
    yukaLaborElec: (ind.days * LABOR + ind.yElec) / ind.yLog, fuelLaborElec: (ind.days * LABOR + ind.fElec) / ind.fTons },
}, null, 1))
