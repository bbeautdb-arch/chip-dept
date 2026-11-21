const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const TH_DOW_S = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const parse = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)) }
const fmt = (t: Date) => t.toISOString().slice(0, 10)

export function today(): string {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
export const addDays = (d: string, n: number) => { const t = parse(d); t.setUTCDate(t.getUTCDate() + n); return fmt(t) }
export const dow = (d: string) => parse(d).getUTCDay()
export const isWeekend = (d: string) => { const w = dow(d); return w === 0 || w === 6 }
export const monthOf = (d: string) => d.slice(0, 7)
export function daysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number)
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)
}
export const addMonths = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return fmt(t).slice(0, 7) }
export function thDate(d: string, opts: { dow?: boolean; short?: boolean } = {}) {
  const t = parse(d)
  const day = t.getUTCDate(), mo = t.getUTCMonth(), yr = t.getUTCFullYear() + 543
  const s = opts.short ? `${day} ${TH_MON[mo]} ${String(yr).slice(2)}` : `${day} ${TH_MONTHS[mo]} ${yr}`
  return opts.dow ? `วัน${TH_DOW[t.getUTCDay()]}ที่ ${s}` : s
}
export const thDow = (d: string) => TH_DOW_S[dow(d)]
export function thMonth(ym: string) { const [y, m] = ym.split('-').map(Number); return `${TH_MONTHS[m - 1]} ${y + 543}` }
export const dayNum = (d: string) => Number(d.slice(8, 10))
