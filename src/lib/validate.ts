// ตรวจค่าผิดปกติระหว่างลงข้อมูล: เทียบกับค่ากลาง 14 วันก่อนหน้า, ค่าติดลบ, มิเตอร์ถอยหลัง, ชั่วโมงเกินกะ
import type { SectionId, Settings, MetersData, ShiftsData, ShiftKey } from './types'
import type { ByDate, DayCalc } from './calc'
import { addDays } from './dates'
import { shiftCalc } from './calc'

export interface Flag { level: 'error' | 'warn'; msg: string }
export type Flags = Record<string, Flag>

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}
function median(xs: number[]) {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
export function history(byDate: ByDate, section: SectionId, date: string, path: string, days = 14): number[] {
  const out: number[] = []
  for (let i = 1; i <= days; i++) {
    const v = get(byDate[addDays(date, -i)]?.[section]?.data, path)
    if (typeof v === 'number' && v > 0) out.push(v)
  }
  return out
}

const LABELS: Record<string, string> = {
  chipIn: 'ชิพซื้อเข้า', logIn: 'ไม้ท่อนรับเข้า', chipped: 'สับได้', fromStock: 'สับไม้สต๊อก', fromBig: 'สับไม้ท่อนใหญ่', silo: 'ตักขึ้น Silo', siloBought: 'ชิพซื้อขึ้น Silo',
  heavyOther: 'จักรกลอื่น', repair: 'ค่าซ่อม', blade: 'ค่าใบมีด', fromWaitLog: 'สับไม้รอสับ', press1: 'ไม้บีบ 1', press2: 'ไม้บีบ 2', useBought: 'เบิกชิพซื้อ', useOwn: 'เบิกชิพสับเอง',
  usePile: 'เบิกผลิตกอง', usePileBought: 'เบิกกอง(ชิพซื้อ)', pm: 'ซ่อม PM', cm: 'ซ่อม CM', hMorning: 'ชม.กะเช้า', hAfternoon: 'ชม.กะบ่าย', hNight: 'ชม.กะดึก', scoops: 'จำนวนตัก',
  use: 'เบิกใช้', overChipped: 'Over Size', overUse: 'เบิก Over Size', safetyUse: 'เบิก Safety', loaderLiters: 'น้ำมัน Loader', hBoiler: 'ชม. Boiler', hChip: 'ชม. โรงชิพ', hEdge: 'ชม. ขอบบอร์ด',
  hProd: 'ชม. Production', bhLiters: 'น้ำมัน BH', bhBefore: 'BH เลขก่อน', bhAfter: 'BH เลขหลัง',
}
export function fieldLabel(path: string, s: Settings): string {
  if (LABELS[path]) return LABELS[path]
  const parts = path.split('.')
  const m = s.meters.find((x) => x.id === parts[0])
  if (m) return `มิเตอร์ ${m.name}`
  if (parts[0] === 'yuka' || parts[0] === 'fuel') return `${parts[0] === 'yuka' ? 'ยูคา' : 'เชื้อเพลิง'} กะ ${parts[1]}`
  return path
}

const NUM_FIELDS: Partial<Record<SectionId, string[]>> = {
  yuka: ['chipIn', 'logIn', 'chipped', 'fromStock', 'fromBig', 'silo', 'siloBought', 'heavyOther', 'repair', 'blade'],
  fuel: ['chipIn', 'logIn', 'chipped', 'fromWaitLog', 'press1', 'press2', 'useBought', 'useOwn', 'usePile', 'usePileBought', 'pm', 'cm'],
  edge: ['hMorning', 'hAfternoon', 'hNight', 'scoops', 'use', 'usePile', 'overChipped', 'overUse', 'safetyUse', 'pm', 'cm'],
  machines: ['loaderLiters', 'hBoiler', 'hChip', 'hEdge', 'hProd', 'bhLiters'],
}

export function validate(section: SectionId, data: unknown, date: string, byDate: ByDate, s: Settings, calc?: DayCalc): Flags {
  const f: Flags = {}
  for (const p of NUM_FIELDS[section] ?? []) {
    const v = get(data, p)
    if (typeof v !== 'number') continue
    if (v < 0) { f[p] = { level: 'error', msg: 'ค่าติดลบ' }; continue }
    const h = history(byDate, section, date, p)
    const med = median(h)
    if (med && h.length >= 3 && v > 0) {
      if (v > med * 2.5) f[p] = { level: 'warn', msg: `สูงกว่าปกติ (ปกติราว ${med.toLocaleString('th-TH', { maximumFractionDigits: 1 })})` }
      else if (v < med * 0.3) f[p] = { level: 'warn', msg: `ต่ำกว่าปกติ (ปกติราว ${med.toLocaleString('th-TH', { maximumFractionDigits: 1 })})` }
    }
  }
  if (section === 'edge') {
    const e = data as { hMorning: number; hAfternoon: number; hNight: number }
    for (const k of ['hMorning', 'hAfternoon', 'hNight'] as const) if (e[k] > s.shiftHours) f[k] = { level: 'error', msg: `เกิน ${s.shiftHours} ชม.ต่อกะ` }
  }
  if (section === 'machines') {
    const m = data as { bhBefore: number | null; bhAfter: number | null; hBoiler: number; hChip: number; hEdge: number; hProd: number; loaderLiters: number }
    if (m.bhBefore !== null && m.bhAfter !== null && m.bhAfter < m.bhBefore) f.bhAfter = { level: 'error', msg: 'เลขหลังน้อยกว่าเลขก่อน' }
    if (m.bhAfter !== null && m.bhBefore !== null && m.bhAfter - m.bhBefore > 24) f.bhAfter = { level: 'error', msg: 'เกิน 24 ชม.' }
    const prev = byDate[addDays(date, -1)]?.machines?.data as { bhAfter: number | null } | undefined
    if (prev?.bhAfter != null && m.bhBefore !== null && Math.abs(prev.bhAfter - m.bhBefore) > 0.05) f.bhBefore = { level: 'warn', msg: `ไม่ตรงกับเลขหลังเมื่อวาน (${prev.bhAfter})` }
    if (m.loaderLiters > 0 && m.hBoiler + m.hChip + m.hEdge + m.hProd === 0) f.hChip = { level: 'warn', msg: 'มีน้ำมันแต่ไม่มีชั่วโมงใช้งาน ค่าใช้จ่าย Loader จะแบ่งไม่ได้' }
  }
  if (section === 'meters') {
    const md = data as MetersData
    const prev = byDate[addDays(date, -1)]?.meters?.data as MetersData | undefined
    for (const [id, r] of Object.entries(md)) {
      const seq: [string, number | null][] = [['r08', r.r08], ['r09', r.r09], ['r16', r.r16], ['r20', r.r20], ['r22', r.r22], ['r00', r.r00], ['r08n', r.r08n]]
      let last: number | null = null
      for (const [k, v] of seq) {
        if (v === null) continue
        if (last !== null && v < last) f[`${id}.${k}`] = { level: 'error', msg: 'เลขน้อยกว่าเวลาก่อนหน้า (มิเตอร์ถอยหลัง)' }
        last = v
      }
      const p = prev?.[id]?.r08n ?? null
      if (p !== null && r.r08 !== null && Math.abs(p - r.r08) > 0.001) f[`${id}.r08`] = { level: 'warn', msg: `ไม่ตรงกับ 08:00 ที่จดเมื่อวาน (${p})` }
      const c = calc?.meters[id]
      const mult = s.meters.find((m) => m.id === id)?.mult ?? 1
      if (c && c.complete) {
        const h: number[] = []
        for (let i = 1; i <= 14; i++) {
          const pr = byDate[addDays(date, -i)]?.meters?.data as MetersData | undefined
          const x = pr?.[id]
          if (x && x.r08 !== null && x.r08n !== null) { const k = (x.r08n - x.r08) * mult; if (k > 0) h.push(k) }
        }
        const med = median(h)
        if (med && h.length >= 3 && c.kwh > med * 2.5) f[`${id}.r08n`] ??= { level: 'warn', msg: `หน่วยไฟวันนี้สูงผิดปกติ (${Math.round(c.kwh)} kWh, ปกติราว ${Math.round(med)})` }
      }
    }
  }
  if (section === 'shifts') {
    const sd = data as ShiftsData
    for (const line of ['yuka', 'fuel'] as const)
      for (const k of ['A', 'B', 'C'] as ShiftKey[]) {
        const c = shiftCalc(sd[line][k], s.shiftHours)
        if (c.run < 0) f[`${line}.${k}.run`] = { level: 'error', msg: `เวลาหยุดรวมเกิน ${s.shiftHours} ชม. (เดินเครื่องติดลบ ${c.run.toFixed(2)} ชม.)` }
        if (sd[line][k].tons > 0 && c.run === 0) f[`${line}.${k}.run`] = { level: 'warn', msg: 'มียอดไม้แต่ไม่มีเวลาเดินเครื่อง' }
      }
  }
  if (calc) {
    if (section === 'yuka' && calc.yuka.stockLog < -0.001) f.logIn ??= { level: 'warn', msg: `สต๊อกไม้ท่อนติดลบ (${calc.yuka.stockLog.toFixed(2)} ตัน)` }
    if (section === 'fuel' && calc.fuel.stockLog < -0.001) f.logIn ??= { level: 'warn', msg: `สต๊อกไม้ท่อนติดลบ (${calc.fuel.stockLog.toFixed(2)} ตัน)` }
    if (section === 'edge' && calc.edge.stockEdge < -0.001) f.use ??= { level: 'warn', msg: `สต๊อกขอบบอร์ดติดลบ (${calc.edge.stockEdge.toFixed(2)} ตัน)` }
  }
  return f
}

/** รายการค่าผิดปกติของทั้งวัน (ใช้ในรายงาน/หน้าแรก) */
export function dayAnomalies(c: DayCalc, byDate: ByDate, s: Settings): { section: SectionId; level: Flag['level']; msg: string }[] {
  const out: { section: SectionId; level: Flag['level']; msg: string }[] = []
  for (const sec of ['yuka', 'fuel', 'edge', 'meters', 'machines', 'shifts'] as SectionId[]) {
    const e = byDate[c.date]?.[sec]
    if (!e) continue
    const fl = validate(sec, e.data, c.date, byDate, s, c)
    for (const [k, v] of Object.entries(fl)) out.push({ section: sec, level: v.level, msg: `${fieldLabel(k, s)}: ${v.msg}` })
  }
  return out
}
