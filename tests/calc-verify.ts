// โหมด "ตรงตาม Excel เดิม": ตรวจสูตรในแอปเทียบตัวเลขที่ Excel คำนวณไว้จริง (ทุกวันที่มีข้อมูล 1–16 พ.ย. 2569)
import { readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_SETTINGS } from '../src/lib/defaults.ts'
import { computeAll, aggregate } from '../src/lib/calc.ts'
import { seedToEntries, groupByDate, applySeedSettings, type SeedFile } from '../src/lib/seed.ts'

const seed: SeedFile = JSON.parse(readFileSync('public/seed-2569-11.json', 'utf8'))
const exp = JSON.parse(readFileSync('tests/expected.json', 'utf8'))
const s = applySeedSettings(seed, { ...DEFAULT_SETTINGS, formulaMode: 'excel', ftBase: 'baht' })
const byDate = groupByDate(seedToEntries(seed))
const calc = computeAll(byDate, s, '2026-11-16')

let pass = 0, fail = 0
const rows: string[] = []
function cmp(label: string, app: number | null | undefined, xl: number | null | undefined, tol = 0.01) {
  if (xl === null || xl === undefined) return
  const ok = app !== null && app !== undefined && Math.abs(app - xl) <= tol * Math.max(1, Math.abs(xl) / 100)
  if (ok) pass++; else { fail++; rows.push(`FAIL ${label}: app=${app} excel=${xl}`) }
}
for (const [d, e] of Object.entries<any>(exp.days)) {
  const c = calc[d]
  for (const m of Object.keys(e.meters)) {
    const em = e.meters[m], cm = c.meters[m]
    cmp(`${d} meter ${m} peak`, cm.peak, em.peak ?? 0); cmp(`${d} meter ${m} off`, cm.off, em.off); cmp(`${d} meter ${m} baht`, cm.baht, em.baht)
  }
  cmp(`${d} summary kWh`, c.summary.kwh, e.summary.kwh); cmp(`${d} summary baht`, c.summary.baht, e.summary.baht)
  const Y = e.yuka
  for (const k of ['total', 'kwh', 'kwhPerTon', 'stockAll', 'stockBought', 'stockLog', 'stockBig', 'elec', 'labor', 'loader', 'ft', 'demand', 'costPerTon', 'planPerTon'])
    cmp(`${d} ยูคา ${k}`, (c.yuka as any)[k], Y[k])
  if (Y.bh !== null) cmp(`${d} ยูคา bh`, c.yuka.bh, Y.bh)
  const F = e.fuel
  for (const k of ['total', 'kwh', 'kwhPerTon', 'stockBought', 'stockChip', 'stockLog', 'stockBigCrane', 'stockBig1', 'elec', 'labor', 'loader', 'ft', 'demand', 'repair', 'costPerTon', 'planPerTon'])
    cmp(`${d} เชื้อเพลิง ${k}`, (c.fuel as any)[k], F[k])
  const sm: Record<string, string> = { sChip: 'chip', sBark: 'bark', sEdge: 'edge', sDust: 'dust', sPulp: 'pulp', sVeneer: 'veneer' }
  for (const [k, v] of Object.entries(sm)) cmp(`${d} safety ${v}`, (c.fuel.safety as any)[v], F[k])
  cmp(`${d} ขอบบอร์ด tons(D)`, c.edge.tons, e.edge.chipped); cmp(`${d} ขอบบอร์ด stock K`, c.edge.stockEdge, e.edge.stockEdge); cmp(`${d} ขอบบอร์ด stock L`, c.edge.stockOver, e.edge.stockOver)
  const B = e.board
  for (const k of ['hours', 'tons', 'kwh', 'elec', 'elecPerTon', 'kwhPerTon', 'labor', 'laborPerTon', 'op', 'opPerTon', 'costPerTon'])
    cmp(`${d} บอร์ด ${k}`, (c.edge as any)[k], B[k])
  const M = e.machines
  cmp(`${d} loader rent`, c.machines.rent, M.rent); cmp(`${d} loader fuel`, c.machines.fuel, M.fuel)
  for (const k of ['boiler', 'chip', 'edge', 'prod', 'hours']) cmp(`${d} loader ${k}`, (c.machines as any)[k], M[k])
  cmp(`${d} BH hours`, c.machines.bhHours, M.bhHours); cmp(`${d} BH rent`, c.machines.bhRent, M.bhRent); cmp(`${d} BH fuel`, c.machines.bhFuel, M.bhFuel); cmp(`${d} BH total`, c.machines.bhTotal, M.bhTotal)
  const S = e.shifts
  ;(['A', 'B', 'C'] as const).forEach((k, i) => { cmp(`${d} กะ${k} ยูคา run`, c.shifts.yuka[k].run, S.yukaRun[i]); cmp(`${d} กะ${k} เชื้อเพลิง run`, c.shifts.fuel[k].run, S.fuelRun[i]) })
  cmp(`${d} รายกะ ยูคา ตัน`, c.shifts.yukaTons, S.yukaTons); cmp(`${d} รายกะ เชื้อเพลิง ตัน`, c.shifts.fuelTons, S.fuelTons)
}
const agg = aggregate(Object.values(calc), byDate, s)
const X = exp.month
cmp('เดือน ยูคา ไม้ท่อนรับเข้า', agg.yuka.logIn, X.yuka.logIn); cmp('เดือน ยูคา รวมสับได้', agg.yuka.total, X.yuka.total); cmp('เดือน ยูคา Silo', agg.yuka.silo, X.yuka.silo)
cmp('เดือน ยูคา kWh', agg.yuka.kwh, X.yuka.kwh); cmp('เดือน ยูคา ค่าไฟ', agg.yuka.elec, X.yuka.elec)
cmp('เดือน ยูคา ค่าแรง+ไฟ/ตัน (T38)', agg.yuka.laborElecPerTon, X.yuka.laborElecPerTon)
cmp('เดือน เชื้อเพลิง ไม้ท่อนรับเข้า', agg.fuel.logIn, X.fuel.logIn); cmp('เดือน เชื้อเพลิง รวมสับได้', agg.fuel.total, X.fuel.total); cmp('เดือน เชื้อเพลิง ค่าไฟ', agg.fuel.elec, X.fuel.elec)
cmp('เดือน เชื้อเพลิง ค่าแรง+ไฟ/ตัน (AH38)', agg.fuel.laborElecPerTon, X.fuel.laborElecPerTon)
cmp('เดือน ขอบบอร์ด สับได้', agg.edge.tons, X.edge.chipped); cmp('เดือน ขอบบอร์ด เบิกใช้', agg.edge.use, X.edge.use)
cmp('เดือน บอร์ด ชั่วโมง', agg.edge.hours, X.board.hours); cmp('เดือน บอร์ด ตัก', agg.edge.scoops, X.board.scoops); cmp('เดือน บอร์ด ตัน', agg.edge.tons, X.board.tons)
cmp('เดือน บอร์ด kWh', agg.edge.kwh, X.board.kwh); cmp('เดือน บอร์ด ค่าไฟ', agg.edge.elec, X.board.elec); cmp('เดือน บอร์ด ค่าแรง', agg.edge.labor, X.board.labor)
cmp('เดือน บอร์ด ค่าดำเนินการ/ตัน', agg.edge.opPerTon, X.board.opPerTon); cmp('เดือน บอร์ด kWh/ตัน', agg.edge.kwhPerTon, X.board.kwhPerTon)
console.log(rows.join('\n'))
console.log(`\nรวม: ผ่าน ${pass} / ไม่ตรง ${fail}`)
writeFileSync('tests/calc-verify-result.txt', rows.join('\n') + `\nผ่าน ${pass} ไม่ตรง ${fail}\n`)
