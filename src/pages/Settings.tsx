import { useEffect, useState } from 'react'
import { Save, Cloud, Download, Upload, Trash2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Settings as S, Rates, YukaCostKey, FuelCostKey } from '../lib/types'
import { NumField, TextField } from '../components/fields'
import { YUKA_COST_LABELS, FUEL_COST_LABELS, SAFETY_MATS, DEFAULT_SETTINGS } from '../lib/defaults'
import { addMonths, daysInMonth, monthOf, thMonth, today, dow } from '../lib/dates'
import { isHoliday } from '../lib/calc'
import { download } from '../lib/download'
import { Toast } from '../components/Toast'
import { timeTh } from '../lib/format'

const RATE_FIELDS: [keyof Rates, string, string][] = [
  ['peak', 'ค่าไฟ Peak', 'บ./kWh'], ['off', 'ค่าไฟ Off-Peak', 'บ./kWh'], ['ft', 'ค่า FT', 'บ./หน่วย'],
  ['demandMonthly', 'Demand charge ต่อเดือน', 'บาท'], ['demandDays', 'หารจำนวนวัน', 'วัน'],
  ['laborPerLine', 'ค่าแรงต่อไลน์ต่อวัน', 'บาท'],
  ['loaderMonthly', 'ค่าเช่า Loader ต่อเดือน', 'บาท'], ['loaderDays', 'หารจำนวนวัน', 'วัน'], ['loaderFuel', 'ราคาน้ำมัน Loader', 'บ./ลิตร'],
  ['bhRate', 'ค่าเช่า BH', 'บ./ชม.'], ['bhFuel', 'ราคาน้ำมัน BH', 'บ./ลิตร'],
  ['boardElec', 'ค่าไฟไลน์ขอบบอร์ด', 'บ./kWh'], ['scoopKg', 'น้ำหนัก 1 ตัก', 'กก.'], ['boardLaborPerHour', 'ค่าแรงขอบบอร์ด', 'บ./ชม.'], ['boardMachinePerTon', 'ค่าเครื่องจักรขอบบอร์ด', 'บ./ตัน'],
  ['planRepairYuka', 'แผนค่าซ่อม ยูคา', 'บ./วัน'], ['planRepairFuel', 'แผนค่าซ่อม เชื้อเพลิง', 'บ./วัน'],
]

