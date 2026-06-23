import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RECOMMENDATION_LABELS, RECOMMENDATION_COLORS } from '../lib/constants'

export default function Scorecard({ candidateEngagementId, engagementId, currentStage }) {
  const { profile } = useAuth()
  const [criteria, setCriteria] = useState([])
  const [scores, setScores] = useState({})
  const [recommendation, setRecommendation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchData() }, [candidateEngagementId, engagementId])

  async function fetchData() {
    const [{ data: crit }, { data: existing }] = await Promise.all([
      supabase.from('assessment_criteria').select('*').eq('engagement_id', engagementId).order('display_order'),
      supabase.from('scorecard_entries').select('*').eq('candidate_engagement_id', candidateEngagementId)
    ])
    setCriteria(crit || [])
    // Load existing scores
    const scoreMap = {}
    ;(existing || []).forEach(s => { scoreMap[s.criterion_id] = { rating: s.rating, narrative: s.narrative } })
    setScores(scoreMap)
    // Load existing recommendation
    const { data: ce } = await supabase.from('candidate_engagements').select('overall_recommendation').eq('id', candidateEngagementId).single()
    if (ce?.overall_recommendation) setRecommendation(ce.overall_recommendation)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    // Upsert each criterion score
    for (const criterion of criteria) {
      const score = scores[criterion.id]
      if (!score?.rating) continue
      await supabase.from('scorecard_entries').upsert({
        candidate_engagement_id: candidateEngagementId,
        criterion_id: criterion.id,
        rating: score.rating,
        narrative: score.narrative || '',
        scored_by: profile.id,
        scored_at: new Date().toISOString(),
      }, { onConflict: 'candidate_engagement_id,criterion_id' })
    }
    // Save overall recommendation
    if (recommendation) {
      await supabase.from('candidate_engagements').update({ overall_recommendation: recommendation }).eq('id', candidateEngagementId)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setScore = (criterionId, field, value) => {
    setScores(s => ({ ...s, [criterionId]: { ...s[criterionId], [field]: value } }))
  }

  if (loading) return <div style={{ color: '#A0AEC0', fontSize: 13 }}>Loading scorecard...</div>

  if (criteria.length === 0) return (
    <div style={{ background: '#FFFBEB', border: '1px solid #F6AD55', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#744210' }}>
      No Assessment Criteria defined for this engagement yet. Add criteria in the engagement settings to enable scorecards.
    </div>
  )

  const completedCount = criteria.filter(c => scores[c.id]?.rating).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#A0AEC0' }}>{completedCount} of {criteria.length} criteria rated</div>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: saved ? '#38A169' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Scorecard'}
        </button>
      </div>

      {criteria.map((criterion, i) => (
        <div key={criterion.id} style={{ marginBottom: 16, padding: 14, background: '#F7FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 10 }}>{criterion.name}</div>
          {/* Star rating */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setScore(criterion.id, 'rating', n)}
                style={{
                  width: 36, height: 36, borderRadius: 6, border: '1px solid',
                  borderColor: scores[criterion.id]?.rating >= n ? '#0B6E6E' : '#CBD5E0',
                  background: scores[criterion.id]?.rating >= n ? '#0B6E6E' : '#fff',
                  color: scores[criterion.id]?.rating >= n ? '#fff' : '#718096',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>
                {n}
              </button>
            ))}
            {scores[criterion.id]?.rating && (
              <span style={{ fontSize: 12, color: '#718096', alignSelf: 'center', marginLeft: 4 }}>
                {['', 'Weak', 'Below average', 'Average', 'Strong', 'Exceptional'][scores[criterion.id].rating]}
              </span>
            )}
          </div>
          <textarea
            value={scores[criterion.id]?.narrative || ''}
            onChange={e => setScore(criterion.id, 'narrative', e.target.value)}
            placeholder="Brief narrative (1–3 sentences)..."
            style={{ width: '100%', minHeight: 64, padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568' }}
          />
        </div>
      ))}

      {/* Overall recommendation */}
      <div style={{ marginTop: 4, padding: 14, background: '#F7FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 10 }}>Overall Recommendation</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(RECOMMENDATION_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setRecommendation(key)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: '1px solid',
                borderColor: recommendation === key ? RECOMMENDATION_COLORS[key] : '#CBD5E0',
                background: recommendation === key ? RECOMMENDATION_COLORS[key] : '#fff',
                color: recommendation === key ? '#fff' : '#718096',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
