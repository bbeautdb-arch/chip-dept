import type { Entry, Issue, Opening, SectionId, Settings } from './types'
import type { ByDate } from './calc'

export interface SeedFile {
  source: string
  holidays: string[]
  opening: Opening
  entries: { date: string; section: SectionId; data: unknown; by: string }[]
  issues: Omit<Issue, 'id' | 'updatedAt'>[]
}

export function seedToEntries(seed: SeedFile, device = 'excel'): Entry[] {
  const t = Date.UTC(2026, 10, 17)
  return seed.entries.map((e) => ({ id: `${e.date}|${e.section}`, date: e.date, section: e.section, data: e.data as never, by: e.by, updatedAt: t, device }))
}

export function applySeedSettings(seed: SeedFile, s: Settings): Settings {
  return { ...s, opening: seed.opening }
}

export function groupByDate(entries: Entry[]): ByDate {
  const out: ByDate = {}
  for (const e of entries) {
    const d = (out[e.date] ??= {}) as Record<string, Entry>
    d[e.section] = e
  }
  return out
}