export default function Settings() {
  const st = useStore()
  const [s, setS] = useState<S>(() => structuredClone(st.settings))
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState('')
  const [ym, setYm] = useState(monthOf(today()))
  const [staffText, setStaffText] = useState(st.settings.staff.join('\n'))
  useEffect(() => { if (!dirty) { setS(structuredClone(st.settings)); setStaffText(st.settings.staff.join('\n')) } }, [st.settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const up = (p: Partial<S>) => { setS({ ...s, ...p }); setDirty(true) }
  const save = async () => { await st.updateSettings({ ...s, staff: staffText.split(/\n|,/).map((x) => x.trim()).filter(Boolean) }); setDirty(false); setToast('บันทึกการตั้งค่าแล้ว') }
  const toggleCost = <K extends string>(list: K[], k: K) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k])

  return (
    <div className="stack">
      <div className="topbar"><h1>ตั้งค่า</h1></div>

      <div className="card">
        <h2>ผู้ใช้เครื่องนี้</h2>
        <div className="fields" style={{ marginTop: 10 }}>
          <TextField id="set-user" label="ชื่อผู้บันทึก (เครื่องนี้)" value={st.user} onChange={st.setUser} />
          <TextField id="set-staff" wide multiline label="รายชื่อพนักงาน (บรรทัดละคน ใช้เป็นตัวเลือกตอนใส่ชื่อ)" value={staffText} onChange={(v) => { setStaffText(v); setDirty(true) }} />
        </div>
      </div>

      <div className="card">
        <h2><Cloud size={20} /> Google Sheet กลาง (แชร์ข้อมูลทุกเครื่อง)</h2>
        <p className="hint">ตอนนี้ข้อมูลอยู่ในเครื่องนี้เท่านั้น เมื่อตั้ง Google Sheet แล้ว ทุกมือถือ/แท็บเล็ตจะส่งข้อมูลเข้าที่เดียวกัน และดึงของคนอื่นมาแสดง (วิธีตั้งอยู่ในคู่มือ)</p>
        <div className="fields" style={{ marginTop: 10 }}>
          <TextField id="set-sync" wide label="ลิงก์ Web App ของ Apps Script" value={s.syncUrl} onChange={(v) => up({ syncUrl: v.trim() })} placeholder="https://script.google.com/macros/s/.../exec" />
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" disabled={!st.settings.syncUrl} onClick={async () => { const r = await st.sync(); setToast(r.error ?? `ส่ง ${r.pushed} · รับ ${r.pulled} รายการ`) }}><RefreshCw size={16} /> ส่ง/รับข้อมูลตอนนี้</button>
          <span className="hint">รอส่ง {st.pending} รายการ{st.lastSync ? ` · ล่าสุด ${timeTh(st.lastSync)}` : ''}</span>
        </div>
      </div>

      <div className="card">
        <h2>อัตราและค่าคงที่</h2>
        <p className="hint">ค่าเริ่มต้นมาจากสูตรใน Excel เดือน พ.ย. 2569 เปลี่ยนเมื่ออัตราจริงเปลี่ยน (มีผลกับการคำนวณทุกวัน)</p>
        <div className="fields" style={{ marginTop: 10 }}>
          {RATE_FIELDS.map(([k, label, unit]) => <NumField key={k} id={`rate-${k}`} label={label} unit={unit} value={s.rates[k]} onChange={(v) => up({ rates: { ...s.rates, [k]: v ?? 0 } })} />)}
          <NumField id="set-shiftHours" label="ชั่วโมงต่อกะ" unit="ชม." value={s.shiftHours} onChange={(v) => up({ shiftHours: v ?? 8 })} />
        </div>
        <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => up({ rates: { ...DEFAULT_SETTINGS.rates } })}>คืนค่าตาม Excel</button>
      </div>

      <div className="card">
        <h2>สิ่งที่นับเป็นต้นทุนผลิต (บาท/ตัน)</h2>
        <h3>ไลน์ยูคา</h3>
        <div className="row">{(Object.keys(YUKA_COST_LABELS) as YukaCostKey[]).map((k) => (
          <label key={k} className={`chip ${s.costYuka.includes(k) ? 'navy' : ''}`} style={{ minHeight: 40, padding: '6px 12px' }}>
            <input type="checkbox" checked={s.costYuka.includes(k)} onChange={() => up({ costYuka: toggleCost(s.costYuka, k) })} /> {YUKA_COST_LABELS[k]}
          </label>))}
        </div>
        <h3>ไลน์เชื้อเพลิง</h3>
        <div className="row">{(Object.keys(FUEL_COST_LABELS) as FuelCostKey[]).map((k) => (
          <label key={k} className={`chip ${s.costFuel.includes(k) ? 'navy' : ''}`} style={{ minHeight: 40, padding: '6px 12px' }}>
            <input type="checkbox" checked={s.costFuel.includes(k)} onChange={() => up({ costFuel: toggleCost(s.costFuel, k) })} /> {FUEL_COST_LABELS[k]}
          </label>))}
        </div>
        <h3>แบบสูตรคำนวณ</h3>
        <div className="seg seg-wrap" data-testid="formula-mode">
          <button className={s.formulaMode !== 'excel' ? 'on' : ''} onClick={() => up({ formulaMode: 'fixed', ftBase: 'kwh' })}>สูตรที่แก้แล้ว (แนะนำ)</button>
          <button className={s.formulaMode === 'excel' ? 'on' : ''} onClick={() => up({ formulaMode: 'excel', ftBase: 'baht' })}>ตรงตาม Excel เดิมทุกจุด</button>
        </div>
        <p className="hint">สูตรที่แก้แล้ว: ค่า FT คิดจากหน่วยไฟ · ยูคาไม่นับค่าซ่อม/ค่าใบมีดซ้ำ · แผนเชื้อเพลิงไม่เอาตันสต๊อกไปบวกเป็นเงิน · สต๊อกชิพเชื้อเพลิงนับไม้บีบครบ · แผนยูคาหารด้วยรวมสับได้ทุกวัน · ค่าแรงรวมเดือนนับเฉพาะวันที่ลงค่าแล้ว</p>
        <h3>วิธีคิดค่า FT</h3>
        <div className="seg seg-wrap">
          <button className={s.ftBase === 'baht' ? 'on' : ''} onClick={() => up({ ftBase: 'baht' })}>ค่าไฟ(บาท) × FT (แบบใน Excel)</button>
          <button className={s.ftBase === 'kwh' ? 'on' : ''} onClick={() => up({ ftBase: 'kwh' })}>หน่วย(kWh) × FT</button>
        </div>
      </div>

      <div className="card">
        <h2>วันหยุด (คิดไฟ Off-Peak ทั้งวัน)</h2>
        <p className="hint">เสาร์-อาทิตย์เป็นวันหยุดอัตโนมัติ แตะวันที่เพื่อสลับ เช่น วันหยุดนักขัตฤกษ์ หรือวันที่ทำงานปกติ</p>
        <div className="datebar" style={{ marginTop: 10 }}>
          <button className="icon-btn" aria-label="เดือนก่อน" onClick={() => setYm(addMonths(ym, -1))}><ChevronLeft /></button>
          <div className="datepick"><b>{thMonth(ym)}</b></div>
          <button className="icon-btn" aria-label="เดือนถัดไป" onClick={() => setYm(addMonths(ym, 1))}><ChevronRight /></button>
        </div>
        <div className="cal">
          {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => <div key={d} className="h">{d}</div>)}
          {Array.from({ length: dow(daysInMonth(ym)[0]) }).map((_, i) => <div key={'b' + i} />)}
          {daysInMonth(ym).map((d) => {
            const h = isHoliday(d, s)
            return <button key={d} className={h ? 'hol' : ''} onClick={() => up({ holidayOverrides: { ...s.holidayOverrides, [d]: !h } })}>{Number(d.slice(8))}</button>
          })}
        </div>
      </div>

      <div className="card">
        <h2>ยอดยกมา (สต๊อกตั้งต้น)</h2>
        <p className="hint">สต๊อกทุกวันคำนวณต่อจากยอดนี้ ถ้านับสต๊อกจริงแล้วไม่ตรง ให้แก้ยอดยกมาหรือวันที่เริ่ม</p>
        <div className="fields" style={{ marginTop: 10 }}>
          <div className="field"><label htmlFor="op-date">วันที่เริ่มนับ</label><input id="op-date" type="date" className="text" value={s.opening.date} onChange={(e) => up({ opening: { ...s.opening, date: e.target.value } })} /></div>
          <NumField id="op-y-all" label="ยูคา สต๊อกชิพรวม" unit="ตัน" value={s.opening.yuka.stockAll} onChange={(v) => up({ opening: { ...s.opening, yuka: { ...s.opening.yuka, stockAll: v ?? 0 } } })} />
          <NumField id="op-y-bought" label="ยูคา สต๊อกชิพซื้อ" unit="ตัน" value={s.opening.yuka.stockBought} onChange={(v) => up({ opening: { ...s.opening, yuka: { ...s.opening.yuka, stockBought: v ?? 0 } } })} />
          <NumField id="op-y-log" label="ยูคา สต๊อกไม้ท่อน" unit="ตัน" value={s.opening.yuka.stockLog} onChange={(v) => up({ opening: { ...s.opening, yuka: { ...s.opening.yuka, stockLog: v ?? 0 } } })} />
          <NumField id="op-y-big" label="ยูคา ไม้ท่อนใหญ่" unit="ตัน" value={s.opening.yuka.stockBig} onChange={(v) => up({ opening: { ...s.opening, yuka: { ...s.opening.yuka, stockBig: v ?? 0 } } })} />
          <NumField id="op-f-chip" label="เชื้อเพลิง สต๊อกชิพ" unit="ตัน" value={s.opening.fuel.stockChip} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, stockChip: v ?? 0 } } })} />
          <NumField id="op-f-bought" label="เชื้อเพลิง ชิพซื้อ" unit="ตัน" value={s.opening.fuel.stockBought} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, stockBought: v ?? 0 } } })} />
          <NumField id="op-f-log" label="เชื้อเพลิง ไม้ท่อน" unit="ตัน" value={s.opening.fuel.stockLog} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, stockLog: v ?? 0 } } })} />
          <NumField id="op-f-crane" label="ไม้ท่อนใหญ่หน้าเครน" unit="ตัน" value={s.opening.fuel.stockBigCrane} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, stockBigCrane: v ?? 0 } } })} />
          <NumField id="op-f-big1" label="ไม้ท่อนใหญ่ 1" unit="ตัน" value={s.opening.fuel.stockBig1} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, stockBig1: v ?? 0 } } })} />
          {SAFETY_MATS.map((m) => <NumField key={m.key} id={`op-s-${m.key}`} label={`Safety ${m.label}`} unit="ตัน" value={s.opening.fuel.safety[m.key]} onChange={(v) => up({ opening: { ...s.opening, fuel: { ...s.opening.fuel, safety: { ...s.opening.fuel.safety, [m.key]: v ?? 0 } } } })} />)}
          <NumField id="op-e-edge" label="ขอบบอร์ดสับ" unit="ตัน" value={s.opening.edge.stockEdge} onChange={(v) => up({ opening: { ...s.opening, edge: { ...s.opening.edge, stockEdge: v ?? 0 } } })} />
          <NumField id="op-e-over" label="Over Size" unit="ตัน" value={s.opening.edge.stockOver} onChange={(v) => up({ opening: { ...s.opening, edge: { ...s.opening.edge, stockOver: v ?? 0 } } })} />
        </div>
      </div>

      <div className="card">
        <h2>มิเตอร์ไฟฟ้า</h2>
        <div className="tablewrap" style={{ marginTop: 10 }}>
          <table className="t">
            <thead><tr><th>ชื่อ</th><th>ตัวคูณ</th><th>ใช้งาน</th><th>รวมในสรุป</th></tr></thead>
            <tbody>
              {s.meters.map((m, i) => (
                <tr key={m.id}>
                  <td><input className="text" style={{ minHeight: 40, border: '1px solid var(--line)', borderRadius: 8, padding: '0 8px' }} value={m.name} onChange={(e) => { const ms = [...s.meters]; ms[i] = { ...m, name: e.target.value }; up({ meters: ms }) }} /></td>
                  <td><input inputMode="decimal" style={{ width: 80, minHeight: 40, border: '1px solid var(--line)', borderRadius: 8, padding: '0 8px', textAlign: 'right' }} value={m.mult} onChange={(e) => { const ms = [...s.meters]; ms[i] = { ...m, mult: Number(e.target.value) || 1 }; up({ meters: ms }) }} /></td>
                  <td><input type="checkbox" checked={m.active} onChange={(e) => { const ms = [...s.meters]; ms[i] = { ...m, active: e.target.checked }; up({ meters: ms }) }} /></td>
                  <td><input type="checkbox" checked={m.inSummary} onChange={(e) => { const ms = [...s.meters]; ms[i] = { ...m, inSummary: e.target.checked }; up({ meters: ms }) }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>ข้อมูลในเครื่อง</h2>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={async () => { const n = await st.importSeed(); setToast(`นำเข้าข้อมูล พ.ย. 2569 แล้ว ${n} รายการ`) }}><Download size={16} /> นำเข้าข้อมูล พ.ย. 2569 จาก Excel</button>
          <button className="btn sm" onClick={() => download(new Blob([JSON.stringify({ app: 'chip-dept', at: Date.now(), entries: st.entries, issues: st.issues, settings: st.settings })], { type: 'application/json' }), `โรงชิพ_สำรอง_${today()}.json`)}><Download size={16} /> สำรองข้อมูล</button>
          <label className="btn sm"><Upload size={16} /> กู้คืนจากไฟล์สำรอง
            <input type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const j = JSON.parse(await f.text()); await st.restore(j); setToast('กู้คืนแล้ว') }} />
          </label>
          <button className="btn sm danger" onClick={async () => { if (confirm('ลบข้อมูลทั้งหมดในเครื่องนี้? (ควรสำรองก่อน)')) { await st.wipe(); setToast('ลบแล้ว') } }}><Trash2 size={16} /> ลบข้อมูลในเครื่อง</button>
        </div>
      </div>

      <div className="savebar">
        <div className="who">{dirty ? <span className="warnc">มีการแก้ไขที่ยังไม่บันทึก</span> : 'การตั้งค่าใช้กับเครื่องนี้'}</div>
        <button className="btn green" onClick={save} disabled={!dirty}><Save size={18} /> บันทึก</button>
      </div>
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  )
}
