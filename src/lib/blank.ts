import type { YukaData, FuelData, EdgeData, MetersData, MachinesData, ShiftsData, ShiftData, SectionId, SectionDataMap, Settings, MeterReading } from './types'

export const blankYuka = (): YukaData => ({ chipIn: 0, logIn: 0, chipped: 0, fromStock: 0, fromBig: 0, silo: 0, siloBought: 0, heavyOther: 0, repair: 0, blade: 0, note: '' })
export const blankFuel = (): FuelData => ({
  chipIn: 0, logIn: 0, chipped: 0, fromWaitLog: 0, press1: 0, press2: 0, useBought: 0, useOwn: 0, usePile: 0, usePileBought: 0, pm: 0, cm: 0, note: '',
  safety: { chip: { add: 0, use: 0 }, bark: { add: 0, use: 0 }, edge: { add: 0, use: 0 }, dust: { add: 0, use: 0 }, pulp: { add: 0, use: 0 }, veneer: { add: 0, use: 0 } },
})
export const blankEdge = (s: Settings): EdgeData => ({ hMorning: 0, hAfternoon: 0, hNight: 0, scoops: 0, use: 0, usePile: 0, overChipped: 0, overUse: 0, safetyUse: 0, machineCostPerTon: s.rates.boardMachinePerTon, pm: 0, cm: 0, note: '' })
export const blankReading = (): MeterReading => ({ r08: null, r09: null, r16: null, r20: null, r22: null, r00: null, r08n: null })
export const blankMeters = (s: Settings): MetersData => Object.fromEntries(s.meters.filter((m) => m.active).map((m) => [m.id, blankReading()]))
export const blankMachines = (): MachinesData => ({ loaderLiters: 0, hBoiler: 0, hChip: 0, hEdge: 0, hProd: 0, bhBefore: null, bhAfter: null, bhLiters: 0, bhJob: '', bhToChip: true })
export const blankShift = (): ShiftData => ({ pm: 0, blade: 0, rest: 0, waitWood: 0, breakdown: 0, repair: 0, plan: 0, tons: 0, note: '' })
export const blankShifts = (): ShiftsData => ({
  yuka: { A: blankShift(), B: blankShift(), C: blankShift() },
  fuel: { A: blankShift(), B: blankShift(), C: blankShift() },
})

export function blankFor<S extends SectionId>(section: S, s: Settings): SectionDataMap[S] {
  const m: { [K in SectionId]: () => SectionDataMap[K] } = {
    yuka: blankYuka, fuel: blankFuel, edge: () => blankEdge(s), meters: () => blankMeters(s), machines: blankMachines, shifts: blankShifts,
  }
  return m[section]() as SectionDataMap[S]
}
