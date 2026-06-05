import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Plus, Mail, ExternalLink, RefreshCw } from 'lucide-react'
import { formatDate } from '../lib/constants'

const STAGE_STYLES = {
  not_contacted:      { bg: '#F7FAFC', color: '#718096',  label: 'Not Contacted' },
  sequence_active:    { bg: '#EBF8FF', color: '#2B6CB0',  label: 'Sequence Active' },
  expressed_interest: { bg: '#FFFBEB', color: '#B7791F',  label: 'Expressed Interest' },
  no_response:        { bg: '#F7FAFC', color: '#A0AEC0',  label: 'No Response' },
  bounced_opted_out:  { bg: '#FFF5F5', color: '#C53030',  label: 'Bounced / Opted Out' },
  converted:          { bg: '#F0FFF4', color: '#276749',  label: 'Converted' },
}

const SOURCE_LABELS = {
  linkedin_recruiter: 'LinkedIn Recruiter',
  referral: 'Referral',
  research: 'Research',
  other: 'Other',
}

export default function ProspectPool({ engagementId: propEngagementId }) {
  const params = useParams()
  const engagementId = propEngagementId || params.engagementId
  const { profile } = useAuth()
  const [prospects, setProspects] = useState([])
  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [engagementId])

  async function fetchData() {
    const [{ data: eng }, { data: pros }] = await Promise.all([
      supabase.from('engagements').select('id, client_name, role_title').eq('id', engagementId).single(),
      supabase.from('prospects').select('*').eq('engagement_id', engagementId).order('created_at', { ascending: false })
    ])
    setEngagement(eng)
    setProspects(pros || [])
    setLoading(false)
  }

  async function updateStage(prospectId, stage) {
    await supabase.from('prospects').update({ stage }).eq('id', prospectId)
    setProspects(p => p.map(pr => pr.id === prospectId ? { ...pr, stage } : pr))
  }

  const filtered = prospects.filter(p => {
    const matchesFilter = filter === 'all' || p.stage === filter
    const matchesSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.current_organization || '').toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const counts = prospects.reduce((acc, p) => { acc[p.stage] = (acc[p.stage] || 0) + 1; return acc }, {})

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D2B45', margin: 0 }}>Prospect Pool</h2>
          <p style={{ fontSize: 13, color: '#718096', margin: '4px 0 0' }}>{prospects.length} prospects · {counts.converted || 0} converted</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Add Prospect
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(STAGE_STYLES).map(([stage, style]) => (
          <button key={stage} onClick={() => setFilter(filter === stage ? 'all' : stage)}
            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, background: filter === stage ? style.color : style.bg, color: filter === stage ? '#fff' : style.color, border: `1px solid ${style.color}30`, borderRadius: 20, cursor: 'pointer' }}>
            {style.label} {counts[stage] ? `(${counts[stage]})` : '(0)'}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or organization..."
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }} />

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>
          <div style={{ fontSize: 14 }}>No prospects found</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F7FAFC' }}>
                {['Name', 'Title / Organization', 'Source', 'Stage', 'Added', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: '#718096' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const st = STAGE_STYLES[p.stage] || STAGE_STYLES.not_contacted
                return (
                  <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F7FAFC' : 'none' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0D2B45' }}>{p.full_name}</div>
                      {p.email && <div style={{ fontSize: 11, color: '#A0AEC0' }}>{p.email}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#4A5568' }}>
                      <div>{p.current_title || '—'}</div>
                      {p.current_organization && <div style={{ fontSize: 11, color: '#A0AEC0' }}>{p.current_organization}</div>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#718096', fontSize: 12 }}>{SOURCE_LABELS[p.source] || p.source}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <select value={p.stage} onChange={e => updateStage(p.id, e.target.value)}
                        style={{ fontSize: 11, fontWeight: 600, background: st.bg, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 20, padding: '3px 8px', cursor: 'pointer' }}>
                        {Object.entries(STAGE_STYLES).map(([val, s]) => <option key={val} value={val}>{s.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#A0AEC0', fontSize: 12 }}>{formatDate(p.created_at)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {p.linkedin_url && (
                          <a href={p.linkedin_url} target="_blank" rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2B6CB0', textDecoration: 'none' }}>
                            <ExternalLink size={12} /> LinkedIn
                          </a>
                        )}
                        {p.converted && p.linked_candidate_id && (
                          <span style={{ fontSize: 11, color: '#276749', fontWeight: 600 }}>✓ Converted</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddProspectModal
          engagementId={engagementId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); fetchData() }}
        />
      )}
    </div>
  )
}

function AddProspectModal({ engagementId, onClose, onAdded }) {
  const { profile } = useAuth()
  const [form, setForm] = useState({
    full_name: '', email: '', linkedin_url: '', current_title: '',
    current_organization: '', location: '', source: 'linkedin_recruiter',
    enroll_in_sequence: true, notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('prospects').insert({
      ...form,
      engagement_id: engagementId,
      stage: 'not_contacted',
      added_by: profile.id,
    })
    if (error) { setError(error.message); setSaving(false); return }
    onAdded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D2B45', margin: '0 0 1.5rem' }}>Add Prospect</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[['full_name', 'Full Name', true], ['email', 'Email', false]].map(([k, label, req]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>{label}{req && ' *'}</label>
                <input value={form[k]} onChange={e => set(k, e.target.value)} required={req} type={k === 'email' ? 'email' : 'text'}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          {[['linkedin_url', 'LinkedIn URL'], ['current_title', 'Current Title'], ['current_organization', 'Current Organization'], ['location', 'Location']].map(([k, label]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>{label}</label>
              <input value={form[k]} onChange={e => set(k, e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="linkedin_recruiter">LinkedIn Recruiter</option>
                <option value="referral">Referral</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
              <input type="checkbox" id="enroll" checked={form.enroll_in_sequence} onChange={e => set('enroll_in_sequence', e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="enroll" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}>Enroll in outreach sequence</label>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              style={{ width: '100%', minHeight: 70, padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Context, referral source, any relevant intel..." />
          </div>
          {error && <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#C53030', marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #CBD5E0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding...' : 'Add Prospect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
