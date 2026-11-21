import { useState } from 'react'
import { Plus, Wrench, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Issue } from '../lib/types'
import { thDate, today } from '../lib/dates'
import { TextField } from '../components/fields'

const STATUS: Record<Issue['status'], { label: string; cls: string }> = {
  open: { label: 'รอดำเนินการ', cls: 'red' }, doing: { label: 'กำลังทำ', cls: 'amber' }, done: { label: 'เสร็จแล้ว', cls: 'green' },
}
const blank = (by: string): Issue => ({ id: crypto.randomUUID(), date: today(), wo: '', machine: '', problem: '', cause: '', fix: '', status: 'open', assigned: '', by, updatedAt: 0 })

export default function Issues() {
  const st = useStore()
  const [edit, setEdit] = useState<Issue | null>(null)
  const [filter, setFilter] = useState<'all' | 'open'>('open')
  const list = st.issues.filter((i) => filter === 'all' || i.status !== 'done').sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="stack">
      <div className="topbar"><h1>แจ้งปัญหาเครื่องจักร</h1><div className="spacer" /><button className="btn primary sm" onClick={() => setEdit(blank(st.user || 'ไม่ระบุชื่อ'))}><Plus size={16} /> แจ้งใหม่</button></div>
      <div className="seg"><button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>ยังไม่เสร็จ</button><button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>ทั้งหมด</button></div>
      {edit && (
        <div className="card">
          <h2><Wrench size={20} /> {edit.updatedAt ? 'แก้ไขรายการ' : 'แจ้งปัญหาใหม่'}</h2>
          <div className="fields" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="is-date">วันที่</label><input id="is-date" type="date" className="text" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></div>
            <TextField id="is-wo" label="เลข Work order" value={edit.wo} onChange={(v) => setEdit({ ...edit, wo: v })} placeholder="WO..." />
            <TextField id="is-machine" label="เครื่องจักร" value={edit.machine} onChange={(v) => setEdit({ ...edit, machine: v })} placeholder="เช่น เครน1, สายพาน BC5" />
            <TextField id="is-problem" wide multiline label="ปัญหาที่พบ" value={edit.problem} onChange={(v) => setEdit({ ...edit, problem: v })} />
            <TextField id="is-cause" wide label="สาเหตุ" value={edit.cause} onChange={(v) => setEdit({ ...edit, cause: v })} />
            <TextField id="is-fix" wide label="วิธีแก้ไข" value={edit.fix} onChange={(v) => setEdit({ ...edit, fix: v })} />
            <TextField id="is-assigned" label="ผู้รับผิดชอบ" value={edit.assigned} onChange={(v) => setEdit({ ...edit, assigned: v })} />
            <div className="field"><label htmlFor="is-status">สถานะ</label>
              <select id="is-status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Issue['status'] })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            {edit.updatedAt > 0 && <button className="btn ghost danger" onClick={async () => { if (confirm('ลบรายการนี้?')) { await st.removeIssue(edit.id); setEdit(null) } }}><Trash2 size={16} /> ลบ</button>}
            <button className="btn ghost" onClick={() => setEdit(null)}>ยกเลิก</button>
            <button className="btn green" disabled={!edit.problem.trim() || !edit.machine.trim()} onClick={async () => { await st.saveIssue(edit); setEdit(null) }}>บันทึก</button>
          </div>
        </div>
      )}
      <div className="card">
        <div className="list">
          {list.length === 0 && <div className="item">ไม่มีรายการ</div>}
          {list.map((i) => (
            <button key={i.id} className="item" style={{ border: 0, background: 'none', textAlign: 'left', width: '100%', borderTop: '1px solid var(--line-2)' }} onClick={() => setEdit(i)}>
              <div className="grow">
                <div className="t1">{i.machine} · {i.problem}</div>
                <div className="t2">{thDate(i.date, { short: true })}{i.wo ? ` · ${i.wo}` : ''}{i.assigned ? ` · ผู้รับผิดชอบ ${i.assigned}` : ''} · แจ้งโดย {i.by}</div>
              </div>
              <span className={`chip ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
