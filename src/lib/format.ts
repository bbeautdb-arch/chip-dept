export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  if (Math.abs(n) < 0.5 * 10 ** -digits) n = 0
  return n.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export const fmt0 = (n: number | null | undefined) => fmt(n, 0)
export const fmt1 = (n: number | null | undefined) => fmt(n, 1)
export function timeTh(ms: number) {
  const d = new Date(ms)
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
