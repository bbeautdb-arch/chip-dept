import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Flag } from '../lib/validate'

function toStr(v: number | null | undefined) { return v === null || v === undefined || (v === 0) ? '' : String(v) }

export function NumField({ label, value, onChange, unit, flag, sub, id, wide, allowNull, placeholder }: {
  label: ReactNode; value: number | null; onChange: (v: number | null) => void; unit?: string; flag?: Flag; sub?: ReactNode; id?: string; wide?: boolean; allowNull?: boolean; placeholder?: string
}) {
  const [s, setS] = useState(() => (allowNull ? (value === null ? '' : String(value)) : toStr(value)))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) { setS(allowNull ? (value === null ? '' : String(value)) : toStr(value)); last.current = value }
  }, [value, allowNull])
  return (
    <div className={`field ${flag ? flag.level : ''} ${wide ? 'wide' : ''}`} data-field={id}>
      <label htmlFor={id}>{label}</label>
      <div className="box">
        <input
          id={id}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          className="num"
          value={s}
          placeholder={placeholder ?? (allowNull ? '' : '0')}
          onChange={(e) => {
            const raw = e.target.value.replace(/,/g, '').replace(/[^\d.-]/g, '')
            setS(raw)
            const n = raw === '' || raw === '-' || raw === '.' ? (allowNull ? null : 0) : Number(raw)
            const v = n === null || Number.isFinite(n) ? n : allowNull ? null : 0
            last.current = v
            onChange(v)
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {flag ? <span className="msg">{flag.msg}</span> : sub ? <span className="sub">{sub}</span> : null}
    </div>
  )
}

export function TextField({ label, value, onChange, multiline, id, wide, placeholder, list }: { label: ReactNode; value: string; onChange: (v: string) => void; multiline?: boolean; id?: string; wide?: boolean; placeholder?: string; list?: string }) {
  return (
    <div className={`field ${wide ? 'wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className="text" value={value} placeholder={placeholder} list={list} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}

export function CalcLine({ label, value, unit, big, plan }: { label: ReactNode; value: string; unit?: string; big?: boolean; plan?: boolean }) {
  return (
    <div className={`line ${big ? 'big' : ''} ${plan ? 'plan' : ''}`}>
      <span>{label}</span>
      <span className="num"><b>{value}</b> {unit && <small>{unit}</small>}</span>
    </div>
  )
}
