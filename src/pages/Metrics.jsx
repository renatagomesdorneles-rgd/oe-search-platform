import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PIPELINE_STAGES, REJECTION_REASONS } from '../lib/constants'
import { Link } from 'react-router-dom'

export default function Metrics() {
  const [engagements, setEngagements] = useState([])
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEngagements() }, [])
  useEffect(() => { if (selected) fetchMetrics(selected) }, [selected])

  async function fetchEngagements() {
    const { data } = await supabase.from('engagements').select('id, client_name, role_title, status').order('created_at', { ascending: false })
    setEngagements(data || [])
    if (data?.length) { setSelected(data[0].id) }
    setLoading(false)
  }

  async function fetchMetrics(engagementId) {
    const [
      { data: prospects },
      { data: candidates },
      { count: totalCandidates },
    ] = await Promise.all([
      supabase.from('prospects').select('*').eq('engagement_id', engagementId),
      supabase.from('candidate_engagements').select('*, candidates(entry_type, gender_self_reported, race_ethnicity_self_reported, zip_code)').eq('engagement_id', engagementId),
      supabase.from('candidate_engagements').select('*', { count: 'exact', head: true }).eq('engagement_id', engagementId),
    ])

    const pros = prospects || []
    const cands = candidates || []

    // Prospect funnel
    const totalProspects = pros.length
    const contacted = pros.filter(p => p.stage !== 'not_contacted').length
    const expressedInterest = pros.filter(p => p.stage === 'expressed_interest').length
    const converted = pros.filter(p => p.converted).length
    const conversionRate = contacted > 0 ? ((converted / contacted) * 100).toFixed(1) : 0

    // Candidate pipeline
    const active = cands.filter(c => !c.not_proceeding)
    const notProceeding = cands.filter(c => c.not_proceeding)
    const byStage = {}
    Object.keys(PIPELINE_STAGES).forEach(s => {
      byStage[s] = active.filter(c => c.pipeline_stage === parseInt(s)).length
    })

    // Entry types
    const inbound = cands.filter(c => c.candidates?.entry_type === 'inbound_application').length
    const fromOutreach = cands.filter(c => c.candidates?.entry_type === 'converted_from_prospect').length

    // Rejection reasons breakdown
    const rejectionBreakdown = {}
    notProceeding.forEach(c => {
      const r = c.not_proceeding_reason || 'other'
      rejectionBreakdown[r] = (rejectionBreakdown[r] || 0) + 1
    })

    // Demographics - applicant pool (self-reported)
    const genderCounts = {}
    const raceCounts = {}
    cands.forEach(c => {
      const g = c.candidates?.gender_self_reported
      if (g && g !== 'Prefer not to say') genderCounts[g] = (genderCounts[g] || 0) + 1
      const races = c.candidates?.race_ethnicity_self_reported || []
      races.forEach(r => { if (r !== 'Prefer not to say') raceCounts[r] = (raceCounts[r] || 0) + 1 })
    })

    setMetrics({
      totalProspects, contacted, expressedInterest, converted, conversionRate,
      totalCandidates: cands.length, active: active.length, notProceeding: notProceeding.length,
      byStage, inbound, fromOutreach, rejectionBreakdown, genderCounts, raceCounts,
      submitted: active.filter(c => c.pipeline_stage >= 6).length,
      interviewed: active.filter(c => c.pipeline_stage >= 3).length,
    })
  }

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading...</div>

  const eng = engagements.find(e => e.id === selected)

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', margin: 0 }}>Metrics</h1>
          <p style={{ fontSize: 13, color: '#718096', margin: '4px 0 0' }}>Live engagement data</p>
        </div>
        <select value={selected || ''} onChange={e => setSelected(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, color: '#0D2B45', fontWeight: 500, cursor: 'pointer' }}>
          {engagements.map(e => (
            <option key={e.id} value={e.id}>{e.role_title} — {e.client_name}</option>
          ))}
        </select>
      </div>

      {!metrics ? (
        <div style={{ color: '#A0AEC0' }}>Loading metrics...</div>
      ) : (
        <div>
          {/* Outreach Funnel */}
          <SectionHeader title="Outreach Funnel" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard label="Prospects Sourced" value={metrics.totalProspects} color="#0D2B45" />
            <StatCard label="Contacted" value={metrics.contacted} color="#2B6CB0" />
            <StatCard label="Expressed Interest" value={metrics.expressedInterest} color="#B7791F" />
            <StatCard label="Converted to Candidate" value={metrics.converted} color="#0B6E6E" />
            <StatCard label="Conversion Rate" value={`${metrics.conversionRate}%`} color="#276749" highlight />
          </div>

          {/* Candidate Pipeline */}
          <SectionHeader title="Candidate Pipeline" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard label="Total Candidates" value={metrics.totalCandidates} color="#0D2B45" />
            <StatCard label="Active in Pipeline" value={metrics.active} color="#0B6E6E" />
            <StatCard label="Interviews Conducted" value={metrics.interviewed} color="#553C9A" />
            <StatCard label="Submitted to Client" value={metrics.submitted} color="#276749" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatCard label="From Outreach" value={metrics.fromOutreach} color="#2B6CB0" />
            <StatCard label="Inbound Applications" value={metrics.inbound} color="#553C9A" />
          </div>

          {/* Pipeline by stage */}
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D2B45', marginBottom: 14 }}>Candidates by Stage</div>
            {Object.entries(PIPELINE_STAGES).map(([num, stage]) => {
              const count = metrics.byStage[num] || 0
              const pct = metrics.active > 0 ? (count / metrics.active) * 100 : 0
              return (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#718096', width: 220, flexShrink: 0 }}>{stage.label}</div>
                  <div style={{ flex: 1, height: 8, background: '#F0F4F8', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#0B6E6E', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0D2B45', width: 24, textAlign: 'right' }}>{count}</div>
                </div>
              )
            })}
            {metrics.notProceeding > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F4F8' }}>
                <div style={{ fontSize: 12, color: '#C53030', width: 220, flexShrink: 0 }}>Not Proceeding</div>
                <div style={{ flex: 1 }} />
                <div style={{ fontSize: 12, fontWeight: 600, color: '#C53030', width: 24, textAlign: 'right' }}>{metrics.notProceeding}</div>
              </div>
            )}
          </div>

          {/* Not Proceeding Breakdown */}
          {Object.keys(metrics.rejectionBreakdown).length > 0 && (
            <>
              <SectionHeader title="Not Proceeding — By Reason" />
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', marginBottom: 24 }}>
                {Object.entries(metrics.rejectionBreakdown).map(([reason, count]) => (
                  <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F7FAFC', fontSize: 13 }}>
                    <span style={{ color: '#4A5568' }}>{REJECTION_REASONS[reason] || reason}</span>
                    <span style={{ fontWeight: 600, color: '#C53030' }}>{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Demographics */}
          {(Object.keys(metrics.genderCounts).length > 0 || Object.keys(metrics.raceCounts).length > 0) && (
            <>
              <SectionHeader title="Applicant Pool — Demographics (Self-Reported)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <DemoCard title="Gender Identity" data={metrics.genderCounts} total={metrics.totalCandidates} />
                <DemoCard title="Race / Ethnicity" data={metrics.raceCounts} total={metrics.totalCandidates} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
}

function StatCard({ label, value, color, highlight }) {
  return (
    <div style={{ background: highlight ? color : '#fff', border: `1px solid ${highlight ? color : '#E2E8F0'}`, borderRadius: 10, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: highlight ? '#fff' : color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.8)' : '#718096' }}>{label}</div>
    </div>
  )
}

function DemoCard({ title, data, total }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D2B45', marginBottom: 12 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: '#A0AEC0' }}>No data reported</div>
      ) : entries.map(([label, count]) => {
        const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0
        return (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ color: '#4A5568' }}>{label}</span>
              <span style={{ color: '#718096' }}>{count} ({pct}%)</span>
            </div>
            <div style={{ height: 6, background: '#F0F4F8', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#0B6E6E', borderRadius: 3 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
