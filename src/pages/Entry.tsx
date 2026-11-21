import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Calculator, Save, Trees, Flame, Layers, Gauge, Truck, Clock } from 'lucide-react'
import { useStore } from '../lib/store'
import { go } from '../router'
import type { SectionId, SectionDataMap, YukaData, FuelData, EdgeData, MetersData, MachinesData, ShiftsData, ShiftKey, ShiftData, MeterReading } from '../lib/types'
import { SECTIONS, SECTION_LABELS, SAFETY_MATS } from '../lib/defaults'
import { blankFor, blankReading } from '../lib/blank'
import { computeAll, type DayCalc, type ByDate } from '../lib/calc'
import { validate, type Flags } from '../lib/validate'
import { addDays, thDate, today } from '../lib/dates'
import { fmt, fmt1, timeTh } from '../lib/format'
import { NumField, TextField, CalcLine } from '../components/fields'
import { Toast } from '../components/Toast'

export const SECTION_ICONS = { yuka: Trees, fuel: Flame, edge: Layers, meters: Gauge, machines: Truck, shifts: Clock }

function initial<S extends SectionId>(section: S, date: string, byDate: ByDate, settings: ReturnType<typeof useStore>['settings']): SectionDataMap[S] {
  const ex = byDate[date]?.[section]?.data
  const blank = blankFor(section, settings)
  if (ex) {
    if (section === 'meters') {
      const m = { ...(blank as MetersData), ...(structuredClone(ex) as MetersData) }
      return m as SectionDataMap[S]
    }
    return { ...blank, ...structuredClone(ex) } as SectionDataMap[S]
  }
  const prev = byDate[addDays(date, -1)]
  const next = byDate[addDays(date, 1)]
  if (section === 'meters') {
    const m = blank as MetersData
    const pm = prev?.meters?.data as MetersData | undefined
    const nm = next?.meters?.data as MetersData | undefined
    for (const id of Object.keys(m)) {
      m[id] = { ...blankReading(), r08: pm?.[id]?.r08n ?? null, r08n: nm?.[id]?.r08 ?? null }
    }
  }
  if (section === 'machines') {
    const pmc = prev?.machines?.data as MachinesData | undefined
    const m = blank as MachinesData
    m.bhBefore = pmc?.bhAfter ?? null
  }
  return blank
}

