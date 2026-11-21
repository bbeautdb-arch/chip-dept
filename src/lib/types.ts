export type SectionId = 'yuka' | 'fuel' | 'edge' | 'meters' | 'machines' | 'shifts'

export interface YukaData {
  chipIn: number; logIn: number; chipped: number; fromStock: number; fromBig: number
  silo: number; siloBought: number; heavyOther: number; repair: number; blade: number; note: string
}
export type SafetyMat = 'chip' | 'bark' | 'edge' | 'dust' | 'pulp' | 'veneer'
export interface FuelData {
  chipIn: number; logIn: number; chipped: number; fromWaitLog: number; press1: number; press2: number
  useBought: number; useOwn: number; usePile: number; usePileBought: number
  pm: number; cm: number; note: string
  safety: Record<SafetyMat, { add: number; use: number }>
}
export interface EdgeData {
  hMorning: number; hAfternoon: number; hNight: number; scoops: number
  use: number; usePile: number; overChipped: number; overUse: number; safetyUse: number
  machineCostPerTon: number; pm: number; cm: number; note: string
}
export interface MeterReading {
  r08: number | null; r09: number | null; r16: number | null; r20: number | null
  r22: number | null; r00: number | null; r08n: number | null
}
export type MetersData = Record<string, MeterReading>
export interface MachinesData {
  loaderLiters: number; hBoiler: number; hChip: number; hEdge: number; hProd: number
  bhBefore: number | null; bhAfter: number | null; bhLiters: number; bhJob: string; bhToChip: boolean
}
export interface ShiftData {
  pm: number; blade: number; rest: number; waitWood: number; breakdown: number; repair: number; plan: number
  tons: number; note: string
}
export type ShiftKey = 'A' | 'B' | 'C'
export interface ShiftsData { yuka: Record<ShiftKey, ShiftData>; fuel: Record<ShiftKey, ShiftData> }

export interface SectionDataMap {
  yuka: YukaData; fuel: FuelData; edge: EdgeData; meters: MetersData; machines: MachinesData; shifts: ShiftsData
}

export interface Entry<S extends SectionId = SectionId> {
  id: string // `${date}|${section}`
  date: string // YYYY-MM-DD
  section: S
  data: SectionDataMap[S]
  by: string
  updatedAt: number
  device: string
}

export interface Issue {
  id: string
  date: string
  wo: string
  machine: string
  problem: string
  cause: string
  fix: string
  status: 'open' | 'doing' | 'done'
  assigned: string
  by: string
  updatedAt: number
}

export interface MeterDef { id: string; name: string; mult: number; inSummary: boolean; active: boolean }

export type YukaCostKey = 'elec' | 'labor' | 'loader' | 'bh' | 'ft' | 'demand' | 'heavyOther' | 'repair' | 'blade'
export type FuelCostKey = 'elec' | 'labor' | 'loader' | 'ft' | 'demand' | 'repair'

export interface Rates {
  peak: number; off: number; ft: number
  demandMonthly: number; demandDays: number
  laborPerLine: number
  loaderMonthly: number; loaderDays: number; loaderFuel: number
  bhRate: number; bhFuel: number
  boardElec: number; scoopKg: number; boardLaborPerHour: number; boardMachinePerTon: number
  planRepairYuka: number; planRepairFuel: number
}

export interface Opening {
  date: string
  yuka: { stockAll: number; stockBought: number; stockLog: number; stockBig: number }
  fuel: { stockBought: number; stockChip: number; stockLog: number; stockBigCrane: number; stockBig1: number; safety: Record<SafetyMat, number> }
  edge: { stockEdge: number; stockOver: number }
}

export interface Settings {
  rates: Rates
  meters: MeterDef[]
  yukaMeter: string
  fuelMeter: string
  edgeMeter: string
  ftBase: 'baht' | 'kwh'
  /** 'fixed' = แก้สูตรที่ผิดใน Excel แล้ว (ค่าเริ่มต้น) · 'excel' = คำนวณเหมือนไฟล์ Excel เดิมทุกจุด */
  formulaMode: 'fixed' | 'excel'
  costYuka: YukaCostKey[]
  costFuel: FuelCostKey[]
  holidayOverrides: Record<string, boolean>
  opening: Opening
  staff: string[]
  syncUrl: string
  shiftHours: number
}
