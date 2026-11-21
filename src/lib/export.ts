import * as XLSX from 'xlsx'
import type { DayCalc, ByDate } from './calc'
import type { Issue, YukaData, FuelData, EdgeData, MachinesData, ShiftsData, Settings, MetersData } from './types'
import { thDate } from './dates'
import { download } from './download'

const r2 = (n: number | null | undefined, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '' : Math.round(n * 10 ** d) / 10 ** d)

export function buildRows(days: DayCalc[], byDate: ByDate, s: Settings) {
  const summary = days.map((c) => ({
    'วันที่': thDate(c.date, { short: true }),
    'ยูคา สับได้ (ตัน)': r2(c.yuka.total), 'ยูคา ต้นทุน (บ./ตัน)': r2(c.yuka.costPerTon), 'ยูคา แผน (บ./ตัน)': r2(c.yuka.planPerTon),
    'เชื้อเพลิง สับได้ (ตัน)': r2(c.fuel.total), 'เชื้อเพลิง ต้นทุน (บ./ตัน)': r2(c.fuel.costPerTon), 'เชื้อเพลิง แผน (บ./ตัน)': r2(c.fuel.planPerTon),
    'ขอบบอร์ด สับได้ (ตัน)': r2(c.edge.tons, 3), 'ขอบบอร์ด ต้นทุน (บ./ตัน)': r2(c.edge.costPerTon),
    'หน่วยไฟ 4 มิเตอร์ (kWh)': r2(c.summary.kwh, 1), 'ค่าไฟ 4 มิเตอร์ (บาท)': r2(c.summary.baht),
    'รวมทั้งแผนก (ตัน)': r2(c.summary.tons), 'ค่าใช้จ่ายรวม (บาท)': r2(c.summary.cost), 'ต้นทุนเฉลี่ย (บ./ตัน)': r2(c.summary.costPerTon),
  }))
  const by = (c: DayCalc, k: keyof DayCalc['has']) => byDate[c.date]?.[k]?.by ?? ''
  const yuka = days.filter((c) => c.has.yuka).map((c) => {
    const y = byDate[c.date]!.yuka!.data as YukaData
    return {
      'วันที่': thDate(c.date, { short: true }), 'ชิพสับซื้อเข้า': y.chipIn, 'ไม้ท่อนรับเข้า': y.logIn, 'สับได้': y.chipped, 'สับไม้สต๊อก': y.fromStock, 'สับไม้สต๊อกท่อนใหญ่': y.fromBig,
      'รวมสับได้': r2(c.yuka.total), 'หน่วยไฟ (kWh)': r2(c.yuka.kwh, 1), 'kWh/ตัน': r2(c.yuka.kwhPerTon, 3), 'ตักขึ้น Silo': y.silo, 'ชิพซื้อตักขึ้น Silo': y.siloBought,
      'สต๊อกรวม': r2(c.yuka.stockAll), 'สต๊อกชิพซื้อ': r2(c.yuka.stockBought), 'สต๊อกไม้ท่อน': r2(c.yuka.stockLog), 'สต๊อกไม้ท่อนใหญ่': r2(c.yuka.stockBig),
      'ค่าไฟ': r2(c.yuka.elec), 'ค่าแรง': r2(c.yuka.labor), 'Loader': r2(c.yuka.loader), 'BH': r2(c.yuka.bh), 'FT': r2(c.yuka.ft), 'Demand': r2(c.yuka.demand),
      'จักรกลอื่น': y.heavyOther, 'ค่าซ่อม': y.repair, 'ใบมีด': y.blade, 'ต้นทุนผลิต (บ./ตัน)': r2(c.yuka.costPerTon), 'ต้นทุนแผน (บ./ตัน)': r2(c.yuka.planPerTon), 'หมายเหตุ': y.note, 'ผู้บันทึก': by(c, 'yuka'),
    }
  })
  const fuel = days.filter((c) => c.has.fuel).map((c) => {
    const f = byDate[c.date]!.fuel!.data as FuelData
    return {
      'วันที่': thDate(c.date, { short: true }), 'ชิพเชื้อเพลิงซื้อ': f.chipIn, 'ไม้ท่อนรับเข้า': f.logIn, 'สับได้': f.chipped, 'ไม้ท่อนรอสับ': f.fromWaitLog, 'ไม้บีบ 1': f.press1, 'ไม้บีบ 2': f.press2,
      'รวมสับได้': r2(c.fuel.total), 'หน่วยไฟ (kWh)': r2(c.fuel.kwh, 1), 'kWh/ตัน': r2(c.fuel.kwhPerTon, 3),
      'เบิกผลิตชิพซื้อ': f.useBought, 'เบิกผลิตชิพสับเอง': f.useOwn, 'เบิกผลิตกอง': f.usePile, 'เบิกผลิตกอง(ชิพซื้อ)': f.usePileBought,
      'สต๊อกชิพซื้อ': r2(c.fuel.stockBought), 'สต๊อกชิพ': r2(c.fuel.stockChip), 'สต๊อกไม้ท่อน': r2(c.fuel.stockLog), 'ไม้ท่อนใหญ่หน้าเครน': r2(c.fuel.stockBigCrane), 'ไม้ท่อนใหญ่ 1': r2(c.fuel.stockBig1),
      'ค่าไฟ': r2(c.fuel.elec), 'ค่าแรง': r2(c.fuel.labor), 'Loader': r2(c.fuel.loader), 'ค่าซ่อม': r2(c.fuel.repair), 'ต้นทุนผลิต (บ./ตัน)': r2(c.fuel.costPerTon), 'ต้นทุนแผน (บ./ตัน)': r2(c.fuel.planPerTon), 'หมายเหตุ': f.note, 'ผู้บันทึก': by(c, 'fuel'),
    }
  })
  const edge = days.filter((c) => c.has.edge).map((c) => {
    const e = byDate[c.date]!.edge!.data as EdgeData
    return {
      'วันที่': thDate(c.date, { short: true }), 'กะเช้า (ชม.)': e.hMorning, 'กะบ่าย (ชม.)': e.hAfternoon, 'กะดึก (ชม.)': e.hNight, 'รวมชม.': c.edge.hours, 'จำนวนตัก': e.scoops, 'น้ำหนัก (ตัน)': r2(c.edge.tons, 3),
      'kWh': r2(c.edge.kwh, 1), 'ค่าไฟ': r2(c.edge.elec), 'ค่าไฟ/ตัน': r2(c.edge.elecPerTon), 'kWh/ตัน': r2(c.edge.kwhPerTon, 3), 'ค่าแรง': r2(c.edge.labor), 'ค่าแรง/ตัน': r2(c.edge.laborPerTon),
      'ค่าดำเนินการ': r2(c.edge.op), 'ค่าดำเนินการ/ตัน': r2(c.edge.opPerTon), 'ค่าเครื่องจักร/ตัน': e.machineCostPerTon, 'ต้นทุนรวม/ตัน': r2(c.edge.costPerTon),
      'เบิกใช้': e.use, 'เบิกใช้กอง': e.usePile, 'สต๊อกขอบบอร์ดสับ': r2(c.edge.stockEdge, 3), 'สต๊อก Over Size': r2(c.edge.stockOver, 3), 'ปัญหา/แนวทางแก้ไข': e.note, 'ผู้บันทึก': by(c, 'edge'),
    }
  })
  const meters: Record<string, unknown>[] = []
  for (const c of days) {
    const md = byDate[c.date]?.meters?.data as MetersData | undefined
    if (!md) continue
    for (const m of s.meters) {
      const r = md[m.id]; if (!r) continue
      const mc = c.meters[m.id]
      meters.push({ 'วันที่': thDate(c.date, { short: true }), 'มิเตอร์': m.name, '08:00': r.r08 ?? '', '09:00': r.r09 ?? '', '16:00': r.r16 ?? '', '20:00': r.r20 ?? '', '22:00': r.r22 ?? '', '00:00': r.r00 ?? '', '08:00 วันถัดไป': mc.r08n ?? '', 'Peak (kWh)': r2(mc.peak, 1), 'Off-Peak (kWh)': r2(mc.off, 1), 'ค่าไฟ Peak': r2(mc.peakBaht), 'ค่าไฟ Off-Peak': r2(mc.offBaht), 'รวม (บาท)': r2(mc.baht), 'วันหยุด': c.holiday ? 'ใช่' : '' })
    }
  }
  const machines = days.filter((c) => c.has.machines).map((c) => {
    const m = byDate[c.date]!.machines!.data as MachinesData
    return {
      'วันที่': thDate(c.date, { short: true }), 'ค่าเช่า Loader': r2(c.machines.rent), 'น้ำมัน (ลิตร)': m.loaderLiters, 'ค่าน้ำมัน': r2(c.machines.fuel),
      'ชม. Boiler': m.hBoiler, 'ชม. โรงชิพ': m.hChip, 'ชม. สับขอบบอร์ด': m.hEdge, 'ชม. Production': m.hProd,
      'บาท Boiler': r2(c.machines.boiler), 'บาท โรงชิพ': r2(c.machines.chip), 'บาท สับขอบบอร์ด': r2(c.machines.edge), 'บาท Production': r2(c.machines.prod),
      'BH งาน': m.bhJob, 'BH ก่อน': m.bhBefore ?? '', 'BH หลัง': m.bhAfter ?? '', 'BH ชม.': r2(c.machines.bhHours, 1), 'BH น้ำมัน (ลิตร)': m.bhLiters, 'BH รวม (บาท)': r2(c.machines.bhTotal), 'คิดเข้ายูคา': m.bhToChip ? 'ใช่' : 'ไม่', 'ผู้บันทึก': by(c, 'machines'),
    }
  })
  const shifts: Record<string, unknown>[] = []
  for (const c of days) {
    const sd = byDate[c.date]?.shifts?.data as ShiftsData | undefined
    if (!sd) continue
    for (const line of ['yuka', 'fuel'] as const) for (const k of ['A', 'B', 'C'] as const) {
      const x = sd[line][k], sc = c.shifts[line][k]
      shifts.push({ 'วันที่': thDate(c.date, { short: true }), 'ไลน์': line === 'yuka' ? 'ยูคา' : 'เชื้อเพลิง', 'กะ': k, 'PM/5ส': x.pm, 'เปลี่ยนใบมีด': x.blade, 'พัก': x.rest, 'รอไม้': x.waitWood, 'เครื่องเสีย': x.breakdown, 'ซ่อม': x.repair, 'หยุดตามแผน': x.plan, 'เดินเครื่อง': r2(sc.run), 'ยอดไม้ (ตัน)': x.tons, 'ตัน/ชม.': r2(sc.tph), 'หมายเหตุ': x.note })
    }
  }
  return { summary, yuka, fuel, edge, meters, machines, shifts }
}