export default function Entry({ date: d0, section: s0 }: { date?: string; section?: string }) {
  const st = useStore()
  const date = d0 && /^\d{4}-\d{2}-\d{2}$/.test(d0) ? d0 : today()
  const section = (SECTIONS as readonly string[]).includes(s0 ?? '') ? (s0 as SectionId) : 'yuka'
  const existing = st.byDate[date]?.[section]
  const [draft, setDraft] = useState<SectionDataMap[SectionId]>(() => initial(section, date, st.byDate, st.settings))
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const [askName, setAskName] = useState(false)

  useEffect(() => { setDraft(initial(section, date, st.byDate, st.settings)); setDirty(false) }, [date, section]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    const bd: ByDate = { ...st.byDate, [date]: { ...(st.byDate[date] ?? {}), [section]: { id: '', date, section, data: draft, by: '', updatedAt: 0, device: '' } } }
    const all = computeAll(bd, st.settings, addDays(date, 1))
    return { bd, c: all[date] as DayCalc | undefined }
  }, [st.byDate, st.settings, date, section, draft])
  const flags: Flags = useMemo(() => validate(section, draft, date, preview.bd, st.settings, preview.c), [section, draft, date, preview, st.settings])

  const nav = (to: { d?: string; s?: string }) => {
    if (dirty && !confirm('ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่')) return
    go(`/entry?d=${to.d ?? date}&s=${to.s ?? section}`)
  }
  const set = (patch: Partial<SectionDataMap[SectionId]>) => { setDraft((p) => ({ ...p, ...patch }) as SectionDataMap[SectionId]); setDirty(true) }
  const save = async () => {
    if (!st.user) { setAskName(true); return }
    const errs = Object.values(flags).filter((f) => f.level === 'error')
    if (errs.length && !confirm(`มีค่าที่ผิดปกติ ${errs.length} จุด:\n- ${errs.map((e) => e.msg).join('\n- ')}\n\nยืนยันบันทึก?`)) return
    await st.saveSection(date, section, draft as never)
    setDirty(false)
    setToast(`บันทึก${SECTION_LABELS[section]} ${thDate(date, { short: true })} แล้ว`)
  }

  const c = preview.c
  return (
    <div>
      <div className="topbar">
        <div>
          <h1>ลงค่าประจำวัน</h1>
          <div className="sub">{thDate(date, { dow: true })}{c?.holiday ? ' · วันหยุด (คิดไฟ Off-Peak ทั้งวัน)' : ''}</div>
        </div>
      </div>
      <div className="datebar">
        <button className="icon-btn" aria-label="วันก่อนหน้า" onClick={() => nav({ d: addDays(date, -1) })}><ChevronLeft /></button>
        <label className="datepick">
          <b>{thDate(date)}</b>
          <span>{date === today() ? 'วันนี้ · แตะเพื่อเปลี่ยนวัน' : 'แตะเพื่อเปลี่ยนวัน'}</span>
          <input type="date" aria-label="เลือกวันที่" value={date} onChange={(e) => e.target.value && nav({ d: e.target.value })} />
        </label>
        <button className="icon-btn" aria-label="วันถัดไป" onClick={() => nav({ d: addDays(date, 1) })}><ChevronRight /></button>
      </div>
      <div className="seg" role="tablist">
        {SECTIONS.map((s) => {
          const Ic = SECTION_ICONS[s]
          return (
            <button key={s} role="tab" aria-selected={s === section} className={s === section ? 'on' : ''} onClick={() => nav({ s })}>
              <Ic size={18} /> {SECTION_LABELS[s]} <span className={`dot ${st.byDate[date]?.[s] ? 'ok' : ''}`} />
            </button>
          )
        })}
      </div>

      <div className="entry-layout" style={{ marginTop: 14 }}>
        <div className="card">
          {section === 'yuka' && <YukaForm d={draft as YukaData} set={set} f={flags} />}
          {section === 'fuel' && <FuelForm d={draft as FuelData} set={set} f={flags} />}
          {section === 'edge' && <EdgeForm d={draft as EdgeData} set={set} f={flags} />}
          {section === 'meters' && <MetersForm d={draft as MetersData} set={(p) => set(p)} f={flags} c={c} />}
          {section === 'machines' && <MachinesForm d={draft as MachinesData} set={set} f={flags} />}
          {section === 'shifts' && <ShiftsForm d={draft as ShiftsData} set={set} f={flags} c={c} />}
        </div>
        <div className="side">{c && <Side section={section} c={c} />}</div>
      </div>

      <div className="savebar">
        <div className="who">
          {existing ? <>บันทึกล่าสุดโดย <b>{existing.by}</b><br />{timeTh(existing.updatedAt)}</> : <>ยังไม่มีข้อมูลส่วนนี้ของวันนี้</>}
          {dirty && <><br /><span className="warnc">มีการแก้ไขที่ยังไม่บันทึก</span></>}
        </div>
        {c && <KeyMetric section={section} c={c} />}
        <button className="btn green" onClick={save} data-testid="save"><Save size={18} /> บันทึก</button>
      </div>
      {askName && <NameDialog onDone={(n) => { st.setUser(n); setAskName(false) }} onCancel={() => setAskName(false)} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}

export function NameDialog({ onDone, onCancel }: { onDone: (n: string) => void; onCancel: () => void }) {
  const st = useStore()
  const [n, setN] = useState(st.user)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,36,67,.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 'min(420px, 100%)' }}>
        <h2>ใครเป็นคนลงข้อมูล</h2>
        <p className="hint">ใส่ชื่อครั้งเดียว เครื่องนี้จะจำไว้ และแสดงในทุกรายการที่บันทึก</p>
        <div style={{ marginTop: 12 }}>
          <TextField id="who" label="ชื่อผู้บันทึก" value={n} onChange={setN} list="staff-list" placeholder="เช่น สมชาย" />
          <datalist id="staff-list">{st.settings.staff.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>ยกเลิก</button>
          <button className="btn primary" disabled={!n.trim()} onClick={() => onDone(n.trim())}><Check size={18} /> ตกลง</button>
        </div>
      </div>
    </div>
  )
}

