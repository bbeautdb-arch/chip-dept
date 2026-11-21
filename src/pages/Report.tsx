import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { useStore } from '../lib/store'
import { aggregate, type DayCalc } from '../lib/calc'
import { addMonths, daysInMonth, monthOf, thDate, thMonth, today, dayNum } from '../lib/dates'
import { fmt, fmt0, fmt1 } from '../lib/format'
import { ComboChart, HBars } from '../components/charts'
import { YUKA_COST_LABELS, FUEL_COST_LABELS, SECTIONS, SECTION_LABELS, SAFETY_MATS } from '../lib/defaults'
import { dayAnomalies } from '../lib/validate'
import type { ShiftsData, ShiftData, SectionId } from '../lib/types'

const C = { navy: '#1c3a6e', navy2: '#5b7fbf', green: '#1d6a48', green2: '#6db893', amber: '#c98a2b', grey: '#9aa6b8', red: '#b42318', sky: '#8fb3e6', sand: '#d8c49a', plum: '#8a6fb0' }
const TABS = ['ภาพรวม', 'ไม้ยูคา', 'ไม้เชื้อเพลิง', 'ขอบบอร์ด', 'ไฟฟ้า', 'จักรกลหนัก', 'เวลาเดินเครื่อง', 'ผู้บันทึก'] as const

