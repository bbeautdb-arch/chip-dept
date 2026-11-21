// เครื่องคิดต้นทุนโรงชิพ — สูตรทั้งหมดถอดจากไฟล์ Excel (ดู ANALYSIS.md)
import type { Entry, SectionId, Settings, YukaData, FuelData, EdgeData, MetersData, MachinesData, ShiftsData, MeterReading, ShiftData, SafetyMat } from './types'
import { addDays, isWeekend } from './dates'

export type DayEntries = Partial<{ [K in SectionId]: Entry<K> }>
export type ByDate = Record<string, DayEntries>

function daysInMonthOf(date: string): number {
  const [y, m] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const div = (a: number, b: number): number | null => (b ? a / b : null)
const sum = (...xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

export function isHoliday(date: string, s: Settings): boolean {
  const o = s.holidayOverrides[date]
  if (o !== undefined) return o
  return isWeekend(date)
}

export interface MeterCalc {
  complete: boolean
  peakRaw: number; offRaw: number
  peak: number; off: number; kwh: number
  peakBaht: number; offBaht: number; baht: number
  r08n: number | null
}

export function meterCalc(r: MeterReading | undefined, nextR08: number | null, mult: number, holiday: boolean, s: Settings): MeterCalc {
  const r08 = r?.r08 ?? null, r09 = r?.r09 ?? null, r22 = r?.r22 ?? null
  const r08n = r?.r08n ?? nextR08
  const complete = r08 !== null && r09 !== null && r22 !== null && r08n !== null
  const off1 = r08 !== null && r09 !== null ? r09 - r08 : 0
  const peakRaw = r09 !== null && r22 !== null ? r22 - r09 : 0
  const off2 = r22 !== null && r08n !== null ? r08n - r22 : 0
  let peak = peakRaw * mult
  let off = (off1 + off2) * mult
  if (holiday) { off = (off1 + off2 + peakRaw) * mult; peak = 0 }
  const peakBaht = peak * s.rates.peak
  const offBaht = off * s.rates.off
  return { complete, peakRaw, offRaw: off1 + off2, peak, off, kwh: peak + off, peakBaht, offBaht, baht: peakBaht + offBaht, r08n }
}

export interface MachinesCalc {
  rent: number; fuel: number; hours: number
  boiler: number; chip: number; edge: number; prod: number
  bhHours: number; bhRent: number; bhFuel: number; bhTotal: number; bhToChip: boolean
}
export function machinesCalc(m: MachinesData | undefined, s: Settings): MachinesCalc {
  const R = s.rates
  const rent = R.loaderMonthly / R.loaderDays
  const liters = m?.loaderLiters ?? 0
  const fuel = liters * R.loaderFuel
  const hB = m?.hBoiler ?? 0, hC = m?.hChip ?? 0, hE = m?.hEdge ?? 0, hP = m?.hProd ?? 0
  const hours = hB + hC + hE + hP
  const share = (h: number) => (hours ? (h / hours) * (rent + fuel) : 0)
  const bhHours = m && m.bhAfter !== null && m.bhBefore !== null ? m.bhAfter - m.bhBefore : 0
  const bhRent = bhHours * R.bhRate
  const bhFuel = (m?.bhLiters ?? 0) * R.bhFuel
  return { rent, fuel, hours, boiler: share(hB), chip: share(hC), edge: share(hE), prod: share(hP), bhHours, bhRent, bhFuel, bhTotal: bhRent + bhFuel, bhToChip: m?.bhToChip ?? false }
}

export interface ShiftCalc { run: number; tph: number | null; down: number }
export function shiftCalc(sh: ShiftData | undefined, hours: number): ShiftCalc {
  if (!sh) return { run: 0, tph: null, down: 0 }
  const down = sum(sh.pm, sh.blade, sh.rest, sh.waitWood, sh.breakdown, sh.repair, sh.plan)
  const run = hours - down
  return { run, down, tph: run > 0 ? sh.tons / run : null }
}

export interface YukaCalc {
  total: number; kwh: number; kwhPerTon: number | null
  elec: number; labor: number; loader: number; bh: number; ft: number; demand: number; heavyOther: number; repair: number; blade: number
  cost: number; costPerTon: number | null; planPerTon: number | null
  stockAll: number; stockBought: number; stockLog: number; stockBig: number
}
export interface FuelCalc {
  total: number; kwh: number; kwhPerTon: number | null
  elec: number; labor: number; loader: number; ft: number; demand: number; repair: number
  cost: number; costPerTon: number | null; planPerTon: number | null
  stockBought: number; stockChip: number; stockLog: number; stockBigCrane: number; stockBig1: number
  safety: Record<SafetyMat, number>
}
export interface EdgeCalc {
  hours: number; tons: number; kwh: number; elec: number; labor: number; op: number
  elecPerTon: number | null; laborPerTon: number | null; kwhPerTon: number | null; opPerTon: number | null
  machine: number; cost: number; costPerTon: number | null
  stockEdge: number; stockOver: number
}
export interface DayCalc {
  date: string
  holiday: boolean
  has: Record<SectionId, boolean>
  meters: Record<string, MeterCalc>
  machines: MachinesCalc
  yuka: YukaCalc
  fuel: FuelCalc
  edge: EdgeCalc
  shifts: { yuka: Record<'A' | 'B' | 'C', ShiftCalc>; fuel: Record<'A' | 'B' | 'C', ShiftCalc>; yukaTons: number; fuelTons: number; yukaRun: number; fuelRun: number }
  summary: { kwh: number; baht: number; tons: number; cost: number; costPerTon: number | null }
}

interface Stocks {
  yuka: { stockAll: number; stockBought: number; stockLog: number; stockBig: number }
  fuel: { stockBought: number; stockChip: number; stockLog: number; stockBigCrane: number; stockBig1: number; safety: Record<SafetyMat, number> }
  edge: { stockEdge: number; stockOver: number }
}

function cloneStocks(s: Settings): Stocks {
  const o = s.opening
  return { yuka: { ...o.yuka }, fuel: { ...o.fuel, safety: { ...o.fuel.safety } }, edge: { ...o.edge } }
}

function calcDay(date: string, day: DayEntries, next: DayEntries | undefined, st: Stocks, s: Settings): DayCalc {
  const R = s.rates
  const holiday = isHoliday(date, s)
  const md = day.meters?.data as MetersData | undefined
  const nd = next?.meters?.data as MetersData | undefined
  const meters: Record<string, MeterCalc> = {}
  for (const m of s.meters) {
    meters[m.id] = meterCalc(md?.[m.id], nd?.[m.id]?.r08 ?? null, m.mult, holiday, s)
  }
  const machines = machinesCalc(day.machines?.data as MachinesData | undefined, s)
  const demand = R.demandMonthly / R.demandDays / 2

  // ---- ยูคา
  const y = day.yuka?.data as YukaData | undefined
  const ym = meters[s.yukaMeter]
  const yTotal = y ? y.chipped + y.fromStock + y.fromBig : 0
  const yElec = ym?.baht ?? 0
  const yKwh = ym?.kwh ?? 0
  const yParts = {
    elec: yElec,
    labor: y ? R.laborPerLine : 0,
    loader: machines.chip / 2,
    bh: machines.bhToChip ? machines.bhTotal : 0,
    ft: (s.ftBase === 'baht' ? yElec : yKwh) * R.ft,
    demand: y ? demand : 0,
    heavyOther: y?.heavyOther ?? 0,
    repair: y?.repair ?? 0,
    blade: y?.blade ?? 0,
  }
  const xl = s.formulaMode === 'excel'
  // AC ต้นทุนผลิต = (ค่าไฟ+ค่าแรง+Loader+BH+FT+Demand+จักรกลอื่น+ซ่อม+ใบมีด) / รวมสับได้
  // แบบ Excel เดิม: นับค่าใบมีด (AA) ซ้ำ 2 ครั้ง
  const yCost = s.costYuka.reduce((a, k) => a + yParts[k], 0) + (xl && s.costYuka.includes('blade') ? yParts.blade : 0)
  // AB ค่าใช้จ่ายรวม = Loader+ค่าไฟ+ค่าแรง+ซ่อม+FT+Demand+จักรกลอื่น ; AE แผน = (AB + แผนซ่อม AD) / รวมสับได้ (G)
  // แบบ Excel เดิม: AB นับค่าซ่อม (Z) ซ้ำ 2 ครั้ง และหารด้วย "สับได้ (ไม้รับเข้า)" (D) แทนรวมสับได้
  const yAB = s.costYuka.filter((k) => k !== 'blade' && k !== 'bh').reduce((a, k) => a + yParts[k], 0) + (xl && s.costYuka.includes('repair') ? yParts.repair : 0)
  const yPlan = yAB + (y ? R.planRepairYuka : 0)
  const yPlanDen = xl ? (y?.chipped ?? 0) : yTotal
  if (y) {
    st.yuka.stockAll += yTotal - y.silo
    st.yuka.stockBought += y.chipIn - y.siloBought
    st.yuka.stockLog += y.logIn - y.chipped - y.fromStock
    st.yuka.stockBig -= y.fromBig
  }
  const yuka: YukaCalc = {
    total: yTotal, kwh: yKwh, kwhPerTon: div(yKwh, yTotal), ...yParts,
    cost: yCost, costPerTon: div(yCost, yTotal), planPerTon: div(yPlan, yPlanDen), ...st.yuka,
  }

  // ---- เชื้อเพลิง
  const f = day.fuel?.data as FuelData | undefined
  const fm = meters[s.fuelMeter]
  const fTotal = f ? f.chipped + f.fromWaitLog + f.press1 + f.press2 : 0
  const fElec = fm?.baht ?? 0
  const fKwh = fm?.kwh ?? 0
  const fParts = {
    elec: fElec,
    labor: f ? R.laborPerLine : 0,
    loader: machines.chip / 2,
    ft: (s.ftBase === 'baht' ? fElec : fKwh) * R.ft,
    demand: f ? demand : 0,
    repair: f ? f.pm + f.cm : 0,
  }
  const fCost = s.costFuel.reduce((a, k) => a + fParts[k], 0)
  if (f) {
    st.fuel.stockBought += f.chipIn - f.usePileBought
    // AC สต๊อกชิพสับเอง = ก่อนหน้า + D+E+F+G − M ; แบบ Excel เดิม: แถววันแรก (AC4) ขาด F,G และแถวอื่นขาด G
    st.fuel.stockChip += (xl ? f.chipped + f.fromWaitLog + (date === s.opening.date ? 0 : f.press1) : fTotal) - f.usePile
    st.fuel.stockLog += f.logIn - f.chipped - f.fromWaitLog
    st.fuel.stockBigCrane -= f.press2
    st.fuel.stockBig1 -= f.press1
    for (const k of Object.keys(st.fuel.safety) as SafetyMat[]) {
      const x = f.safety?.[k]
      if (x) st.fuel.safety[k] += x.add - x.use
    }
  }
  // AP ค่าใช้จ่ายรวม = ค่าไฟ+ค่าซ่อม(PM+CM)+ค่าแรง ; AS แผน = (AP + แผนซ่อม AR) / รวมสับได้
  // แบบ Excel เดิม: AP บวก "สต๊อกไม้ท่อนใหญ่ 1" (AF เป็นตัน) เข้าไปเป็นเงินด้วย
  const fAP = s.costFuel.filter((k) => k !== 'loader').reduce((a, k) => a + fParts[k], 0) + (xl && f ? st.fuel.stockBig1 : 0)
  const fPlan = fAP + (f ? R.planRepairFuel : 0)
  const fuel: FuelCalc = {
    total: fTotal, kwh: fKwh, kwhPerTon: div(fKwh, fTotal), ...fParts,
    cost: fCost, costPerTon: div(fCost, fTotal), planPerTon: div(fPlan, fTotal),
    stockBought: st.fuel.stockBought, stockChip: st.fuel.stockChip, stockLog: st.fuel.stockLog,
    stockBigCrane: st.fuel.stockBigCrane, stockBig1: st.fuel.stockBig1, safety: { ...st.fuel.safety },
  }

  // ---- ขอบบอร์ด (สูตรจากไฟล์ สรุปต้นทุนสับบอร์ด)
  const e = day.edge?.data as EdgeData | undefined
  const er = md?.[s.edgeMeter]
  const eMult = s.meters.find((m) => m.id === s.edgeMeter)?.mult ?? 1
  const er08n = er?.r08n ?? nd?.[s.edgeMeter]?.r08 ?? null
  const eKwh = er && er.r08 !== null && er08n !== null ? (er08n - er.r08) * eMult : 0
  const eHours = e ? e.hMorning + e.hAfternoon + e.hNight : 0
  const eTons = e ? (e.scoops * R.scoopKg) / 1000 : 0
  const eElec = e ? eKwh * R.boardElec : 0
  const eLabor = eHours * R.boardLaborPerHour
  const eOp = eElec + eLabor + (e ? e.pm + e.cm : 0)
  const eMachine = e ? eTons * e.machineCostPerTon : 0
  if (e) {
    st.edge.stockEdge += eTons - e.use - e.usePile
    st.edge.stockOver += e.overChipped - e.overUse
  }
  const opPerTon = div(eOp, eTons)
  const edge: EdgeCalc = {
    hours: eHours, tons: eTons, kwh: e ? eKwh : 0, elec: eElec, labor: eLabor, op: eOp,
    elecPerTon: div(eElec, eTons), laborPerTon: div(eLabor, eTons), kwhPerTon: div(e ? eKwh : 0, eTons), opPerTon,
    machine: eMachine, cost: eOp + eMachine, costPerTon: e && eTons ? (opPerTon ?? 0) + e.machineCostPerTon : null, ...st.edge,
  }

  // ---- รายกะ
  const sd = day.shifts?.data as ShiftsData | undefined
  const H = s.shiftHours
  const sc = (line: 'yuka' | 'fuel') => ({
    A: shiftCalc(sd?.[line].A, H), B: shiftCalc(sd?.[line].B, H), C: shiftCalc(sd?.[line].C, H),
  })
  const sy = sc('yuka'), sf = sc('fuel')
  const tons = (line: 'yuka' | 'fuel') => (sd ? sd[line].A.tons + sd[line].B.tons + sd[line].C.tons : 0)

  let kwh = 0, baht = 0
  for (const m of s.meters) if (m.inSummary) { kwh += meters[m.id].kwh; baht += meters[m.id].baht }
  const dTons = yTotal + fTotal + eTons
  const dCost = yCost + fCost + edge.cost
  return {
    date, holiday,
    has: { yuka: !!day.yuka, fuel: !!day.fuel, edge: !!day.edge, meters: !!day.meters, machines: !!day.machines, shifts: !!day.shifts },
    meters, machines, yuka, fuel, edge,
    shifts: { yuka: sy, fuel: sf, yukaTons: tons('yuka'), fuelTons: tons('fuel'), yukaRun: sy.A.run + sy.B.run + sy.C.run, fuelRun: sf.A.run + sf.B.run + sf.C.run },
    summary: { kwh, baht, tons: dTons, cost: dCost, costPerTon: div(dCost, dTons) },
  }
}

/** คำนวณทุกวันตั้งแต่วันยกยอด (opening.date) ถึง until เพื่อให้สต๊อกยกไปถูกต้อง */
export function computeAll(byDate: ByDate, s: Settings, until: string): Record<string, DayCalc> {
  const out: Record<string, DayCalc> = {}
  const st = cloneStocks(s)
  let d = s.opening.date
  let guard = 0
  while (d <= until && guard++ < 4000) {
    out[d] = calcDay(d, byDate[d] ?? {}, byDate[addDays(d, 1)], st, s)
    d = addDays(d, 1)
  }
  return out
}

export interface MonthAgg {
  days: DayCalc[]
  yuka: { logIn: number; total: number; silo: number; kwh: number; elec: number; labor: number; ft: number; cost: number; costPerTon: number | null; planPerTon: number | null; laborElecPerTon: number | null; plan: number }
  fuel: { logIn: number; total: number; kwh: number; elec: number; labor: number; ft: number; cost: number; costPerTon: number | null; planPerTon: number | null; laborElecPerTon: number | null; plan: number }
  edge: { hours: number; scoops: number; tons: number; kwh: number; elec: number; labor: number; op: number; opPerTon: number | null; kwhPerTon: number | null; cost: number; costPerTon: number | null; use: number }
  kwh: number; baht: number; tons: number; cost: number; costPerTon: number | null
}

export function aggregate(days: DayCalc[], byDate: ByDate, s?: Settings): MonthAgg {
  const a = (f: (d: DayCalc) => number) => days.reduce((x, d) => x + f(d), 0)
  // ค่าแรงรวมเดือน: นับเฉพาะวันที่มีการลงค่า ; แบบ Excel เดิม: นับทุกแถวในชีต (1 ของเดือน ถึง 1 ของเดือนถัดไป) รวมวันที่ยังไม่มาถึง
  const xlRows = s?.formulaMode === 'excel' && days.length ? daysInMonthOf(days[0].date) + 1 : 0
  const laborY = xlRows ? xlRows * s!.rates.laborPerLine : a((d) => d.yuka.labor)
  const laborF = xlRows ? xlRows * s!.rates.laborPerLine : a((d) => d.fuel.labor)
  const yLog = days.reduce((x, d) => x + ((byDate[d.date]?.yuka?.data as YukaData | undefined)?.logIn ?? 0), 0)
  const fLog = days.reduce((x, d) => x + ((byDate[d.date]?.fuel?.data as FuelData | undefined)?.logIn ?? 0), 0)
  const silo = days.reduce((x, d) => x + ((byDate[d.date]?.yuka?.data as YukaData | undefined)?.silo ?? 0), 0)
  const scoops = days.reduce((x, d) => x + ((byDate[d.date]?.edge?.data as EdgeData | undefined)?.scoops ?? 0), 0)
  const eUse = days.reduce((x, d) => x + ((byDate[d.date]?.edge?.data as EdgeData | undefined)?.use ?? 0), 0)
  const yTotal = a((d) => d.yuka.total), fTotal = a((d) => d.fuel.total), eTons = a((d) => d.edge.tons)
  const yCost = a((d) => d.yuka.cost), fCost = a((d) => d.fuel.cost)
  const yPlan = a((d) => (d.yuka.planPerTon ?? 0) * d.yuka.total), fPlan = a((d) => (d.fuel.planPerTon ?? 0) * d.fuel.total)
  const yLE = laborY + a((d) => d.yuka.elec), fLE = laborF + a((d) => d.fuel.elec)
  const eOp = a((d) => d.edge.op), eCost = a((d) => d.edge.cost), eKwh = a((d) => d.edge.kwh)
  const tons = yTotal + fTotal + eTons, cost = yCost + fCost + eCost
  return {
    days,
    yuka: { logIn: yLog, total: yTotal, silo, kwh: a((d) => d.yuka.kwh), elec: a((d) => d.yuka.elec), labor: laborY, ft: a((d) => d.yuka.ft), cost: yCost, costPerTon: div(yCost, yTotal), planPerTon: div(yPlan, yTotal), laborElecPerTon: div(yLE, yLog), plan: yPlan },
    fuel: { logIn: fLog, total: fTotal, kwh: a((d) => d.fuel.kwh), elec: a((d) => d.fuel.elec), labor: laborF, ft: a((d) => d.fuel.ft), cost: fCost, costPerTon: div(fCost, fTotal), planPerTon: div(fPlan, fTotal), laborElecPerTon: div(fLE, fTotal), plan: fPlan },
    edge: { hours: a((d) => d.edge.hours), scoops, tons: eTons, kwh: eKwh, elec: a((d) => d.edge.elec), labor: a((d) => d.edge.labor), op: eOp, opPerTon: div(eOp, eTons), kwhPerTon: div(eKwh, eTons), cost: eCost, costPerTon: div(eCost, eTons), use: eUse },
    kwh: a((d) => d.summary.kwh), baht: a((d) => d.summary.baht), tons, cost, costPerTon: div(cost, tons),
  }
}
