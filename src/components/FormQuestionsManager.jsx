import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, GripVertical } from 'lucide-react'

const QUESTION_TYPES = {
  yes_no: 'Yes / No',
  multiple_choice: 'Multiple Choice',
  text: 'Open Text',
}

export default function FormQuestionsManager({ engagementId }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  // New question form state
  const [newQ, setNewQ] = useState({ question_text: '', question_type: 'yes_no', options: ['', ''], required: true, flag_type: 'other' })

  useEffect(() => { fetchQuestions() }, [engagementId])

  async function fetchQuestions() {
    const { data } = await supabase
      .from('engagement_form_questions')
      .select('*')
      .eq('engagement_id', engagementId)
      .order('display_order')
    setQuestions(data || [])
    setLoading(false)
  }

  async function addQuestion() {
    if (!newQ.question_text.trim()) return
    setSaving(true)
    const options = newQ.question_type === 'yes_no'
      ? ['Yes', 'No']
      : newQ.question_type === 'multiple_choice'
        ? newQ.options.filter(o => o.trim())
        : null

    const { error } = await supabase.from('engagement_form_questions').insert({
      engagement_id: engagementId,
      question_text: newQ.question_text.trim(),
      question_type: newQ.question_type,
      options,
      required: newQ.required,
      flag_type: newQ.flag_type || 'other',
      display_order: questions.length,
    })
    if (error) {
      alert(`Failed to save question: ${error.message}`)
      setSaving(false)
      return
    }
    setNewQ({ question_text: '', question_type: 'yes_no', options: ['', ''], required: true })
    setShowAdd(false)
    setSaving(false)
    await fetchQuestions()
  }

  async function deleteQuestion(id) {
    await supabase.from('engagement_form_questions').delete().eq('id', id)
    setQuestions(q => q.filter(qu => qu.id !== id))
  }

  const setOption = (i, val) => {
    const opts = [...newQ.options]
    opts[i] = val
    setNewQ(q => ({ ...q, options: opts }))
  }

  if (loading) return <div style={{ color: '#A0AEC0', fontSize: 13 }}>Loading...</div>

  return (
    <div>
      <div style={{ fontSize: 13, color: '#718096', marginBottom: 16, lineHeight: 1.6 }}>
        Custom questions appear on the public application form for this engagement. Candidates must answer required questions before submitting.
      </div>

      {questions.length === 0 && !showAdd && (
        <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '1.5rem', textAlign: 'center', marginBottom: 16, color: '#A0AEC0', fontSize: 13 }}>
          No custom questions yet.
        </div>
      )}

      {/* Existing questions */}
      {questions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {questions.map((q, i) => (
            <div key={q.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 4 }}>{q.question_text}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                    {QUESTION_TYPES[q.question_type]}
                  </span>
                  {q.required && (
                    <span style={{ fontSize: 11, background: '#FFF5F5', color: '#C53030', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                      Required
                    </span>
                  )}
                  {q.options && (
                    <span style={{ fontSize: 11, color: '#A0AEC0' }}>
                      Options: {q.options.join(' · ')}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => deleteQuestion(q.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0', padding: 4, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#C53030'}
                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E0'}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add question form */}
      {showAdd && (
        <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D2B45', marginBottom: 14 }}>New Question</div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>Question Text *</label>
            <input value={newQ.question_text} onChange={e => setNewQ(q => ({ ...q, question_text: e.target.value }))}
              placeholder="e.g. Are you authorized to work in the United States?"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>Question Type</label>
              <select value={newQ.question_type} onChange={e => setNewQ(q => ({ ...q, question_type: e.target.value, options: ['', ''] }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                {Object.entries(QUESTION_TYPES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>Flag Type</label>
              <select value={newQ.flag_type} onChange={e => setNewQ(q => ({ ...q, flag_type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="other">General</option>
                <option value="work_authorization">Work Authorization</option>
                <option value="location">Location / Relocation</option>
                <option value="compensation">Compensation</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input type="checkbox" id="required" checked={newQ.required} onChange={e => setNewQ(q => ({ ...q, required: e.target.checked }))} style={{ cursor: 'pointer' }} />
            <label htmlFor="required" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}>Required</label>
          </div>

          {newQ.question_type === 'yes_no' && (
            <div style={{ background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2B6CB0', marginBottom: 14 }}>
              Yes / No questions automatically use "Yes" and "No" as options.
            </div>
          )}

          {newQ.question_type === 'multiple_choice' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#4A5568', marginBottom: 8 }}>Answer Options</label>
              {newQ.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={opt} onChange={e => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13 }} />
                  {newQ.options.length > 2 && (
                    <button onClick={() => setNewQ(q => ({ ...q, options: q.options.filter((_, idx) => idx !== i) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E0' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setNewQ(q => ({ ...q, options: [...q.options, ''] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2B6CB0', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>
                <Plus size={13} /> Add option
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 16px', border: '1px solid #CBD5E0', background: '#fff', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={addQuestion} disabled={saving || !newQ.question_text.trim()}
              style={{ padding: '8px 16px', background: saving || !newQ.question_text.trim() ? '#A0AEC0' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Adding...' : 'Add Question'}
            </button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Add Question
        </button>
      )}
    </div>
  )
}
