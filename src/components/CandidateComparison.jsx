import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { RECOMMENDATION_COLORS, RECOMMENDATION_LABELS } from '../lib/constants'

export default function CandidateComparison({ engagementId }) {
  const [criteria, setCriteria] = useState([])
  const [candidates, setCandidates] = useState([])
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('screened')

  useEffect(() => { fetchData() }, [engagementId])

  async function fetchData() {
    const [{ data: crit }, { data: cands }, { data: scoreData }] = await Promise.all([
      supabase.from('assessment_criteria').select('*').eq('engagement_id', engagementId).order('display_order'),
      supabase.from('candidate_engagements')
        .select('*, candidates(*)')
        .eq('engagement_id', engagementId)
        .eq('not_proceeding', false)
        .gte('pipeline_stage', 3),
      supabase.from('scorecard_entries')
        .select('*, assessment_criteria(name)')
        .in('candidate_engagement_id',
          (await supabase.from('candidate_engagements').select('id').eq('engagement_id', engagementId)).data?.map(c => c.id) || []
        )
    ])
    setCriteria(crit || [])
    setCandidates(cands || [])
    // Build score map: { candidate_engagement_id: { criterion_id: { rating, narrative } } }
    const scoreMap = {}
    ;(scoreData || []).forEach(s => {
      if (!scoreMap[s.candidate_engagement_id]) scoreMap[s.candidate_engagement_id] = {}
      scoreMap[s.candidate_engagement_id][s.criterion_id] = { rating: s.rating, narrative: s.narrative }
    })
    setScores(scoreMap)
    setLoading(false)
  }

  const ratingColor = (r) => {
    if (!r) return '#E2E8F0'
    if (r >= 5) return '#276749'
    if (r >= 4) return '#2C7A7B'
    if (r >= 3) return '#B7791F'
    if (r >= 2) return '#C05621'
    return '#9B2C2C'
  }

  const avgRating = (ceId) => {
    if (!scores[ceId]) return null
    const ratings = Object.values(scores[ceId]).map(s => s.rating).filter(Boolean)
    if (!ratings.length) return null
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
  }

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading comparison...</div>

  if (criteria.length === 0) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#A0AEC0' }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>No Assessment Criteria defined</div>
      <div style={{ fontSize: 12 }}>Add criteria in the engagement settings to enable candidate comparison.</div>
    </div>
  )

  if (candidates.length === 0) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#A0AEC0' }}>
      <div style={{ fontSize: 14 }}>No screened candidates yet</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Candidates will appear here once they reach Stage 3 (1st Interview).</div>
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#718096', background: '#F7FAFC', borderBottom: '2px solid #E2E8F0', minWidth: 180, position: 'sticky', left: 0, zIndex: 1 }}>
              Assessment Criteria
            </th>
            {candidates.map(ce => (
              <th key={ce.id} style={{ textAlign: 'center', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#0D2B45', background: '#F7FAFC', borderBottom: '2px solid #E2E8F0', minWidth: 160, borderLeft: '1px solid #E2E8F0' }}>
                <div style={{ fontWeight: 700 }}>{ce.candidates?.full_name}</div>
                <div style={{ fontSize: 11, color: '#A0AEC0', fontWeight: 400, marginTop: 2 }}>{ce.candidates?.current_organization}</div>
                {ce.overall_recommendation && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: RECOMMENDATION_COLORS[ce.overall_recommendation] + '20', color: RECOMMENDATION_COLORS[ce.overall_recommendation] }}>
                      {RECOMMENDATION_LABELS[ce.overall_recommendation]}
                    </span>
                  </div>
                )}
                {avgRating(ce.id) && (
                  <div style={{ fontSize: 11, color: '#718096', marginTop: 4 }}>Avg: <strong>{avgRating(ce.id)}</strong>/5</div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((criterion, i) => (
            <tr key={criterion.id} style={{ background: i % 2 === 0 ? '#fff' : '#F7FAFC' }}>
              <td style={{ padding: '10px 16px', fontWeight: 600, color: '#4A5568', borderBottom: '1px solid #F0F4F8', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#F7FAFC', zIndex: 1 }}>
                {criterion.name}
              </td>
              {candidates.map(ce => {
                const score = scores[ce.id]?.[criterion.id]
                return (
                  <td key={ce.id} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #F0F4F8', borderLeft: '1px solid #F0F4F8', verticalAlign: 'top' }}>
                    {score?.rating ? (
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: ratingColor(score.rating), color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                          {score.rating}
                        </div>
                        {score.narrative && (
                          <div style={{ fontSize: 11, color: '#718096', lineHeight: 1.4, textAlign: 'left', marginTop: 4 }}>{score.narrative}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: '#CBD5E0' }}>Not rated</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