type SetF<T> = (p: Partial<T>) => void

function YukaForm({ d, set, f }: { d: YukaData; set: SetF<YukaData>; f: Flags }) {
  const n = (k: keyof YukaData, label: string, unit = 'ตัน') => <NumField id={`yuka-${k}`} label={label} unit={unit} value={d[k] as number} onChange={(v) => set({ [k]: v ?? 0 } as Partial<YukaData>)} flag={f[k]} />
  return (
    <>
      <h2><Trees size={20} /> ไลน์ไม้ยูคา</h2>
      <h3>รับเข้า</h3>
      <div className="fields">{n('logIn', 'ไม้ท่อนรับเข้า')}{n('chipIn', 'ชิพสับซื้อเข้า')}</div>
      <h3>สับได้</h3>
      <div className="fields">{n('chipped', 'สับได้ (ไม้รับเข้า)')}{n('fromStock', 'สับไม้สต๊อก')}{n('fromBig', 'สับไม้สต๊อกท่อนใหญ่')}</div>
      <h3>ตักขึ้น Silo</h3>
      <div className="fields">{n('silo', 'ตักขึ้น Silo')}{n('siloBought', 'ชิพซื้อตักขึ้น Silo')}</div>
      <details className="more">
        <summary>ค่าใช้จ่ายอื่นของวันนี้ (ถ้ามี)</summary>
        <div className="fields" style={{ paddingBottom: 12 }}>{n('repair', 'ค่าซ่อมเครื่องจักร', 'บาท')}{n('blade', 'ค่าใบมีด', 'บาท')}{n('heavyOther', 'จักรกลหนักอื่น', 'บาท')}</div>
      </details>
      <div className="fields" style={{ marginTop: 12 }}><TextField id="yuka-note" wide multiline label="หมายเหตุ" value={d.note} onChange={(v) => set({ note: v })} /></div>
    </>
  )
}

function FuelForm({ d, set, f }: { d: FuelData; set: SetF<FuelData>; f: Flags }) {
  const n = (k: keyof FuelData, label: string, unit = 'ตัน') => <NumField id={`fuel-${k}`} label={label} unit={unit} value={d[k] as number} onChange={(v) => set({ [k]: v ?? 0 } as Partial<FuelData>)} flag={f[k]} />
  const setSafety = (m: string, k: 'add' | 'use', v: number) => set({ safety: { ...d.safety, [m]: { ...d.safety[m as keyof FuelData['safety']], [k]: v } } })
  return (
    <>
      <h2><Flame size={20} /> ไลน์ไม้เชื้อเพลิง</h2>
      <h3>รับเข้า</h3>
      <div className="fields">{n('logIn', 'ไม้ท่อนรับเข้า')}{n('chipIn', 'ชิพเชื้อเพลิงซื้อเข้า')}</div>
      <h3>สับได้</h3>
      <div className="fields">{n('chipped', 'สับได้ (ไม้รับเข้า)')}{n('fromWaitLog', 'สับไม้ท่อนรอสับ')}{n('press1', 'สับไม้บีบ 1')}{n('press2', 'สับไม้บีบ 2')}</div>
      <h3>เบิกเข้าผลิต</h3>
      <div className="fields">{n('usePile', 'เบิกผลิตกอง')}{n('useOwn', 'เบิกผลิตชิพสับเอง')}{n('usePileBought', 'เบิกผลิตกอง (ชิพซื้อ)')}{n('useBought', 'เบิกผลิตชิพซื้อ')}</div>
      <details className="more">
        <summary>Safety Stock (เติมเข้า / เบิกใช้)</summary>
        <div className="grid" style={{ paddingBottom: 12 }}>
          {SAFETY_MATS.map((m) => (
            <div key={m.key} className="fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              <NumField id={`fuel-s-${m.key}-add`} label={`${m.label} เติมเข้า`} unit="ตัน" value={d.safety[m.key].add} onChange={(v) => setSafety(m.key, 'add', v ?? 0)} />
              <NumField id={`fuel-s-${m.key}-use`} label={`${m.label} เบิกใช้`} unit="ตัน" value={d.safety[m.key].use} onChange={(v) => setSafety(m.key, 'use', v ?? 0)} />
            </div>
          ))}
        </div>
      </details>
      <details className="more">
        <summary>ค่าซ่อมของวันนี้ (ถ้ามี)</summary>
        <div className="fields" style={{ paddingBottom: 12 }}>{n('pm', 'ซ่อมบำรุงรักษา PM', 'บาท')}{n('cm', 'ซ่อมแซมเครื่องจักร CM', 'บาท')}</div>
      </details>
      <div className="fields" style={{ marginTop: 12 }}><TextField id="fuel-note" wide multiline label="หมายเหตุ" value={d.note} onChange={(v) => set({ note: v })} /></div>
    </>
  )
}

