import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, GripVertical } from 'lucide-react'

export default function AssessmentCriteriaManager({ engagementId }) {
  const [criteria, setCriteria] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchCriteria() }, [engagementId])

  async function fetchCriteria() {
    const { data } = await supabase.from('assessment_criteria').select('*').eq('engagement_id', engagementId).order('display_order')
    setCriteria(data || [])
    setLoading(false)
  }

  async function addCriterion() {
    if (!newName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('assessment_criteria').insert({
      engagement_id: engagementId,
      name: newName.trim(),
      display_order: criteria.length,
    }).select().single()
    if (data) setCriteria(c => [...c, data])
    setNewName('')
    setAdding(false)
  }

  async function deleteCriterion(id) {
    await supabase.from('assessment_criteria').delete().eq('id', id)
    setCriteria(c => c.filter(cr => cr.id !== id))
  }

  if (loading) return <div style={{ color: '#A0AEC0', fontSize: 13 }}>Loading...</div>

  return (
    <div>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 12, lineHeight: 1.5 }}>
        Assessment Criteria drive the scorecard for every candidate in this engagement. Add 4–6 criteria based on the role's Key Pillars.
      </div>

      {criteria.length === 0 ? (
        <div style={{ background: '#FFFBEB', border: '1px solid #F6AD55', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#744210', marginBottom: 12 }}>
          No criteria yet — add your first one below.
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {criteria.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#4A5568', flex: 1 }}>{c.name}</span>
              <button onClick={() => deleteCriterion(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0', padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCriterion()}
          placeholder="e.g. Fundraising Track Record"
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <button onClick={addCriterion} disabled={adding || !newName.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer', opacity: adding || !newName.trim() ? 0.5 : 1 }}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
