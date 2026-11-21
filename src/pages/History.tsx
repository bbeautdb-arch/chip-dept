import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { SECTIONS, SECTION_LABELS } from '../lib/defaults'
import { addMonths, daysInMonth, monthOf, thDate, thMonth, today, thDow } from '../lib/dates'
import { fmt } from '../lib/format'

export default function History() {
  const st = useStore()
  const [ym, setYm] = useState(() => {
    const ds = Object.keys(st.byDate).sort()
    return ds.length ? monthOf(ds[ds.length - 1]) : monthOf(today())
  })
  const t = today()
  const days = daysInMonth(ym).filter((d) => d <= t).reverse()
  return (
    <div className="stack">
      <div className="topbar"><h1>ประวัติการลงค่า</h1></div>
      <div className="datebar">
        <button className="icon-btn" aria-label="เดือนก่อน" onClick={() => setYm(addMonths(ym, -1))}><ChevronLeft /></button>
        <div className="datepick"><b>{thMonth(ym)}</b><span>แตะวันที่เพื่อดูหรือแก้ไข</span></div>
        <button className="icon-btn" aria-label="เดือนถัดไป" onClick={() => setYm(addMonths(ym, 1))}><ChevronRight /></button>
      </div>
      <div className="card">
        <div className="legend" style={{ marginBottom: 8 }}>
          {SECTIONS.map((s, i) => <span key={s}><b>{i + 1}</b> {SECTION_LABELS[s]}</span>)}
        </div>
        <div className="list">
          {days.length === 0 && <div className="item">ยังไม่มีวันในเดือนนี้</div>}
          {days.map((d) => {
            const day = st.byDate[d] ?? {}
            const c = st.calc[d]
            const n = SECTIONS.filter((s) => day[s]).length
            const first = SECTIONS.find((s) => !day[s]) ?? 'yuka'
            const people = [...new Set(SECTIONS.map((s) => day[s]?.by).filter(Boolean))]
            return (
              <a key={d} className="item" href={`#/entry?d=${d}&s=${first}`} data-testid="history-item">
                <div style={{ width: 54, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{Number(d.slice(8))}</div>
                  <div className="t2">{thDow(d)}{c?.holiday ? ' · หยุด' : ''}</div>
                </div>
                <div className="grow">
                  <div className="row" style={{ gap: 5 }}>
                    {SECTIONS.map((s) => <span key={s} className={`dot ${day[s] ? 'ok' : ''}`} title={SECTION_LABELS[s]} />)}
                    <span className="t2" style={{ marginLeft: 6 }}>{n}/6</span>
                  </div>
                  <div className="t2" style={{ marginTop: 4 }}>
                    {c && (day.yuka || day.fuel) ? <>ยูคา {fmt(c.yuka.costPerTon)} · เชื้อเพลิง {fmt(c.fuel.costPerTon)} บ./ตัน</> : 'ยังไม่มีตัวเลขต้นทุน'}
                    {people.length > 0 && <> · โดย {people.join(', ')}</>}
                  </div>
                </div>
                <ChevronRight size={18} />
              </a>
            )
          })}
        </div>
      </div>
      <p className="hint">{thDate(t)} เป็นวันล่าสุดที่แสดง</p>
    </div>
  )
}