function EdgeForm({ d, set, f }: { d: EdgeData; set: SetF<EdgeData>; f: Flags }) {
  const n = (k: keyof EdgeData, label: string, unit = 'ตัน') => <NumField id={`edge-${k}`} label={label} unit={unit} value={d[k] as number} onChange={(v) => set({ [k]: v ?? 0 } as Partial<EdgeData>)} flag={f[k]} />
  return (
    <>
      <h2><Layers size={20} /> ไลน์สับย่อยขอบบอร์ด</h2>
      <h3>ชั่วโมงเดินเครื่อง</h3>
      <div className="fields">{n('hMorning', 'กะเช้า', 'ชม.')}{n('hAfternoon', 'กะบ่าย', 'ชม.')}{n('hNight', 'กะดึก', 'ชม.')}</div>
      <h3>สับได้</h3>
      <div className="fields">{n('scoops', 'จำนวนตักที่สับได้', 'ตัก')}{n('overChipped', 'สับได้ Over Size')}</div>
      <h3>เบิกใช้</h3>
      <div className="fields">{n('use', 'เบิกใช้ขอบบอร์ด')}{n('usePile', 'เบิกใช้กองขอบบอร์ด')}{n('overUse', 'เบิกใช้ Over Size')}{n('safetyUse', 'เบิก Safety Stock')}</div>
      <details className="more">
        <summary>ค่าเครื่องจักรและค่าซ่อม</summary>
        <div className="fields" style={{ paddingBottom: 12 }}>{n('machineCostPerTon', 'ค่าเครื่องจักร (ติดตั้ง+ซ่อม)', 'บ./ตัน')}{n('pm', 'ซ่อม PM', 'บาท')}{n('cm', 'ซ่อม CM', 'บาท')}</div>
      </details>
      <p className="hint">หน่วยไฟของไลน์นี้ดึงจาก "มิเตอร์ไฟ" ช่องไลน์สับขอบบอร์ดให้เอง</p>
      <div className="fields" style={{ marginTop: 12 }}><TextField id="edge-note" wide multiline label="ปัญหา / แนวทางแก้ไข" value={d.note} onChange={(v) => set({ note: v })} /></div>
    </>
  )
}