export default function Report() {
  const st = useStore()
  const [ym, setYm] = useState(() => { const ds = Object.keys(st.byDate).sort(); return ds.length ? monthOf(ds[ds.length - 1]) : monthOf(today()) })
  const [tab, setTab] = useState<(typeof TABS)[number]>('ภาพรวม')
  const days = useMemo(() => daysInMonth(ym).map((d) => st.calc[d]).filter((c): c is DayCalc => !!c && Object.values(c.has).some(Boolean)), [ym, st.calc])
  const agg = useMemo(() => aggregate(days, st.byDate, st.settings), [days, st.byDate, st.settings])
  const labels = days.map((d) => String(dayNum(d.date)))
  const lastDay = days[days.length - 1]
  const file = `โรงชิพ_${thMonth(ym).replace(' ', '_')}`

  return (
    <div className="stack">
      <div className="topbar"><h1>รายงานแผนกโรงชิพ</h1></div>
      <div className="datebar noprint">
        <button className="icon-btn" aria-label="เดือนก่อน" onClick={() => setYm(addMonths(ym, -1))}><ChevronLeft /></button>
        <div className="datepick"><b>{thMonth(ym)}</b><span>{days.length ? `ข้อมูล ${days.length} วัน · ${thDate(days[0].date, { short: true })} – ${thDate(lastDay.date, { short: true })}` : 'ยังไม่มีข้อมูล'}</span></div>
        <button className="icon-btn" aria-label="เดือนถัดไป" onClick={() => setYm(addMonths(ym, 1))}><ChevronRight /></button>
      </div>
      <div className="seg noprint" role="tablist">
        {TABS.map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {days.length === 0 ? <div className="card">ยังไม่มีข้อมูลในเดือนนี้</div> : (
        <>
          {tab === 'ภาพรวม' && <Overview days={days} agg={agg} labels={labels} />}
          {tab === 'ไม้ยูคา' && <YukaTab days={days} agg={agg} labels={labels} />}
          {tab === 'ไม้เชื้อเพลิง' && <FuelTab days={days} agg={agg} labels={labels} />}
          {tab === 'ขอบบอร์ด' && <EdgeTab days={days} agg={agg} labels={labels} />}
          {tab === 'ไฟฟ้า' && <PowerTab days={days} labels={labels} />}
          {tab === 'จักรกลหนัก' && <MachinesTab days={days} labels={labels} />}
          {tab === 'เวลาเดินเครื่อง' && <ShiftsTab days={days} labels={labels} />}
          {tab === 'ผู้บันทึก' && <PeopleTab days={days} />}
        </>
      )}
      <div className="card noprint">
        <h2>ส่งออกรายงาน</h2>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" data-testid="export-xlsx" disabled={!days.length} onClick={async () => (await import('../lib/export')).exportXlsx(days, st.byDate, st.settings, st.issues, `${file}.xlsx`)}><FileSpreadsheet size={18} /> Excel ทั้งเดือน</button>
          <button className="btn" data-testid="export-csv" disabled={!days.length} onClick={async () => (await import('../lib/export')).exportCsv(days, st.byDate, st.settings, `${file}_สรุปรายวัน.csv`)}><FileText size={18} /> CSV สรุปรายวัน</button>
          <button className="btn" onClick={() => window.print()}><Printer size={18} /> พิมพ์ / PDF</button>
        </div>
      </div>
    </div>
  )
}

type P = { days: DayCalc[]; agg: ReturnType<typeof aggregate>; labels: string[] }

function vsPlan(actual: number | null, plan: number | null) {
  if (actual == null || plan == null || !plan) return null
  const p = ((actual - plan) / plan) * 100
  return <span className={p > 0 ? 'bad' : 'good'}>{p > 0 ? 'สูงกว่าแผน' : 'ต่ำกว่าแผน'} {Math.abs(p).toFixed(1)}%</span>
}

function Overview({ days, agg, labels }: P) {
  const st = useStore()
  const last = days[days.length - 1]
  const missing = days.length ? daysInMonth(days[0].date.slice(0, 7)).filter((d) => d <= last.date && d >= st.settings.opening.date).map((d) => ({ d, n: SECTIONS.filter((s) => !st.byDate[d]?.[s]).length })).filter((x) => x.n) : []
  const anomalies = days.flatMap((c) => dayAnomalies(c, st.byDate, st.settings).map((a) => ({ d: c.date, ...a })))
  const gm = new Map<string, { key: string; section: SectionId; level: 'error' | 'warn'; label: string; items: { d: string; msg: string }[] }>()
  for (const a of anomalies) {
    const label = a.msg.replace(/\s*\(.*\)\s*$/, '')
    const key = a.section + '|' + label
    const g = gm.get(key) ?? { key, section: a.section, level: a.level, label, items: [] }
    if (!g.items.some((x) => x.d === a.d)) g.items.push({ d: a.d, msg: a.msg })
    gm.set(key, g)
  }
  const groups = [...gm.values()].sort((a, b) => (a.level === b.level ? b.items.length - a.items.length : a.level === 'error' ? -1 : 1))
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">สับได้รวมทั้งแผนก</div><div className="v num" data-testid="kpi-tons">{fmt(agg.tons)}<small>ตัน</small></div><div className="d">{days.length} วัน · เฉลี่ย {fmt(agg.tons / days.length, 1)} ตัน/วัน</div></div>
        <div className="kpi"><div className="k">ค่าใช้จ่ายรวม</div><div className="v num">{fmt0(agg.cost)}<small>บาท</small></div><div className="d hint">เฉลี่ย {fmt(agg.costPerTon)} บ./ตัน</div></div>
        <div className="kpi"><div className="k">ค่าไฟ 4 มิเตอร์หลัก</div><div className="v num">{fmt0(agg.baht)}<small>บาท</small></div><div className="d hint">{fmt0(agg.kwh)} kWh</div></div>
        <div className="kpi"><div className="k">ลงข้อมูลครบ</div><div className="v num">{days.length - missing.length}/{days.length}<small>วัน</small></div><div className="d">{missing.length ? <span className="warnc">ขาด {missing.length} วัน</span> : <span className="good">ครบทุกวัน</span>}</div></div>
      </div>
      <div className="grid g3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <LineCard title="ไม้ยูคา" tons={agg.yuka.total} cpt={agg.yuka.costPerTon} plan={agg.yuka.planPerTon} kwh={agg.yuka.total ? agg.yuka.kwh / agg.yuka.total : null} testid="yuka" />
        <LineCard title="ไม้เชื้อเพลิง" tons={agg.fuel.total} cpt={agg.fuel.costPerTon} plan={agg.fuel.planPerTon} kwh={agg.fuel.total ? agg.fuel.kwh / agg.fuel.total : null} testid="fuel" />
        <LineCard title="สับขอบบอร์ด" tons={agg.edge.tons} cpt={agg.edge.costPerTon} plan={null} kwh={agg.edge.kwhPerTon} testid="edge" />
      </div>
      <div className="card">
        <h2>ปริมาณสับได้รายวัน และต้นทุนต่อตัน</h2>
        <p className="hint">แท่ง = ตันที่สับได้ของแต่ละไลน์ · เส้น = ต้นทุนบาทต่อตัน (ยิ่งต่ำยิ่งดี)</p>
        <ComboChart labels={labels} stacked barUnit="ตัน" lineUnit="บ./ตัน"
          bars={[{ label: 'ยูคา', values: days.map((d) => d.yuka.total), color: C.navy }, { label: 'เชื้อเพลิง', values: days.map((d) => d.fuel.total), color: C.green2 }, { label: 'ขอบบอร์ด', values: days.map((d) => d.edge.tons), color: C.sand }]}
          lines={[{ label: 'ต้นทุนยูคา', values: days.map((d) => d.yuka.costPerTon), color: C.amber }, { label: 'ต้นทุนเชื้อเพลิง', values: days.map((d) => d.fuel.costPerTon), color: C.red }]} />
      </div>
      <div className="card">
        <h2>สต๊อก ณ {thDate(last.date, { short: true })}</h2>
        <div className="tablewrap" style={{ marginTop: 10 }}>
          <table className="t num">
            <thead><tr><th>รายการ</th><th>ตัน</th></tr></thead>
            <tbody>
              <tr><td>ยูคา · สต๊อกชิพรวม</td><td>{fmt(last.yuka.stockAll)}</td></tr>
              <tr><td>ยูคา · สต๊อกชิพซื้อ</td><td>{fmt(last.yuka.stockBought)}</td></tr>
              <tr><td>ยูคา · สต๊อกไม้ท่อน</td><td>{fmt(last.yuka.stockLog)}</td></tr>
              <tr><td>ยูคา · ไม้ท่อนใหญ่</td><td>{fmt(last.yuka.stockBig)}</td></tr>
              <tr><td>เชื้อเพลิง · สต๊อกชิพสับเอง</td><td>{fmt(last.fuel.stockChip)}</td></tr>
              <tr><td>เชื้อเพลิง · สต๊อกชิพซื้อ</td><td>{fmt(last.fuel.stockBought)}</td></tr>
              <tr><td>เชื้อเพลิง · สต๊อกไม้ท่อน</td><td>{fmt(last.fuel.stockLog)}</td></tr>
              <tr><td>เชื้อเพลิง · ไม้ท่อนใหญ่ 1</td><td>{fmt(last.fuel.stockBig1)}</td></tr>
              {SAFETY_MATS.map((m) => <tr key={m.key}><td>Safety Stock · {m.label}</td><td>{fmt(last.fuel.safety[m.key])}</td></tr>)}
              <tr><td>ขอบบอร์ดสับ</td><td>{fmt(last.edge.stockEdge, 3)}</td></tr>
              <tr><td>Over Size</td><td>{fmt(last.edge.stockOver, 3)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>ค่าผิดปกติที่ควรตรวจ</h2>
        <p className="hint">รวมเรื่องเดียวกันไว้ด้วยกัน แตะวันที่เพื่อไปแก้</p>
        <div className="list" style={{ marginTop: 6 }} data-testid="anomalies">
          {groups.length === 0 && <div className="item good">ไม่พบค่าผิดปกติ</div>}
          {groups.map((g) => (
            <div key={g.key} className="item" style={{ alignItems: 'flex-start' }}>
              <span className={`dot ${g.level === 'error' ? 'err' : 'warn'}`} style={{ marginTop: 7 }} />
              <div className="grow">
                <div className="t1">{SECTION_LABELS[g.section]} · {g.label} <span className="chip" style={{ marginLeft: 4 }}>{g.items.length} ครั้ง</span></div>
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  {g.items.slice(0, 12).map((it, i) => <a key={i} className="chip navy" href={`#/entry?d=${it.d}&s=${g.section}`} title={it.msg}>{Number(it.d.slice(8))}</a>)}
                  {g.items.length > 12 && <span className="t2">+{g.items.length - 12}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function LineCard({ title, tons, cpt, plan, kwh, testid }: { title: string; tons: number; cpt: number | null; plan: number | null; kwh: number | null; testid: string }) {
  return (
    <div className="card" data-testid={`line-${testid}`}>
      <h2>{title}</h2>
      <div className="grid g2" style={{ marginTop: 10 }}>
        <div><div className="hint">สับได้</div><div className="num" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(tons)} <small className="hint">ตัน</small></div></div>
        <div><div className="hint">ต้นทุนเฉลี่ย</div><div className="num" style={{ fontSize: 20, fontWeight: 700 }} data-testid={`cpt-${testid}`}>{fmt(cpt)} <small className="hint">บ./ตัน</small></div></div>
        <div><div className="hint">ไฟต่อตัน</div><div className="num" style={{ fontWeight: 600 }}>{fmt(kwh)} kWh</div></div>
        <div><div className="hint">เทียบแผน</div><div style={{ fontWeight: 600, fontSize: 14 }}>{plan != null ? <>{fmt(plan)} บ./ตัน<br />{vsPlan(cpt, plan)}</> : '–'}</div></div>
      </div>
    </div>
  )
}

function Table({ head, rows, sum }: { head: string[]; rows: (string | number)[][]; sum?: (string | number)[] }) {
  return (
    <div className="tablewrap" style={{ marginTop: 10, maxHeight: 420 }}>
      <table className="t num">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
          {sum && <tr className="sum">{sum.map((c, j) => <td key={j}>{c}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  )
}

function YukaTab({ days, agg, labels }: P) {
  const st = useStore()
  const keys = st.settings.costYuka
  const colors = [C.navy, C.green, C.amber, C.plum, C.sky, C.grey, C.sand, C.red, C.navy2]
  const totals = keys.map((k, i) => ({ label: YUKA_COST_LABELS[k], value: days.reduce((a, d) => a + d.yuka[k], 0), color: colors[i] }))
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">ต้นทุนเฉลี่ย</div><div className="v num" data-testid="yuka-cpt">{fmt(agg.yuka.costPerTon)}<small>บ./ตัน</small></div><div className="d">{vsPlan(agg.yuka.costPerTon, agg.yuka.planPerTon)}</div></div>
        <div className="kpi"><div className="k">สับได้รวม</div><div className="v num">{fmt(agg.yuka.total)}<small>ตัน</small></div><div className="d hint">ไม้ท่อนรับเข้า {fmt(agg.yuka.logIn)}</div></div>
        <div className="kpi"><div className="k">ตักขึ้น Silo</div><div className="v num">{fmt(agg.yuka.silo)}<small>ตัน</small></div></div>
        <div className="kpi"><div className="k">ค่าแรง+ค่าไฟ ต่อตัน</div><div className="v num">{fmt(agg.yuka.laborElecPerTon)}<small>บ./ตัน</small></div><div className="d hint">{fmt1(agg.yuka.kwh)} kWh</div></div>
      </div>
      <div className="card">
        <h2>ต้นทุนต่อตันรายวัน เทียบแผน</h2>
        <ComboChart labels={labels} barUnit="ตัน" lineUnit="บ./ตัน" bars={[{ label: 'สับได้ (ตัน)', values: days.map((d) => d.yuka.total), color: C.sky }]}
          lines={[{ label: 'ต้นทุนจริง', values: days.map((d) => d.yuka.costPerTon), color: C.navy }, { label: 'ต้นทุนตามแผนซ่อม', values: days.map((d) => d.yuka.planPerTon), color: C.green, dashed: true }]} />
      </div>
      <div className="card">
        <h2>ค่าใช้จ่ายแยกประเภท</h2>
        <ComboChart labels={labels} stacked barUnit="บาท" bars={keys.map((k, i) => ({ label: YUKA_COST_LABELS[k], values: days.map((d) => d.yuka[k]), color: colors[i] }))} />
        <div style={{ marginTop: 14 }}><HBars items={totals.sort((a, b) => b.value - a.value)} unit="บาท" /></div>
      </div>
      <div className="card">
        <h2>ตารางรายวัน</h2>
        <Table head={['วันที่', 'สับได้', 'kWh', 'kWh/ตัน', 'ค่าไฟ', 'Loader', 'BH', 'ค่าใช้จ่าย', 'บ./ตัน', 'แผน บ./ตัน', 'สต๊อกรวม']}
          rows={days.map((d) => [thDate(d.date, { short: true }), fmt(d.yuka.total), fmt0(d.yuka.kwh), fmt(d.yuka.kwhPerTon), fmt(d.yuka.elec), fmt(d.yuka.loader), fmt(d.yuka.bh), fmt(d.yuka.cost), fmt(d.yuka.costPerTon), fmt(d.yuka.planPerTon), fmt(d.yuka.stockAll)])}
          sum={['รวม', fmt(agg.yuka.total), fmt0(agg.yuka.kwh), fmt(agg.yuka.total ? agg.yuka.kwh / agg.yuka.total : null), fmt(agg.yuka.elec), '', '', fmt(agg.yuka.cost), fmt(agg.yuka.costPerTon), fmt(agg.yuka.planPerTon), '']} />
      </div>
    </>
  )
}

function FuelTab({ days, agg, labels }: P) {
  const st = useStore()
  const keys = st.settings.costFuel
  const colors = [C.green, C.navy, C.amber, C.plum, C.sky, C.red]
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">ต้นทุนเฉลี่ย</div><div className="v num" data-testid="fuel-cpt">{fmt(agg.fuel.costPerTon)}<small>บ./ตัน</small></div><div className="d">{vsPlan(agg.fuel.costPerTon, agg.fuel.planPerTon)}</div></div>
        <div className="kpi"><div className="k">สับได้รวม</div><div className="v num">{fmt(agg.fuel.total)}<small>ตัน</small></div><div className="d hint">ไม้ท่อนรับเข้า {fmt(agg.fuel.logIn)}</div></div>
        <div className="kpi"><div className="k">ค่าแรง+ค่าไฟ ต่อตัน</div><div className="v num">{fmt(agg.fuel.laborElecPerTon)}<small>บ./ตัน</small></div></div>
        <div className="kpi"><div className="k">ไฟต่อตัน</div><div className="v num">{fmt(agg.fuel.total ? agg.fuel.kwh / agg.fuel.total : null)}<small>kWh</small></div></div>
      </div>
      <div className="card">
        <h2>ต้นทุนต่อตันรายวัน เทียบแผน</h2>
        <ComboChart labels={labels} barUnit="ตัน" lineUnit="บ./ตัน" bars={[{ label: 'สับได้ (ตัน)', values: days.map((d) => d.fuel.total), color: C.green2 }]}
          lines={[{ label: 'ต้นทุนจริง', values: days.map((d) => d.fuel.costPerTon), color: C.navy }, { label: 'ต้นทุนตามแผนซ่อม', values: days.map((d) => d.fuel.planPerTon), color: C.green, dashed: true }]} />
      </div>
      <div className="card">
        <h2>ค่าใช้จ่ายแยกประเภท</h2>
        <ComboChart labels={labels} stacked barUnit="บาท" bars={keys.map((k, i) => ({ label: FUEL_COST_LABELS[k], values: days.map((d) => d.fuel[k]), color: colors[i] }))} />
      </div>
      <div className="card">
        <h2>สต๊อกชิพสับเอง และไม้ท่อนรายวัน</h2>
        <ComboChart labels={labels} lineUnit="ตัน" lines={[{ label: 'สต๊อกชิพสับเอง', values: days.map((d) => d.fuel.stockChip), color: C.green }, { label: 'สต๊อกไม้ท่อน', values: days.map((d) => d.fuel.stockLog), color: C.amber }]} />
      </div>
      <div className="card">
        <h2>ตารางรายวัน</h2>
        <Table head={['วันที่', 'สับได้', 'kWh', 'kWh/ตัน', 'ค่าไฟ', 'Loader', 'ค่าซ่อม', 'ค่าใช้จ่าย', 'บ./ตัน', 'สต๊อกชิพ', 'สต๊อกไม้ท่อน']}
          rows={days.map((d) => [thDate(d.date, { short: true }), fmt(d.fuel.total), fmt0(d.fuel.kwh), fmt(d.fuel.kwhPerTon), fmt(d.fuel.elec), fmt(d.fuel.loader), fmt(d.fuel.repair), fmt(d.fuel.cost), fmt(d.fuel.costPerTon), fmt(d.fuel.stockChip), fmt(d.fuel.stockLog)])}
          sum={['รวม', fmt(agg.fuel.total), fmt0(agg.fuel.kwh), '', fmt(agg.fuel.elec), '', '', fmt(agg.fuel.cost), fmt(agg.fuel.costPerTon), '', '']} />
      </div>
    </>
  )
}

function EdgeTab({ days, agg, labels }: P) {
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">ต้นทุนรวม (รวมค่าเครื่องจักร)</div><div className="v num">{fmt(agg.edge.costPerTon)}<small>บ./ตัน</small></div></div>
        <div className="kpi"><div className="k">ค่าดำเนินการ</div><div className="v num" data-testid="edge-op">{fmt(agg.edge.opPerTon)}<small>บ./ตัน</small></div><div className="d hint">ค่าไฟ + ค่าแรง</div></div>
        <div className="kpi"><div className="k">สับได้</div><div className="v num">{fmt(agg.edge.tons, 3)}<small>ตัน</small></div><div className="d hint">{fmt0(agg.edge.scoops)} ตัก · {fmt1(agg.edge.hours)} ชม.</div></div>
        <div className="kpi"><div className="k">ไฟต่อตัน</div><div className="v num">{fmt(agg.edge.kwhPerTon)}<small>kWh</small></div><div className="d hint">{fmt1(agg.edge.kwh)} kWh</div></div>
      </div>
      <div className="card">
        <h2>สับได้ และต้นทุนต่อตันรายวัน</h2>
        <ComboChart labels={labels} barUnit="ตัน" lineUnit="บ./ตัน" bars={[{ label: 'สับได้ (ตัน)', values: days.map((d) => d.edge.tons), color: C.sand }]} lines={[{ label: 'ต้นทุนรวม/ตัน', values: days.map((d) => d.edge.costPerTon), color: C.navy }]} />
      </div>
      <div className="card">
        <h2>ตารางรายวัน</h2>
        <Table head={['วันที่', 'ชม.', 'ตัน', 'kWh', 'ค่าไฟ', 'ค่าแรง', 'ดำเนินการ/ตัน', 'รวม/ตัน', 'สต๊อก']}
          rows={days.map((d) => [thDate(d.date, { short: true }), fmt1(d.edge.hours), fmt(d.edge.tons, 3), fmt1(d.edge.kwh), fmt(d.edge.elec), fmt(d.edge.labor), fmt(d.edge.opPerTon), fmt(d.edge.costPerTon), fmt(d.edge.stockEdge, 3)])}
          sum={['รวม', fmt1(agg.edge.hours), fmt(agg.edge.tons, 3), fmt1(agg.edge.kwh), fmt(agg.edge.elec), fmt(agg.edge.labor), fmt(agg.edge.opPerTon), fmt(agg.edge.costPerTon), '']} />
      </div>
    </>
  )
}

function PowerTab({ days, labels }: { days: DayCalc[]; labels: string[] }) {
  const st = useStore()
  const ms = st.settings.meters.filter((m) => m.inSummary)
  const colors = [C.navy, C.green, C.sand, C.amber]
  const peak = days.reduce((a, d) => a + ms.reduce((x, m) => x + d.meters[m.id].peak, 0), 0)
  const off = days.reduce((a, d) => a + ms.reduce((x, m) => x + d.meters[m.id].off, 0), 0)
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">ค่าไฟ 4 มิเตอร์</div><div className="v num">{fmt0(days.reduce((a, d) => a + d.summary.baht, 0))}<small>บาท</small></div></div>
        <div className="kpi"><div className="k">หน่วยรวม</div><div className="v num">{fmt0(peak + off)}<small>kWh</small></div></div>
        <div className="kpi"><div className="k">ใช้ช่วง Peak</div><div className="v num">{fmt1(((peak) / (peak + off || 1)) * 100)}<small>%</small></div><div className="d hint">Peak แพงกว่า Off-Peak {fmt1((st.settings.rates.peak / st.settings.rates.off - 1) * 100)}%</div></div>
        <div className="kpi"><div className="k">เฉลี่ยต่อวัน</div><div className="v num">{fmt0((peak + off) / days.length)}<small>kWh</small></div></div>
      </div>
      <div className="card">
        <h2>ค่าไฟรายวันแยกมิเตอร์</h2>
        <ComboChart labels={labels} stacked barUnit="บาท" bars={ms.map((m, i) => ({ label: m.name, values: days.map((d) => d.meters[m.id].baht), color: colors[i % 4] }))} />
      </div>
      <div className="card">
        <h2>รวมทั้งเดือนแยกมิเตอร์</h2>
        <HBars unit="kWh" items={st.settings.meters.filter((m) => m.active).map((m, i) => ({ label: m.name, value: days.reduce((a, d) => a + d.meters[m.id].kwh, 0), color: m.inSummary ? colors[i % 4] : C.grey }))} />
      </div>
    </>
  )
}

function MachinesTab({ days, labels }: { days: DayCalc[]; labels: string[] }) {
  const sum = (f: (d: DayCalc) => number) => days.reduce((a, d) => a + f(d), 0)
  const bhTotal = sum((d) => d.machines.bhTotal)
  const bhRent = sum((d) => d.machines.bhRent)
  return (
    <>
      <div className="grid g4">
        <div className="kpi navy"><div className="k">Loader รวม</div><div className="v num">{fmt0(sum((d) => d.machines.rent + d.machines.fuel))}<small>บาท</small></div></div>
        <div className="kpi"><div className="k">Loader ส่วนโรงชิพ</div><div className="v num">{fmt0(sum((d) => d.machines.chip))}<small>บาท</small></div></div>
        <div className="kpi"><div className="k">แบคโฮ BH รวม</div><div className="v num">{fmt0(bhTotal)}<small>บาท</small></div><div className="d hint">{fmt1(sum((d) => d.machines.bhHours))} ชม.</div></div>
        <div className="kpi"><div className="k">ค่าเช่า BH เทียบขั้นต่ำ 80,000</div><div className="v num">{fmt0(bhRent)}<small>บาท</small></div><div className="d">{bhRent < 80000 ? <span className="warnc">ยังต่ำกว่าขั้นต่ำ {fmt0(80000 - bhRent)} บาท</span> : <span className="good">เกินขั้นต่ำแล้ว</span>}</div></div>
      </div>
      <div className="card">
        <h2>ค่า Loader แยกพื้นที่</h2>
        <HBars unit="บาท" items={[{ label: 'โรงชิพ', value: sum((d) => d.machines.chip), color: C.navy }, { label: 'Boiler', value: sum((d) => d.machines.boiler), color: C.amber }, { label: 'Production', value: sum((d) => d.machines.prod), color: C.green }, { label: 'สับขอบบอร์ด', value: sum((d) => d.machines.edge), color: C.sand }]} />
      </div>
      <div className="card">
        <h2>ชั่วโมง BH และค่าใช้จ่ายรายวัน</h2>
        <ComboChart labels={labels} barUnit="บาท" lineUnit="ชม." bars={[{ label: 'ค่า BH (บาท)', values: days.map((d) => d.machines.bhTotal), color: C.sky }]} lines={[{ label: 'ชั่วโมงทำงาน', values: days.map((d) => d.machines.bhHours), color: C.navy }]} />
      </div>
    </>
  )
}

const REASONS: [keyof ShiftData, string][] = [['pm', 'PM/5ส'], ['blade', 'เปลี่ยนใบมีด'], ['rest', 'พัก'], ['waitWood', 'รอไม้'], ['breakdown', 'เครื่องเสีย'], ['repair', 'ซ่อม'], ['plan', 'หยุดตามแผน']]
function ShiftsTab({ days, labels }: { days: DayCalc[]; labels: string[] }) {
  const st = useStore()
  const tot = (line: 'yuka' | 'fuel') => REASONS.map(([k, label]) => ({ label, value: days.reduce((a, d) => { const sd = st.byDate[d.date]?.shifts?.data as ShiftsData | undefined; return a + (sd ? sd[line].A[k] as number + (sd[line].B[k] as number) + (sd[line].C[k] as number) : 0) }, 0) })).sort((a, b) => b.value - a.value)
  const neg = days.flatMap((d) => (['yuka', 'fuel'] as const).flatMap((l) => (['A', 'B', 'C'] as const).filter((k) => d.shifts[l][k].run < 0).map((k) => `${thDate(d.date, { short: true })} ${l === 'yuka' ? 'ยูคา' : 'เชื้อเพลิง'} กะ ${k}`)))
  return (
    <>
      {neg.length > 0 && <div className="banner warn">พบกะที่เวลาเดินเครื่องติดลบ {neg.length} กะ (เวลาหยุดรวมเกินกะ) เช่น {neg.slice(0, 3).join(', ')} — ควรให้หัวหน้ากะลงเวลาหยุดจริง</div>}
      <div className="card">
        <h2>ตันต่อชั่วโมงเดินเครื่อง</h2>
        <ComboChart labels={labels} lineUnit="ตัน/ชม." lines={[{ label: 'ยูคา', values: days.map((d) => (d.shifts.yukaRun > 0 ? d.shifts.yukaTons / d.shifts.yukaRun : null)), color: C.navy }, { label: 'เชื้อเพลิง', values: days.map((d) => (d.shifts.fuelRun > 0 ? d.shifts.fuelTons / d.shifts.fuelRun : null)), color: C.green }]} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card"><h2>เวลาหยุด ไลน์ยูคา</h2><p className="hint">เรียงจากมากไปน้อย (ชั่วโมงรวมทั้งเดือน)</p><div style={{ marginTop: 10 }}><HBars unit="ชม." items={tot('yuka')} /></div></div>
        <div className="card"><h2>เวลาหยุด ไลน์เชื้อเพลิง</h2><p className="hint">เรียงจากมากไปน้อย (ชั่วโมงรวมทั้งเดือน)</p><div style={{ marginTop: 10 }}><HBars unit="ชม." items={tot('fuel').map((x) => ({ ...x, color: C.green }))} /></div></div>
      </div>
    </>
  )
}

function PeopleTab({ days }: { days: DayCalc[] }) {
  const st = useStore()
  const m = new Map<string, { n: number; last: number }>()
  for (const d of days) for (const s of SECTIONS) { const e = st.byDate[d.date]?.[s]; if (e) { const x = m.get(e.by) ?? { n: 0, last: 0 }; x.n++; x.last = Math.max(x.last, e.updatedAt); m.set(e.by, x) } }
  return (
    <div className="card">
      <h2>ใครลงข้อมูลบ้าง</h2>
      <Table head={['ชื่อ', 'จำนวนรายการ', 'ล่าสุด']} rows={[...m.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, v.n, new Date(v.last).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })])} />
    </div>
  )
}
