import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, MapPin, Calendar, Users } from 'lucide-react'
import { formatDate } from '../lib/constants'

const STATUS_STYLES = {
  active:   { bg: '#E6FFFA', color: '#0B6E6E', label: 'Active' },
  on_hold:  { bg: '#FFFBEB', color: '#B7791F', label: 'On Hold' },
  closed:   { bg: '#F7FAFC', color: '#718096', label: 'Closed' },
}

export default function Engagements() {
  const { profile } = useAuth()
  const [engagements, setEngagements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { fetchEngagements() }, [])

  async function fetchEngagements() {
    const { data } = await supabase
      .from('engagements')
      .select(`*, engagement_team(profile_id, profiles(full_name)), candidate_engagements(id, not_proceeding)`)
      .order('created_at', { ascending: false })
    setEngagements(data || [])
    setLoading(false)
  }

  const activeCount = e => e.candidate_engagements?.filter(c => !c.not_proceeding).length || 0

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', margin: 0 }}>Engagements</h1>
          <p style={{ fontSize: 13, color: '#718096', margin: '4px 0 0' }}>{engagements.filter(e => e.status === 'active').length} active searches</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} /> New Engagement
        </button>
      </div>

      {engagements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#A0AEC0' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No engagements yet</div>
          <div style={{ fontSize: 13 }}>Create your first engagement to get started</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {engagements.map(eng => {
            const st = STATUS_STYLES[eng.status] || STATUS_STYLES.active
            return (
              <Link key={eng.id} to={`/engagements/${eng.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0B6E6E'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(11,110,110,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#0D2B45' }}>{eng.role_title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 20 }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#718096', fontWeight: 500, marginBottom: 8 }}>{eng.client_name}</div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {eng.location && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#A0AEC0' }}><MapPin size={12} />{eng.location}</span>}
                      {eng.start_date && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#A0AEC0' }}><Calendar size={12} />Started {formatDate(eng.start_date)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#0D2B45' }}>{activeCount(eng)}</div>
                      <div style={{ fontSize: 11, color: '#A0AEC0' }}>candidates</div>
                    </div>
                    {eng.target_close_date && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45' }}>{formatDate(eng.target_close_date)}</div>
                        <div style={{ fontSize: 11, color: '#A0AEC0' }}>target close</div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {showNew && <NewEngagementModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetchEngagements() }} />}
    </div>
  )
}

function NewEngagementModal({ onClose, onCreated }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({ client_name: '', role_title: '', location: '', start_date: '', target_close_date: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('engagements').insert({
      ...form,
      created_by: profile.id,
      start_date: form.start_date || null,
      target_close_date: form.target_close_date || null,
    }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    // Add creator to team
    await supabase.from('engagement_team').insert({ engagement_id: data.id, profile_id: profile.id })
    // Create default workplan
    await supabase.rpc('create_default_workplan', { p_engagement_id: data.id })
    onCreated(data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D2B45', margin: '0 0 1.5rem' }}>New Engagement</h2>
        <form onSubmit={handleSubmit}>
          {[['client_name', 'Client Name', 'text', true], ['role_title', 'Role Title', 'text', true], ['location', 'Location', 'text', false]].map(([k, label, type, req]) => (
            <div key={k} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>{label}{req && ' *'}</label>
              <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} required={req}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['start_date', 'Start Date'], ['target_close_date', 'Target Close Date']].map(([k, label]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>{label}</label>
                <input type="date" value={form[k]} onChange={e => set(k, e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {error && <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#C53030', marginBottom: 16 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #CBD5E0', borderRadius: 8, background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating...' : 'Create Engagement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