const TIMES: [keyof MeterReading, string][] = [['r08', '08:00'], ['r09', '09:00'], ['r16', '16:00'], ['r20', '20:00'], ['r22', '22:00'], ['r00', '00:00'], ['r08n', '08:00 พรุ่งนี้']]
function MetersForm({ d, set, f, c }: { d: MetersData; set: (p: Partial<MetersData>) => void; f: Flags; c?: DayCalc }) {
  const st = useStore()
  const [showAll, setShowAll] = useState(false)
  const list = st.settings.meters.filter((m) => m.active && (showAll || m.inSummary))
  return (
    <>
      <h2><Gauge size={20} /> จดมิเตอร์ไฟฟ้า</h2>
      <p className="hint">ใส่เลขบนหน้าปัดตามเวลา ช่อง 08:00 ดึงจากที่จดเมื่อวานให้เอง · Peak 09–22 น. · Off-Peak 22–09 น.{c?.holiday ? ' · วันนี้เป็นวันหยุด คิด Off-Peak ทั้งวัน' : ''}</p>
      <div style={{ marginTop: 12 }}>
        {list.map((m) => {
          const r = d[m.id] ?? blankReading()
          const mc = c?.meters[m.id]
          return (
            <div className="meter" key={m.id}>
              <div className="head">
                <b>{m.name}{m.mult !== 1 ? ` (×${m.mult})` : ''}</b>
                {mc && mc.complete ? <span className="chip green num">{fmt1(mc.kwh)} kWh · {fmt(mc.baht, 0)} ฿</span> : <span className="chip">ยังไม่ครบ</span>}
              </div>
              <div className="fields">
                {TIMES.map(([k, lab]) => (
                  <NumField key={k} id={`m-${m.id}-${k}`} label={lab} allowNull value={r[k]} flag={f[`${m.id}.${k}`]}
                    onChange={(v) => set({ [m.id]: { ...r, [k]: v } })} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => setShowAll(!showAll)}>{showAll ? 'ซ่อนมิเตอร์อื่น' : 'แสดงมิเตอร์อื่นทั้งหมด'}</button>
    </>
  )
}

function MachinesForm({ d, set, f }: { d: MachinesData; set: SetF<MachinesData>; f: Flags }) {
  const n = (k: keyof MachinesData, label: string, unit: string, allowNull = false) => <NumField id={`mc-${k}`} label={label} unit={unit} allowNull={allowNull} value={d[k] as number | null} onChange={(v) => set({ [k]: allowNull ? v : (v ?? 0) } as Partial<MachinesData>)} flag={f[k]} />
  return (
    <>
      <h2><Truck size={20} /> จักรกลหนัก</h2>
      <h3>รถ Loader</h3>
      <div className="fields">{n('loaderLiters', 'น้ำมัน Loader', 'ลิตร')}</div>
      <h3>ชั่วโมงใช้ Loader แยกพื้นที่</h3>
      <div className="fields">{n('hChip', 'โรงชิพ', 'ชม.')}{n('hBoiler', 'Boiler', 'ชม.')}{n('hEdge', 'สับขอบบอร์ด', 'ชม.')}{n('hProd', 'Production', 'ชม.')}</div>
      <h3>รถแบคโฮ BH (เช่า)</h3>
      <div className="fields">
        {n('bhBefore', 'เลขชั่วโมงก่อน', 'ชม.', true)}{n('bhAfter', 'เลขชั่วโมงหลัง', 'ชม.', true)}{n('bhLiters', 'น้ำมัน BH', 'ลิตร')}
        <TextField id="mc-bhJob" wide label="ลักษณะงาน BH" value={d.bhJob} onChange={(v) => set({ bhJob: v })} list="bh-jobs" placeholder="เช่น คัดไม้โรงชิพ" />
        <datalist id="bh-jobs"><option value="คัดไม้โรงชิพ" /><option value="เครียร์ไม้หน้าเครน" /><option value="ดึงชิพกองยูคา" /><option value="แยกกองขอบบอร์ดเข้าสับ" /><option value="ใช้งานที่บ่อบำบัด" /></datalist>
        <label className="wide row" style={{ gap: 10, minHeight: 48 }}>
          <input type="checkbox" checked={d.bhToChip} onChange={(e) => set({ bhToChip: e.target.checked })} style={{ width: 24, height: 24 }} />
          <span>คิดค่า BH วันนี้เข้าต้นทุนไลน์ยูคา (ไม่ติ๊กถ้าใช้งานที่อื่น เช่น บ่อบำบัด)</span>
        </label>
      </div>
    </>
  )
}

const SHIFT_FIELDS: [keyof ShiftData, string][] = [['pm', 'PM/5ส'], ['blade', 'เปลี่ยนใบมีด'], ['rest', 'พัก'], ['waitWood', 'รอไม้'], ['breakdown', 'เครื่องเสีย'], ['repair', 'ซ่อม'], ['plan', 'หยุดตามแผน']]
function ShiftsForm({ d, set, f, c }: { d: ShiftsData; set: SetF<ShiftsData>; f: Flags; c?: DayCalc }) {
  const [line, setLine] = useState<'yuka' | 'fuel'>('yuka')
  const st = useStore()
  const upd = (k: ShiftKey, p: Partial<ShiftData>) => set({ [line]: { ...d[line], [k]: { ...d[line][k], ...p } } } as Partial<ShiftsData>)
  return (
    <>
      <h2><Clock size={20} /> เวลาเดินเครื่องรายกะ</h2>
      <p className="hint">ใส่เวลาที่เครื่อง "หยุด" เป็นชั่วโมง (30 นาที = 0.5) แอปจะคิดเวลาเดินเครื่องให้ กะละ {st.settings.shiftHours} ชม.</p>
      <div className="seg" style={{ marginTop: 10 }}>
        <button className={line === 'yuka' ? 'on' : ''} onClick={() => setLine('yuka')}>ไลน์ยูคา</button>
        <button className={line === 'fuel' ? 'on' : ''} onClick={() => setLine('fuel')}>ไลน์เชื้อเพลิง</button>
      </div>
      <div className="shift-grid" style={{ marginTop: 12 }}>
        {(['A', 'B', 'C'] as ShiftKey[]).map((k) => {
          const sh = d[line][k]
          const sc = c?.shifts[line][k]
          const fl = f[`${line}.${k}.run`]
          return (
            <div className="shift" key={k}>
              <div className="head">
                <span>กะ {k}</span>
                <span className={`chip ${fl?.level === 'error' ? 'red' : 'green'} num`}>เดินเครื่อง {fmt(sc?.run ?? 0, 2)} ชม.</span>
              </div>
              <div className="fields">
                <NumField id={`sh-${line}-${k}-tons`} label="ยอดไม้เข้าสับ" unit="ตัน" value={sh.tons} onChange={(v) => upd(k, { tons: v ?? 0 })} wide />
                {SHIFT_FIELDS.map(([fk, lab]) => <NumField key={fk} id={`sh-${line}-${k}-${fk}`} label={lab} unit="ชม." value={sh[fk] as number} onChange={(v) => upd(k, { [fk]: v ?? 0 })} />)}
                <TextField id={`sh-${line}-${k}-note`} wide label="หมายเหตุ" value={sh.note} onChange={(v) => upd(k, { note: v })} />
              </div>
              {fl && <div className={fl.level === 'error' ? 'bad' : 'warnc'} style={{ fontSize: 13, marginTop: 6 }}>{fl.msg}</div>}
              {sc?.tph != null && <div className="hint">อัตราสับ {fmt(sc.tph, 2)} ตัน/ชม.เดินเครื่อง</div>}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Side({ section, c }: { section: SectionId; c: DayCalc }) {
  const t = 'ตัน'
  return (
    <div className="calc" data-testid="calc">
      <div className="title"><Calculator size={16} /> คำนวณให้อัตโนมัติ</div>
      {section === 'yuka' && <>
        <CalcLine label="รวมสับได้" value={fmt(c.yuka.total)} unit={t} />
        <CalcLine label="หน่วยไฟ (MCC-27)" value={fmt1(c.yuka.kwh)} unit="kWh" />
        <CalcLine label="ไฟต่อตัน" value={fmt(c.yuka.kwhPerTon)} unit="kWh/ตัน" />
        <CalcLine label="ค่าไฟ" value={fmt(c.yuka.elec)} unit="บาท" />
        <CalcLine label="ค่าใช้จ่ายรวมวันนี้" value={fmt(c.yuka.cost)} unit="บาท" />
        <CalcLine big label="ต้นทุนผลิต" value={fmt(c.yuka.costPerTon)} unit="บาท/ตัน" />
        <CalcLine plan label="ต้นทุนตามแผนซ่อม" value={fmt(c.yuka.planPerTon)} unit="บาท/ตัน" />
        <CalcLine label="สต๊อกชิพรวม" value={fmt(c.yuka.stockAll)} unit={t} />
        <CalcLine label="สต๊อกชิพซื้อ" value={fmt(c.yuka.stockBought)} unit={t} />
        <CalcLine label="สต๊อกไม้ท่อน" value={fmt(c.yuka.stockLog)} unit={t} />
        <CalcLine label="สต๊อกไม้ท่อนใหญ่" value={fmt(c.yuka.stockBig)} unit={t} />
      </>}
      {section === 'fuel' && <>
        <CalcLine label="รวมสับได้" value={fmt(c.fuel.total)} unit={t} />
        <CalcLine label="หน่วยไฟ (MCC-28)" value={fmt1(c.fuel.kwh)} unit="kWh" />
        <CalcLine label="ไฟต่อตัน" value={fmt(c.fuel.kwhPerTon)} unit="kWh/ตัน" />
        <CalcLine label="ค่าใช้จ่ายรวมวันนี้" value={fmt(c.fuel.cost)} unit="บาท" />
        <CalcLine big label="ต้นทุนผลิต" value={fmt(c.fuel.costPerTon)} unit="บาท/ตัน" />
        <CalcLine plan label="ต้นทุนตามแผนซ่อม" value={fmt(c.fuel.planPerTon)} unit="บาท/ตัน" />
        <CalcLine label="สต๊อกชิพสับเอง" value={fmt(c.fuel.stockChip)} unit={t} />
        <CalcLine label="สต๊อกชิพซื้อ" value={fmt(c.fuel.stockBought)} unit={t} />
        <CalcLine label="สต๊อกไม้ท่อน" value={fmt(c.fuel.stockLog)} unit={t} />
        <CalcLine label="ไม้ท่อนใหญ่ 1" value={fmt(c.fuel.stockBig1)} unit={t} />
        <CalcLine label="Safety ชิพเชื้อเพลิง" value={fmt(c.fuel.safety.chip)} unit={t} />
      </>}
      {section === 'edge' && <>
        <CalcLine label="ชั่วโมงรวม" value={fmt(c.edge.hours, 1)} unit="ชม." />
        <CalcLine label="น้ำหนักสับได้" value={fmt(c.edge.tons, 3)} unit={t} />
        <CalcLine label="หน่วยไฟ" value={fmt1(c.edge.kwh)} unit="kWh" />
        <CalcLine label="ค่าไฟ" value={fmt(c.edge.elec)} unit="บาท" />
        <CalcLine label="ค่าแรง" value={fmt(c.edge.labor)} unit="บาท" />
        <CalcLine label="ค่าดำเนินการ/ตัน" value={fmt(c.edge.opPerTon)} unit="บาท/ตัน" />
        <CalcLine big label="ต้นทุนรวม" value={fmt(c.edge.costPerTon)} unit="บาท/ตัน" />
        <CalcLine label="สต๊อกขอบบอร์ดสับ" value={fmt(c.edge.stockEdge, 3)} unit={t} />
        <CalcLine label="สต๊อก Over Size" value={fmt(c.edge.stockOver, 3)} unit={t} />
      </>}
      {section === 'meters' && <>
        {Object.entries(c.meters).filter(([, m]) => m.complete).map(([id, m]) => <CalcLine key={id} label={id === 'mcc27' ? 'MCC-27 ยูคา' : id === 'mcc28' ? 'MCC-28 เชื้อเพลิง' : id === 'edge' ? 'ขอบบอร์ด' : id === 'boiler' ? 'Boiler' : id} value={fmt(m.baht, 0)} unit={`฿ · ${fmt1(m.kwh)} kWh`} />)}
        <CalcLine big label="รวม 4 มิเตอร์หลัก" value={fmt(c.summary.baht, 0)} unit="บาท" />
        <CalcLine label="หน่วยรวม" value={fmt1(c.summary.kwh)} unit="kWh" />
      </>}
      {section === 'machines' && <>
        <CalcLine label="ค่าเช่า Loader/วัน" value={fmt(c.machines.rent)} unit="บาท" />
        <CalcLine label="ค่าน้ำมัน Loader" value={fmt(c.machines.fuel)} unit="บาท" />
        <CalcLine label="ชั่วโมงรวม" value={fmt(c.machines.hours, 1)} unit="ชม." />
        <CalcLine big label="Loader ส่วนโรงชิพ" value={fmt(c.machines.chip)} unit="บาท" />
        <CalcLine label="→ ยูคา / เชื้อเพลิง" value={fmt(c.machines.chip / 2)} unit="บาท ต่อไลน์" />
        <CalcLine label="ส่วน Boiler" value={fmt(c.machines.boiler)} unit="บาท" />
        <CalcLine label="ส่วนสับขอบบอร์ด" value={fmt(c.machines.edge)} unit="บาท" />
        <CalcLine label="ส่วน Production" value={fmt(c.machines.prod)} unit="บาท" />
        <CalcLine label="BH ชั่วโมงทำงาน" value={fmt(c.machines.bhHours, 1)} unit="ชม." />
        <CalcLine big label="ค่า BH วันนี้" value={fmt(c.machines.bhTotal)} unit="บาท" />
      </>}
      {section === 'shifts' && <>
        <CalcLine label="ยูคา ยอดไม้ 3 กะ" value={fmt(c.shifts.yukaTons)} unit={t} />
        <CalcLine label="ยูคา เดินเครื่องรวม" value={fmt(c.shifts.yukaRun, 2)} unit="ชม." />
        <CalcLine big label="ยูคา ตัน/ชม." value={fmt(c.shifts.yukaRun > 0 ? c.shifts.yukaTons / c.shifts.yukaRun : null)} unit="" />
        <CalcLine label="เชื้อเพลิง ยอดไม้ 3 กะ" value={fmt(c.shifts.fuelTons)} unit={t} />
        <CalcLine label="เชื้อเพลิง เดินเครื่องรวม" value={fmt(c.shifts.fuelRun, 2)} unit="ชม." />
        <CalcLine big label="เชื้อเพลิง ตัน/ชม." value={fmt(c.shifts.fuelRun > 0 ? c.shifts.fuelTons / c.shifts.fuelRun : null)} unit="" />
      </>}
    </div>
  )
}

function KeyMetric({ section, c }: { section: SectionId; c: DayCalc }) {
  const m: Record<SectionId, [string, string, string]> = {
    yuka: ['ต้นทุน', fmt(c.yuka.costPerTon), 'บ./ตัน'],
    fuel: ['ต้นทุน', fmt(c.fuel.costPerTon), 'บ./ตัน'],
    edge: ['ต้นทุน', fmt(c.edge.costPerTon), 'บ./ตัน'],
    meters: ['ค่าไฟรวม', fmt(c.summary.baht, 0), 'บาท'],
    machines: ['Loader โรงชิพ', fmt(c.machines.chip, 0), 'บาท'],
    shifts: ['ยูคา', fmt(c.shifts.yukaRun > 0 ? c.shifts.yukaTons / c.shifts.yukaRun : null), 'ตัน/ชม.'],
  }
  const [k, v, u] = m[section]
  return <div className="keymetric num" data-testid="key-metric"><span>{k}</span><b>{v}</b><small>{u}</small></div>
}
