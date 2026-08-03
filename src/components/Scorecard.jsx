import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const RATINGS = [
  { value: 'exceeds',        label: 'Exceeds Expectations',  color: '#276749', bg: '#F0FFF4', border: '#9AE6B4' },
  { value: 'meets',          label: 'Meets Expectations',    color: '#2B6CB0', bg: '#EBF8FF', border: '#BEE3F8' },
  { value: 'partially_meets', label: 'Partially Meets',      color: '#B7791F', bg: '#FFFBEB', border: '#F6E05E' },
  { value: 'does_not_meet',  label: 'Does Not Meet',         color: '#9B2C2C', bg: '#FFF5F5', border: '#FEB2B2' },
  { value: 'not_assessed',   label: 'Not Assessed',          color: '#718096', bg: '#F7FAFC', border: '#CBD5E0' },
]

const OVERALL_RATINGS = [
  { value: 'strong_yes', label: 'Strong Yes', color: '#276749', bg: '#F0FFF4' },
  { value: 'yes',        label: 'Yes',        color: '#2C7A7B', bg: '#E6FFFA' },
  { value: 'maybe',      label: 'Maybe',      color: '#B7791F', bg: '#FFFBEB' },
  { value: 'no',         label: 'No',         color: '#9B2C2C', bg: '#FFF5F5' },
]

export default function Scorecard({ candidateEngagementId, engagementId }) {
  const { profile } = useAuth()
  const [criteria, setCriteria] = useState([])
  const [scores, setScores] = useState({})
  const [recommendation, setRecommendation] = useState('')
  const [recommendationNotes, setRecommendationNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchData() }, [candidateEngagementId, engagementId])

  async function fetchData() {
    const [{ data: crit }, { data: existing }, { data: ce }] = await Promise.all([
      supabase.from('assessment_criteria').select('*').eq('engagement_id', engagementId).order('display_order'),
      supabase.from('scorecard_entries').select('*').eq('candidate_engagement_id', candidateEngagementId),
      supabase.from('candidate_engagements').select('overall_recommendation').eq('id', candidateEngagementId).single(),
    ])
    setCriteria(crit || [])
    const scoreMap = {}
    ;(existing || []).forEach(s => { scoreMap[s.criterion_id] = { rating: s.rating, narrative: s.narrative } })
    setScores(scoreMap)
    if (ce?.overall_recommendation) setRecommendation(ce.overall_recommendation)
    if (ce?.recommendation_notes) setRecommendationNotes(ce.recommendation_notes)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    let saveErrors = []
    for (const criterion of criteria) {
      const score = scores[criterion.id]
      if (!score?.rating) continue
      const { error } = await supabase.from('scorecard_entries').upsert({
        candidate_engagement_id: candidateEngagementId,
        criterion_id: criterion.id,
        rating: score.rating,
        narrative: score.narrative || '',
        scored_by: profile.id,
        scored_at: new Date().toISOString(),
      }, { onConflict: 'candidate_engagement_id,criterion_id' })
      if (error) saveErrors.push(`${criterion.name}: ${error.message}`)
    }
    if (saveErrors.length > 0) {
      alert('Some scores failed to save:\n' + saveErrors.join('\n'))
      setSaving(false)
      return
    }
    if (recommendation) {
      await supabase.from('candidate_engagements').update({
        overall_recommendation: recommendation,
        recommendation_notes: recommendationNotes || null,
      }).eq('id', candidateEngagementId)
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
      No Assessment Criteria defined for this engagement yet. Add criteria under the Assessment Criteria tab to enable scorecards.
    </div>
  )

  const ratedCount = criteria.filter(c => scores[c.id]?.rating).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#A0AEC0' }}>{ratedCount} of {criteria.length} criteria rated</div>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, background: saved ? '#276749' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save Scorecard'}
        </button>
      </div>

      {criteria.map(criterion => {
        const score = scores[criterion.id]
        return (
          <div key={criterion.id} style={{ marginBottom: 14, padding: 14, background: '#F7FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 10 }}>{criterion.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {RATINGS.map(r => {
                const selected = score?.rating === r.value
                return (
                  <button key={r.value} onClick={() => setScore(criterion.id, 'rating', selected ? null : r.value)}
                    style={{
                      padding: '8px 12px', borderRadius: 6, border: `1px solid ${selected ? r.border : '#E2E8F0'}`,
                      background: selected ? r.bg : '#fff', color: selected ? r.color : '#718096',
                      fontSize: 12, fontWeight: selected ? 700 : 400, cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.1s',
                    }}>
                    {r.label}
                  </button>
                )
              })}
            </div>
            <textarea value={score?.narrative || ''} onChange={e => setScore(criterion.id, 'narrative', e.target.value)}
              placeholder="Notes — paste interview transcript excerpts or observations here..."
              style={{ width: '100%', minHeight: 120, padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568', lineHeight: 1.6 }} />
          </div>
        )
      })}

      <div style={{ padding: 14, background: '#F7FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 10 }}>Overall Recommendation</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {OVERALL_RATINGS.map(r => {
            const selected = recommendation === r.value
            return (
              <button key={r.value} onClick={() => setRecommendation(selected ? '' : r.value)}
                style={{
                  padding: '8px', borderRadius: 6, border: `1px solid ${selected ? r.color : '#E2E8F0'}`,
                  background: selected ? r.bg : '#fff', color: selected ? r.color : '#718096',
                  fontSize: 12, fontWeight: selected ? 700 : 400, cursor: 'pointer', transition: 'all 0.1s',
                }}>
                {r.label}
              </button>
            )
          })}
        </div>
        <textarea value={recommendationNotes} onChange={e => setRecommendationNotes(e.target.value)}
          placeholder="Comments on your overall recommendation..."
          style={{ width: '100%', minHeight: 100, padding: '8px 10px', border: '1px solid #CBD5E0', borderRadius: 6, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568', lineHeight: 1.6 }} />
      </div>
    </div>
  )
}
