import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Briefcase, Users, BarChart2, Settings, LogOut, Upload } from 'lucide-react'
import { getInitials } from '../lib/constants'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/engagements', icon: Briefcase, label: 'Engagements' },
  { to: '/candidates', icon: Users, label: 'Candidates' },
  { to: '/metrics', icon: BarChart2, label: 'Metrics' },
  { to: '/import', icon: Upload, label: 'Import' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F9FA' }}>
      <aside style={{ width: 220, background: '#0D2B45', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 11, color: '#4FD1C5', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>OE Consulting</div>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 600 }}>Search Platform</div>
        </div>
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
            return (
              <Link key={to} to={to} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 1.25rem',
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                textDecoration: 'none', fontSize: 14, fontWeight: active ? 600 : 400,
                borderLeft: active ? '3px solid #4FD1C5' : '3px solid transparent',
                transition: 'all 0.15s',
              }}>
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#0B6E6E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {getInitials(profile?.full_name)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.email}</div>
            </div>
          </div>
          <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
