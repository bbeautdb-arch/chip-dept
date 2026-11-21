import { Home as HomeIc, PencilLine, BarChart3, History as HistIc, Menu, Wrench, Settings as SetIc } from 'lucide-react'
import { useRoute } from './router'
import { useStore } from './lib/store'
import Home from './pages/Home'
import Entry from './pages/Entry'
import History from './pages/History'
import Report from './pages/Report'
import Issues from './pages/Issues'
import Settings from './pages/Settings'
import More from './pages/More'

export default function App() {
  const { path, q } = useRoute()
  const st = useStore()
  if (!st.ready) return <div className="main" style={{ paddingTop: 80, textAlign: 'center' }}>กำลังเปิด…</div>
  const key = path.split('/')[1] || ''
  const nav = [
    { to: '/', k: '', label: 'หน้าแรก', Ic: HomeIc },
    { to: '/entry', k: 'entry', label: 'ลงค่า', Ic: PencilLine },
    { to: '/report', k: 'report', label: 'รายงาน', Ic: BarChart3 },
    { to: '/history', k: 'history', label: 'ประวัติ', Ic: HistIc },
  ]
  return (
    <div className="app">
      <nav className="rail" aria-label="เมนูหลัก">
        <div className="brand"><img src={import.meta.env.BASE_URL + 'pwa-192.png'} alt="" /><div><b>โรงชิพ</b><div className="hint" style={{ fontSize: 12 }}>ลงค่าประจำวัน</div></div></div>
        {nav.map((n) => <a key={n.k} href={'#' + n.to} className={key === n.k ? 'on' : ''}><n.Ic /> {n.label}</a>)}
        <a href="#/issues" className={key === 'issues' ? 'on' : ''}><Wrench /> ปัญหาเครื่องจักร</a>
        <a href="#/settings" className={key === 'settings' ? 'on' : ''}><SetIc /> ตั้งค่า</a>
      </nav>
      <main className="main">
        {key === '' && <Home />}
        {key === 'entry' && <Entry key={(q.get('d') ?? '') + (q.get('s') ?? '')} date={q.get('d') ?? undefined} section={q.get('s') ?? undefined} />}
        {key === 'history' && <History />}
        {key === 'report' && <Report />}
        {key === 'issues' && <Issues />}
        {key === 'settings' && <Settings />}
        {key === 'more' && <More />}
      </main>
      <nav className="tabbar" aria-label="เมนูหลัก">
        {nav.map((n) => <a key={n.k} href={'#' + n.to} className={key === n.k ? 'on' : ''}><n.Ic /> {n.label}</a>)}
        <a href="#/more" className={['more', 'issues', 'settings'].includes(key) ? 'on' : ''}><Menu /> เพิ่มเติม</a>
      </nav>
    </div>
  )
}
