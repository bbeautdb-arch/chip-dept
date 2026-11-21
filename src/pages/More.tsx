import { Wrench, Settings, ChevronRight, History } from 'lucide-react'
export default function More() {
  return (
    <div className="stack">
      <div className="topbar"><h1>เพิ่มเติม</h1></div>
      <div className="card">
        <div className="list">
          <a className="item" href="#/history"><History /><div className="grow"><div className="t1">ประวัติการลงค่า</div><div className="t2">ดูย้อนหลังและแก้ไขรายวัน</div></div><ChevronRight size={18} /></a>
          <a className="item" href="#/issues"><Wrench /><div className="grow"><div className="t1">แจ้งปัญหาเครื่องจักร</div><div className="t2">บันทึกปัญหา สาเหตุ วิธีแก้ ติดตามสถานะ</div></div><ChevronRight size={18} /></a>
          <a className="item" href="#/settings"><Settings /><div className="grow"><div className="t1">ตั้งค่า</div><div className="t2">อัตราค่าไฟ ค่าแรง ยอดยกมา วันหยุด Google Sheet สำรองข้อมูล</div></div><ChevronRight size={18} /></a>
        </div>
      </div>
    </div>
  )
}
