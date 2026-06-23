import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDate, PIPELINE_STAGES } from '../lib/constants'
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Users, Briefcase } from 'lucide-react'

export default function Dashboard() {
  const [engagements, setEngagements] = useState([])
  const [firmMetrics, setFirmMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: engs } = await supabase
      .from('engagements')
      .select(`
        *,
        candidate_engagements(id, pipeline_stage, not_proceeding, stage_entered_at),
        workplan_tasks(id, status)
      `)
      .order('created_at', { ascending: false })

    const { data: prospects } = await supabase.from('prospects').select('engagement_id, converted')

    const enriched = (engs || []).map(eng => {
      const ces = eng.candidate_engagements || []
      const active = ces.filter(c => !c.not_proceeding)
      const tasks = eng.workplan_tasks || []
      const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'na').length
      const totalTasks = tasks.length
      const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

      // Overdue tasks — candidates awaiting review > 10 days
      const overdue = active.filter(c => {
        if (![1, 2].includes(c.pipeline_stage)) return false
        const days = Math.floor((Date.now() - new Date(c.stage_entered_at)) / (1000 * 60 * 60 * 24))
        return Math.floor(days * 5 / 7) >= 10
      }).length

      const engProspects = (prospects || []).filter(p => p.engagement_id === eng.id)
      const converted = engProspects.filter(p => p.converted).length
      const conversionRate = engProspects.length > 0 ? Math.round((converted / engProspects.length) * 100) : null

      return { ...eng, activeCount: active.length, completionPct, overdue, conversionRate, prospectCount: engProspects.length }
    })

    setEngagements(enriched)

    // Firm-level metrics
    const activeEngs = enriched.filter(e => e.status === 'active')
    const totalCandidates = enriched.reduce((sum, e) => sum + (e.candidate_engagements?.filter(c => !c.not_proceeding).length || 0), 0)
    const totalProspects = (prospects || []).length
    const totalConverted = (prospects || []).filter(p => p.converted).length
    const placements = enriched.filter(e => e.candidate_engagements?.some(c => c.pipeline_stage === 10)).length

    setFirmMetrics({ activeEngagements: activeEngs.length, totalCandidates, totalProspects, totalConverted, placements })
    setLoading(false)
  }

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', margin: 0 }}>Firm Dashboard</h1>
        <p style={{ fontSize: 13, color: '#718096', margin: '4px 0 0' }}>Portfolio overview across all engagements</p>
      </div>

      {/* Firm-level stats */}
      {firmMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 28 }}>
          <FirmStat icon={<Briefcase size={18} />} label="Active Searches" value={firmMetrics.activeEngagements} color="#0D2B45" />
          <FirmStat icon={<Users size={18} />} label="Total Candidates" value={firmMetrics.totalCandidates} color="#0B6E6E" />
          <FirmStat icon={<TrendingUp size={18} />} label="Prospects Sourced" value={firmMetrics.totalProspects} color="#553C9A" />
          <FirmStat icon={<CheckCircle size={18} />} label="Converted" value={firmMetrics.totalConverted} color="#276749" />
          <FirmStat icon={<CheckCircle size={18} />} label="Placements" value={firmMetrics.placements} color="#B7791F" />
        </div>
      )}

      {/* Engagement health table */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Engagement Health</div>
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F7FAFC', borderBottom: '2px solid #E2E8F0' }}>
              {['Engagement', 'Status', 'Candidates', 'Workplan', 'Conversion', 'Alerts', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#718096' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {engagements.map((eng, i) => (
              <tr key={eng.id} style={{ borderBottom: i < engagements.length - 1 ? '1px solid #F7FAFC' : 'none' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: '#0D2B45' }}>{eng.role_title}</div>
                  <div style={{ fontSize: 12, color: '#718096' }}>{eng.client_name}</div>
                  {eng.target_close_date && (
                    <div style={{ fontSize: 11, color: '#A0AEC0', marginTop: 2 }}>Target close: {formatDate(eng.target_close_date)}</div>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: eng.status === 'active' ? '#E6FFFA' : eng.status === 'on_hold' ? '#FFFBEB' : '#F7FAFC',
                    color: eng.status === 'active' ? '#0B6E6E' : eng.status === 'on_hold' ? '#B7791F' : '#718096',
                  }}>{eng.status === 'active' ? 'Active' : eng.status === 'on_hold' ? 'On Hold' : 'Closed'}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2B45' }}>{eng.activeCount}</div>
                  <div style={{ fontSize: 11, color: '#A0AEC0' }}>active</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: '#F0F4F8', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ width: `${eng.completionPct}%`, height: '100%', background: eng.completionPct === 100 ? '#276749' : '#0B6E6E', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#718096', flexShrink: 0 }}>{eng.completionPct}%</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {eng.conversionRate !== null
                    ? <span style={{ fontSize: 13, fontWeight: 600, color: eng.conversionRate >= 20 ? '#276749' : eng.conversionRate >= 10 ? '#B7791F' : '#C53030' }}>{eng.conversionRate}%</span>
                    : <span style={{ fontSize: 12, color: '#CBD5E0' }}>No outreach</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {eng.overdue > 0
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#C53030' }}><AlertTriangle size={14} /> {eng.overdue} overdue</div>
                    : <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A0AEC0' }}><CheckCircle size={14} /> Clear</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link to={`/engagements/${eng.id}`} style={{ fontSize: 12, color: '#0B6E6E', textDecoration: 'none', fontWeight: 500 }}>Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FirmStat({ icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color }}>
        {icon}
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}
