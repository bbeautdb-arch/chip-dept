import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, Download, UserRound, Wrench, ChevronRight, CloudOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { SECTIONS, SECTION_LABELS } from '../lib/defaults'
import { addDays, daysInMonth, monthOf, thDate, today, dayNum } from '../lib/dates'
import { fmt } from '../lib/format'
import { SECTION_ICONS, NameDialog } from './Entry'
import { dayAnomalies } from '../lib/validate'
import { Toast } from '../components/Toast'

export default function Home() {
  const st = useStore()
  const [askName, setAskName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const t = today()
  const day = st.byDate[t] ?? {}
  const doneCount = SECTIONS.filter((s) => day[s]).length

  // วันล่าสุดที่มีข้อมูลต้นทุน
  const dates = Object.keys(st.byDate).filter((d) => st.byDate[d].yuka || st.byDate[d].fuel).sort()
  const last = dates[dates.length - 1]
  const lc = last ? st.calc[last] : undefined
  const prevD = last ? dates[dates.length - 2] : undefined
  const pc = prevD ? st.calc[prevD] : undefined

  // วันที่ยังลงไม่ครบในเดือนนี้ (ถึงเมื่อวาน)
  const ym = monthOf(t)
  const missing = daysInMonth(ym).filter((d) => d < t && d >= st.settings.opening.date).map((d) => ({ d, miss: SECTIONS.filter((s) => !st.byDate[d]?.[s]) })).filter((x) => x.miss.length)
  const flagged = (last ? [last] : []).flatMap((d) => dayAnomalies(st.calc[d], st.byDate, st.settings).filter((a) => a.level === 'error').map((a) => ({ d, ...a })))
  const openIssues = st.issues.filter((i) => i.status !== 'done').length

  const delta = (a?: number | null, b?: number | null) => {
    if (a == null || b == null || !b) return null
    const p = ((a - b) / b) * 100
    return <span className={p > 0 ? 'bad' : 'good'}>{p > 0 ? '▲' : '▼'} {Math.abs(p).toFixed(0)}% จากวันก่อน</span>
  }

  return (
    <div className="stack">
      <div className="topbar">
        <div className="brand">
          <img src={import.meta.env.BASE_URL + 'pwa-192.png'} alt="" />
          <div>
            <h1>โรงชิพ</h1>
            <div className="sub">{thDate(t, { dow: true })}</div>
          </div>
        </div>
        <div className="spacer" />
        <button className="btn sm" onClick={() => setAskName(true)} data-testid="user-chip"><UserRound size={16} /> {st.user || 'ใส่ชื่อ'}</button>
      </div>

      {!st.settings.syncUrl && (
        <div className="banner warn" data-testid="local-banner">
          <CloudOff size={18} />
          <div>ตอนนี้ข้อมูลเก็บไว้ <b>ในเครื่องนี้เท่านั้น</b> ยังไม่แชร์ข้ามมือถือ/แท็บเล็ต จนกว่าจะตั้งค่า Google Sheet กลาง (หน้า "ตั้งค่า")</div>
        </div>
      )}

      {st.entries.length === 0 && (
        <div className="card">
          <h2><Download size={20} /> เริ่มจากข้อมูลเดิมใน Excel</h2>
          <p className="hint">นำเข้าตัวเลขที่ลงไว้แล้วในไฟล์ "รายงานสับไม้ประจำวัน พ.ย. 2569" (1–16 พ.ย.) พร้อมยอดยกมา เพื่อให้รายงานและสต๊อกต่อเนื่อง</p>
          <button className="btn primary" style={{ marginTop: 12 }} disabled={busy} data-testid="import-seed"
            onClick={async () => { setBusy(true); const n = await st.importSeed(); setBusy(false); setToast(`นำเข้าแล้ว ${n} รายการ`) }}>
            <Download size={18} /> นำเข้าข้อมูล พ.ย. 2569
          </button>
        </div>
      )}

      <div className="card">
        <div className="row">
          <h2>ลงค่าวันนี้</h2>
          <div className="spacer" />
          <span className={`chip ${doneCount === 6 ? 'green' : 'amber'}`}>ครบ {doneCount}/6</span>
        </div>
        <div className="checklist" style={{ marginTop: 12 }}>
          {SECTIONS.map((s) => {
            const Ic = SECTION_ICONS[s]
            const e = day[s]
            return (
              <a key={s} href={`#/entry?d=${t}&s=${s}`} className={`check ${e ? 'done' : ''}`}>
                <span className="ic">{e ? <CheckCircle2 size={18} /> : <Ic size={18} />}</span>
                <span>
                  <div className="t1">{SECTION_LABELS[s]}</div>
                  <div className="t2">{e ? `โดย ${e.by}` : 'ยังไม่ได้ลง'}</div>
                </span>
              </a>
            )
          })}
        </div>
      </div>

      {lc && (
        <div className="card">
          <div className="row"><h2>ต้นทุนล่าสุด</h2><div className="spacer" /><span className="chip navy">{thDate(last!, { short: true })}</span></div>
          <div className="grid g4" style={{ marginTop: 12 }}>
            <div className="kpi navy"><div className="k">ไม้ยูคา</div><div className="v num">{fmt(lc.yuka.costPerTon)}<small>บ./ตัน</small></div><div className="d">{delta(lc.yuka.costPerTon, pc?.yuka.costPerTon)}</div></div>
            <div className="kpi"><div className="k">ไม้เชื้อเพลิง</div><div className="v num">{fmt(lc.fuel.costPerTon)}<small>บ./ตัน</small></div><div className="d">{delta(lc.fuel.costPerTon, pc?.fuel.costPerTon)}</div></div>
            <div className="kpi"><div className="k">สับได้รวม</div><div className="v num">{fmt(lc.summary.tons)}<small>ตัน</small></div><div className="d hint">ยูคา {fmt(lc.yuka.total, 1)} · เชื้อเพลิง {fmt(lc.fuel.total, 1)}</div></div>
            <div className="kpi"><div className="k">ค่าไฟ 4 มิเตอร์</div><div className="v num">{fmt(lc.summary.baht, 0)}<small>บาท</small></div><div className="d hint">{fmt(lc.summary.kwh, 0)} kWh</div></div>
          </div>
          <a className="btn block" style={{ marginTop: 12 }} href="#/report">ดูรายงานทั้งแผนก <ChevronRight size={18} /></a>
        </div>
      )}

      <div className="card">
        <h2><AlertTriangle size={20} /> สิ่งที่ต้องดู</h2>
        <div className="list" style={{ marginTop: 6 }}>
          {missing.length === 0 && flagged.length === 0 && openIssues === 0 && <div className="item"><CheckCircle2 className="good" /> <div className="grow">ไม่มีอะไรค้าง</div></div>}
          {missing.slice(-5).reverse().map((m) => (
            <a key={m.d} className="item" href={`#/entry?d=${m.d}&s=${m.miss[0]}`} data-testid="missing-item">
              <span className="dot warn" />
              <div className="grow"><div className="t1">{thDate(m.d, { short: true })} ยังลงไม่ครบ</div><div className="t2">ขาด: {m.miss.map((s) => SECTION_LABELS[s]).join(', ')}</div></div>
              <ChevronRight size={18} />
            </a>
          ))}
          {missing.length > 5 && <div className="item"><Info size={16} /><div className="grow t2">และอีก {missing.length - 5} วัน (ดูที่หน้าประวัติ)</div></div>}
          {flagged.map((f, i) => (
            <a key={i} className="item" href={`#/entry?d=${f.d}&s=${f.section}`}>
              <span className="dot err" />
              <div className="grow"><div className="t1">{SECTION_LABELS[f.section]} {thDate(f.d, { short: true })}</div><div className="t2">{f.msg}</div></div>
              <ChevronRight size={18} />
            </a>
          ))}
          {openIssues > 0 && (
            <a className="item" href="#/issues"><Wrench size={18} /><div className="grow"><div className="t1">ปัญหาเครื่องจักรค้างอยู่ {openIssues} เรื่อง</div></div><ChevronRight size={18} /></a>
          )}
        </div>
      </div>
      <div className="hint" style={{ textAlign: 'center' }}>เมื่อวาน {thDate(addDays(t, -1), { short: true })} · วันที่ {dayNum(t)} ของเดือน</div>
      {askName && <NameDialog onDone={(n) => { st.setUser(n); setAskName(false) }} onCancel={() => setAskName(false)} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}
