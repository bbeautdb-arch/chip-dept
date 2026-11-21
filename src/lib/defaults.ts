import type { Settings, SafetyMat } from './types'

export const SAFETY_MATS: { key: SafetyMat; label: string }[] = [
  { key: 'chip', label: 'ชิพเชื้อเพลิง' },
  { key: 'bark', label: 'เปลือกไม้' },
  { key: 'edge', label: 'ขอบบอร์ด' },
  { key: 'dust', label: 'ฝุ่น' },
  { key: 'pulp', label: 'เยื่อ' },
  { key: 'veneer', label: 'วีเนียร์' },
]

// ค่าเริ่มต้นทั้งหมดมาจากสูตรในไฟล์ Excel เดือน พ.ย. 2569
export const DEFAULT_SETTINGS: Settings = {
  rates: {
    peak: 4.1839,
    off: 2.6037,
    ft: 0.1972,
    demandMonthly: 140375,
    demandDays: 30,
    laborPerLine: 713 * 6 + 1368,
    loaderMonthly: 100000,
    loaderDays: 30,
    loaderFuel: 39.02,
    bhRate: 550,
    bhFuel: 32.93,
    boardElec: 3.5,
    scoopKg: 868,
    boardLaborPerHour: 89.21 * 2 * 1.15,
    boardMachinePerTon: 266,
    planRepairYuka: 7818.393,
    planRepairFuel: 2803.357,
  },
  meters: [
    { id: 'mcc27', name: 'MCC-27 ไลน์ยูคา', mult: 1, inSummary: true, active: true },
    { id: 'mcc28', name: 'MCC-28 ไลน์เชื้อเพลิง', mult: 1, inSummary: true, active: true },
    { id: 'edge', name: 'ไลน์สับขอบบอร์ด', mult: 1, inSummary: true, active: true },
    { id: 'boiler', name: 'Boiler', mult: 1, inSummary: true, active: true },
    { id: 'newTotal', name: 'มิเตอร์ใหม่ รวม', mult: 1, inSummary: false, active: true },
    { id: 'total', name: 'มิเตอร์รวม Wood chip', mult: 640, inSummary: false, active: true },
    { id: 'oldYuka', name: 'ไลน์ยูคา (ตัวเก่า)', mult: 640, inSummary: false, active: true },
    { id: 'oldFuel', name: 'ไลน์เชื้อเพลิง (ตัวเก่า)', mult: 640, inSummary: false, active: true },
  ],
  yukaMeter: 'mcc27',
  fuelMeter: 'mcc28',
  edgeMeter: 'edge',
  ftBase: 'kwh',
  formulaMode: 'fixed',
  costYuka: ['elec', 'labor', 'loader', 'bh', 'ft', 'demand', 'heavyOther', 'repair', 'blade'],
  costFuel: ['elec', 'labor', 'loader', 'repair'],
  holidayOverrides: {},
  opening: {
    date: '2026-11-01',
    yuka: { stockAll: 0, stockBought: 0, stockLog: 0, stockBig: 0 },
    fuel: { stockBought: 0, stockChip: 0, stockLog: 0, stockBigCrane: 0, stockBig1: 0, safety: { chip: 0, bark: 0, edge: 0, dust: 0, pulp: 0, veneer: 0 } },
    edge: { stockEdge: 0, stockOver: 0 },
  },
  staff: [],
  syncUrl: '',
  shiftHours: 8,
}

export const YUKA_COST_LABELS: Record<string, string> = {
  elec: 'ค่าไฟ', labor: 'ค่าแรง', loader: 'Loader', bh: 'แบคโฮ BH', ft: 'ค่า FT', demand: 'Demand charge',
  heavyOther: 'จักรกลหนักอื่น', repair: 'ค่าซ่อม', blade: 'ค่าใบมีด',
}
export const FUEL_COST_LABELS: Record<string, string> = {
  elec: 'ค่าไฟ', labor: 'ค่าแรง', loader: 'Loader', ft: 'ค่า FT', demand: 'Demand charge', repair: 'ค่าซ่อม PM+CM',
}

export const SECTION_LABELS: Record<string, string> = {
  yuka: 'ไม้ยูคา',
  fuel: 'ไม้เชื้อเพลิง',
  edge: 'สับขอบบอร์ด',
  meters: 'มิเตอร์ไฟ',
  machines: 'จักรกลหนัก',
  shifts: 'เวลาเดินเครื่อง',
}
export const SECTIONS = ['yuka', 'fuel', 'edge', 'meters', 'machines', 'shifts'] as const
