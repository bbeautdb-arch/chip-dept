// กราฟ SVG น้ำหนักเบา อ่านง่าย (แท่ง = ปริมาณ, เส้น = ต้นทุน/ตัน, เส้นประ = แผน)
import { useEffect, useId, useRef, useState } from 'react'

export interface Series { label: string; values: (number | null)[]; color: string; dashed?: boolean }

const nice = (max: number) => {
  if (max <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(max)))
  const m = max / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}
const short = (n: number) => (Math.abs(n) >= 1000 ? (n / 1000).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + 'k' : n.toLocaleString('th-TH', { maximumFractionDigits: 1 }))

export function ComboChart({ labels, bars = [], lines = [], barUnit, lineUnit, height = 240, stacked }: {
  labels: string[]; bars?: Series[]; lines?: Series[]; barUnit?: string; lineUnit?: string; height?: number; stacked?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLElement>(null)
  const [cw, setCw] = useState(720)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setCw(Math.max(280, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = cw, H = Math.round(Math.min(height, Math.max(200, cw * 0.62))), L = 44, Rr = lines.length ? 48 : 12, T = 18, B = 28
  const iw = W - L - Rr, ih = H - T - B
  const n = Math.max(labels.length, 1)
  const bw = iw / n
  const barMax = nice(Math.max(0, ...labels.map((_, i) => (stacked ? bars.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(0, ...bars.map((s) => s.values[i] ?? 0))))))
  const lineVals = lines.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))
  const lineMax = nice(Math.max(0, ...lineVals))
  const yb = (v: number) => T + ih - (v / barMax) * ih
  const yl = (v: number) => T + ih - (v / lineMax) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const step = Math.ceil(n / Math.max(4, Math.floor(iw / 30)))
  return (
    <figure style={{ margin: 0 }} ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-labelledby={id}>
        <title id={id}>{[...bars, ...lines].map((s) => s.label).join(', ')}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - Rr} y1={T + ih * (1 - t)} y2={T + ih * (1 - t)} stroke="#e3e7ee" />
            {bars.length > 0 && <text x={L - 6} y={T + ih * (1 - t) + 4} textAnchor="end" fontSize="12" fill="#6a768b">{short(barMax * t)}</text>}
            {lines.length > 0 && <text x={W - Rr + 6} y={T + ih * (1 - t) + 4} fontSize="12" fill="#6a768b">{short(lineMax * t)}</text>}
          </g>
        ))}
        {barUnit && bars.length > 0 && <text x={4} y={11} fontSize="12" fill="#6a768b">{barUnit}</text>}
        {lineUnit && lines.length > 0 && <text x={W - 4} y={11} fontSize="12" fill="#6a768b" textAnchor="end">{lineUnit}</text>}
        {labels.map((lab, i) => {
          const x0 = L + i * bw
          let acc = 0
          return (
            <g key={i}>
              {bars.map((s, k) => {
                const v = s.values[i] ?? 0
                if (stacked) {
                  const y1 = yb(acc + v), y0 = yb(acc); acc += v
                  return <rect key={k} x={x0 + bw * 0.18} width={bw * 0.64} y={y1} height={Math.max(0, y0 - y1)} fill={s.color} rx={k === bars.length - 1 ? 3 : 0} />
                }
                const w = (bw * 0.7) / bars.length
                return <rect key={k} x={x0 + bw * 0.15 + k * w} width={w - 1} y={yb(v)} height={Math.max(0, T + ih - yb(v))} fill={s.color} rx={3} />
              })}
              {i % step === 0 && <text x={x0 + bw / 2} y={H - 10} textAnchor="middle" fontSize="12" fill="#6a768b">{lab}</text>}
            </g>
          )
        })}
        {lines.map((s, k) => {
          const pts = s.values.map((v, i) => (v === null || !Number.isFinite(v) ? null : [L + i * bw + bw / 2, yl(v)] as const))
          const segs: string[] = []
          let cur = ''
          pts.forEach((p) => { if (!p) { if (cur) segs.push(cur); cur = ''; return } cur += (cur ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) })
          if (cur) segs.push(cur)
          return (
            <g key={k}>
              {segs.map((d, j) => <path key={j} d={d} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" />)}
              {!s.dashed && pts.map((p, j) => p && <circle key={j} cx={p[0]} cy={p[1]} r={3.2} fill="#fff" stroke={s.color} strokeWidth={2} />)}
            </g>
          )
        })}
      </svg>
      <figcaption className="legend">
        {bars.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}
        {lines.map((s) => <span key={s.label}><i className="line" style={{ background: s.dashed ? `repeating-linear-gradient(90deg, ${s.color} 0 5px, transparent 5px 9px)` : s.color }} />{s.label}</span>)}
      </figcaption>
    </figure>
  )
}

export function HBars({ items, unit }: { items: { label: string; value: number; color?: string }[]; unit?: string }) {
  const max = Math.max(1e-9, ...items.map((i) => i.value))
  return (
    <div className="stack" style={{ display: 'grid', gap: 8 }}>
      {items.map((i) => (
        <div key={i.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
            <span>{i.label}</span>
            <b className="num">{i.value.toLocaleString('th-TH', { maximumFractionDigits: 1 })} {unit}</b>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: '#e8ecf2', overflow: 'hidden' }}>
            <div style={{ width: `${(i.value / max) * 100}%`, height: '100%', background: i.color ?? '#2b4f8f', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