export function exportXlsx(days: DayCalc[], byDate: ByDate, s: Settings, issues: Issue[], filename: string) {
  const r = buildRows(days, byDate, s)
  const wb = XLSX.utils.book_new()
  const add = (rows: Record<string, unknown>[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'ไม่มีข้อมูล': '' }])
    const keys = Object.keys(rows[0] ?? {})
    ws['!cols'] = keys.map((k) => ({ wch: Math.max(10, Math.min(28, k.length + 2)) }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  add(r.summary, 'สรุปรายวัน'); add(r.yuka, 'ต้นทุนสับไม้ยูคา'); add(r.fuel, 'ต้นทุนสับไม้เชื้อเพลิง'); add(r.edge, 'สับขอบบอร์ด')
  add(r.meters, 'มิเตอร์ไฟฟ้า'); add(r.machines, 'จักรกลหนัก'); add(r.shifts, 'เวลาเดินเครื่องรายกะ')
  add(issues.map((i) => ({ 'วันที่': thDate(i.date, { short: true }), 'Work order': i.wo, 'เครื่อง': i.machine, 'ปัญหา': i.problem, 'สาเหตุ': i.cause, 'วิธีแก้ไข': i.fix, 'ผู้รับผิดชอบ': i.assigned, 'สถานะ': i.status === 'done' ? 'เสร็จแล้ว' : i.status === 'doing' ? 'กำลังทำ' : 'รอดำเนินการ', 'ผู้แจ้ง': i.by })), 'แจ้งปัญหาเครื่องจักร')
  XLSX.writeFile(wb, filename, { compression: true })
}

export function exportCsv(days: DayCalc[], byDate: ByDate, s: Settings, filename: string) {
  const rows = buildRows(days, byDate, s).summary
  const keys = Object.keys(rows[0] ?? { 'วันที่': '' })
  const esc = (v: unknown) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
  const csv = '\ufeff' + [keys.join(','), ...rows.map((r) => keys.map((k) => esc((r as Record<string, unknown>)[k])).join(','))].join('\n')
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename)
}

