import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PIPELINE_STAGES, NOT_PROCEEDING_ELIGIBLE_STAGES, getAgingStatus, REJECTION_REASONS, formatDate, getInitials, RECOMMENDATION_COLORS } from '../lib/constants'
import { ArrowLeft, Plus, Clock, CheckCircle, X, Mail, Link2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ProspectPool from './ProspectPool'
import Scorecard from '../components/Scorecard'
import AssessmentCriteriaManager from '../components/AssessmentCriteriaManager'
import CandidateComparison from '../components/CandidateComparison'

export default function EngagementDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [engagement, setEngagement] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [showRejection, setShowRejection] = useState(null)
  const [activeView, setActiveView] = useState('pipeline')

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    const [engRes, candRes] = await Promise.all([
      supabase.from('engagements').select('*, assessment_criteria(*)').eq('id', id).single(),
      supabase.from('candidate_engagements').select('*, candidates(*)').eq('engagement_id', id).order('created_at', { ascending: false })
    ])
    setEngagement(engRes.data)
    setCandidates(candRes.data || [])
    setLoading(false)
  }

  async function moveStage(ceId, newStage) {
    const ce = candidates.find(c => c.id === ceId)
    await supabase.from('candidate_engagements').update({ pipeline_stage: newStage, stage_entered_at: new Date().toISOString() }).eq('id', ceId)
    await supabase.from('stage_history').insert({ candidate_engagement_id: ceId, from_stage: ce.pipeline_stage, to_stage: newStage, changed_by: profile.id })
    fetchData()
  }

  async function markNotProceeding(ceId, reason, notes) {
    await supabase.from('candidate_engagements').update({
      not_proceeding: true, not_proceeding_reason: reason,
      not_proceeding_notes: notes, not_proceeding_at: new Date().toISOString(),
    }).eq('id', ceId)
    await supabase.from('stage_history').insert({
      candidate_engagement_id: ceId,
      from_stage: candidates.find(c => c.id === ceId)?.pipeline_stage,
      to_stage: null, changed_by: profile.id,
      notes: `Not Proceeding: ${REJECTION_REASONS[reason]}`
    })
    setShowRejection(null)
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#718096' }}>Loading...</div>
  if (!engagement) return <div style={{ padding: '2rem', color: '#718096' }}>Engagement not found</div>

  const activeCandidates = candidates.filter(c => !c.not_proceeding)
  const notProceedingCandidates = candidates.filter(c => c.not_proceeding)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '1rem 1.5rem', flexShrink: 0 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#718096', textDecoration: 'none', marginBottom: 8 }}>
          <ArrowLeft size={14} /> Engagements
        </Link>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0D2B45', margin: 0 }}>{engagement.role_title}</h1>
            <div style={{ fontSize: 14, color: '#718096', marginTop: 2 }}>{engagement.client_name}{engagement.location && ` · ${engagement.location}`}</div>
            {engagement.application_form_slug && (
              <a href={`/apply/${engagement.application_form_slug}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#0B6E6E', marginTop: 4, textDecoration: 'none' }}>
                <Link2 size={12} /> Application form link
              </a>
            )}
          </div>
          <button onClick={() => setShowAddCandidate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Add Candidate
          </button>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid #E2E8F0' }}>
          {[['pipeline', 'Pipeline'], ['list', 'All Candidates'], ['comparison', 'Comparison'], ['prospects', 'Prospects'], ['criteria', 'Assessment Criteria'], ['workplan', 'Workplan']].map(([v, label]) => (
            <button key={v} onClick={() => setActiveView(v)} style={{
              padding: '6px 14px', fontSize: 13, fontWeight: activeView === v ? 600 : 400,
              color: activeView === v ? '#0D2B45' : '#718096', background: 'none', border: 'none',
              borderBottom: activeView === v ? '2px solid #0B6E6E' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {activeView === 'pipeline' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '1rem 1.5rem', display: 'flex', gap: 10 }}>
          {Object.entries(PIPELINE_STAGES).map(([stageNum, stageInfo]) => {
            const stageCandidates = activeCandidates.filter(c => c.pipeline_stage === parseInt(stageNum))
            return (
              <div key={stageNum} style={{ flexShrink: 0, width: 240, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', marginBottom: 2 }}>{stageInfo.label}</div>
                  <div style={{ fontSize: 11, color: '#A0AEC0' }}>{stageCandidates.length} candidate{stageCandidates.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ flex: 1, background: '#F7F9FA', borderRadius: 8, padding: 8, overflowY: 'auto', minHeight: 200, border: '1px solid #E2E8F0' }}>
                  {stageCandidates.map(ce => (
                    <CandidateCard key={ce.id} ce={ce} stageNum={parseInt(stageNum)}
                      onOpen={() => setSelectedCandidate(ce)}
                      onReject={() => setShowRejection(ce)}
                      onMoveNext={() => moveStage(ce.id, parseInt(stageNum) + 1)} />
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ flexShrink: 0, width: 240, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9B2C2C', marginBottom: 2 }}>Not Proceeding</div>
              <div style={{ fontSize: 11, color: '#A0AEC0' }}>{notProceedingCandidates.length}</div>
            </div>
            <div style={{ flex: 1, background: '#FFF5F5', borderRadius: 8, padding: 8, overflowY: 'auto', minHeight: 200, border: '1px solid #FED7D7' }}>
              {notProceedingCandidates.map(ce => (
                <div key={ce.id} onClick={() => setSelectedCandidate(ce)}
                  style={{ background: '#fff', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', opacity: 0.75 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#742A2A' }}>{ce.candidates?.full_name}</div>
                  <div style={{ fontSize: 11, color: '#FC8181', marginTop: 2 }}>{REJECTION_REASONS[ce.not_proceeding_reason]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <CandidateTable candidates={candidates} onOpen={setSelectedCandidate} />
        </div>
      )}

      {activeView === 'comparison' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <CandidateComparison engagementId={id} />
        </div>
      )}

      {activeView === 'prospects' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ProspectPool engagementId={id} />
        </div>
      )}

      {activeView === 'criteria' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2B45', margin: '0 0 1rem' }}>Assessment Criteria</h2>
          <div style={{ maxWidth: 540 }}>
            <AssessmentCriteriaManager engagementId={id} />
          </div>
        </div>
      )}

      {activeView === 'workplan' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <WorkplanView engagementId={id} />
        </div>
      )}

      {selectedCandidate && (
        <CandidateModal ce={selectedCandidate} engagement={engagement}
          onClose={() => { setSelectedCandidate(null); fetchData() }}
          onMoveStage={(newStage) => { moveStage(selectedCandidate.id, newStage); fetchData() }}
          onReject={() => { setShowRejection(selectedCandidate); setSelectedCandidate(null) }} />
      )}
      {showRejection && <RejectionModal ce={showRejection} onClose={() => setShowRejection(null)} onConfirm={markNotProceeding} />}
      {showAddCandidate && <AddCandidateModal engagementId={id} onClose={() => setShowAddCandidate(false)} onAdded={() => { setShowAddCandidate(false); fetchData() }} />}
    </div>
  )
}

function CandidateCard({ ce, stageNum, onOpen, onReject, onMoveNext }) {
  const aging = getAgingStatus(ce.stage_entered_at, ce.pipeline_stage)
  const agingColors = { amber: { bg: '#FFFBEB', border: '#F6AD55', dot: '#ED8936' }, red: { bg: '#FFF5F5', border: '#FC8181', dot: '#E53E3E' } }
  const ac = agingColors[aging]
  return (
    <div style={{ background: ac ? ac.bg : '#fff', border: `1px solid ${ac ? ac.border : '#E2E8F0'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }} onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', marginBottom: 2 }}>{ce.candidates?.full_name}</div>
          <div style={{ fontSize: 11, color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ce.candidates?.current_title}</div>
          {ce.candidates?.current_organization && <div style={{ fontSize: 11, color: '#A0AEC0' }}>{ce.candidates.current_organization}</div>}
        </div>
        {aging !== 'normal' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: ac.dot, flexShrink: 0, marginTop: 3 }} />}
      </div>
      {ce.overall_recommendation && (
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: RECOMMENDATION_COLORS[ce.overall_recommendation] + '20', color: RECOMMENDATION_COLORS[ce.overall_recommendation] }}>
            {ce.overall_recommendation.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
        {NOT_PROCEEDING_ELIGIBLE_STAGES.includes(stageNum) && (
          <button onClick={onReject} style={{ flex: 1, padding: '4px 8px', fontSize: 11, background: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: 6, cursor: 'pointer' }}>Not Proceeding</button>
        )}
        {stageNum < 10 && (
          <button onClick={onMoveNext} style={{ flex: 1, padding: '4px 8px', fontSize: 11, background: '#EBF8FF', color: '#2B6CB0', border: '1px solid #BEE3F8', borderRadius: 6, cursor: 'pointer' }}>Advance →</button>
        )}
      </div>
    </div>
  )
}

function CandidateTable({ candidates, onOpen }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
          {['Name', 'Title / Organization', 'Stage', 'Applied', 'Entry', 'Status'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#718096' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {candidates.map(ce => (
          <tr key={ce.id} onClick={() => onOpen(ce)} style={{ borderBottom: '1px solid #F7FAFC', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F7FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0D2B45' }}>{ce.candidates?.full_name}</td>
            <td style={{ padding: '10px 12px', color: '#4A5568' }}>
              <div>{ce.candidates?.current_title}</div>
              <div style={{ fontSize: 11, color: '#A0AEC0' }}>{ce.candidates?.current_organization}</div>
            </td>
            <td style={{ padding: '10px 12px' }}>
              {ce.not_proceeding
                ? <span style={{ fontSize: 11, fontWeight: 600, background: '#FFF5F5', color: '#C53030', padding: '2px 8px', borderRadius: 20 }}>Not Proceeding</span>
                : <span style={{ fontSize: 11, fontWeight: 600, background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: 20 }}>{PIPELINE_STAGES[ce.pipeline_stage]?.label}</span>
              }
            </td>
            <td style={{ padding: '10px 12px', color: '#718096' }}>{formatDate(ce.candidates?.date_applied)}</td>
            <td style={{ padding: '10px 12px', color: '#718096', fontSize: 11 }}>{ce.candidates?.entry_type === 'converted_from_prospect' ? 'Outreach' : 'Inbound'}</td>
            <td style={{ padding: '10px 12px' }}>
              {ce.acknowledgment_email_sent
                ? <span style={{ fontSize: 11, color: '#38A169', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Ack sent</span>
                : <span style={{ fontSize: 11, color: '#A0AEC0' }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CandidateModal({ ce, engagement, onClose, onMoveStage, onReject }) {
  const { profile } = useAuth()
  const [notes, setNotes] = useState(ce.general_notes || '')
  const [nextStep1, setNextStep1] = useState(ce.next_step_sent_1 || false)
  const [nextStep2, setNextStep2] = useState(ce.next_step_sent_2 || false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const aging = getAgingStatus(ce.stage_entered_at, ce.pipeline_stage)
  const canReject = NOT_PROCEEDING_ELIGIBLE_STAGES.includes(ce.pipeline_stage) && !ce.not_proceeding
  const showScorecard = ce.pipeline_stage >= 3 && !ce.not_proceeding

  async function saveNotes() {
    setSaving(true)
    await supabase.from('candidate_engagements').update({ general_notes: notes }).eq('id', ce.id)
    setSaving(false)
  }

  async function toggleNextStep(step) {
    const field = step === 1 ? 'next_step_sent_1' : 'next_step_sent_2'
    const timeField = step === 1 ? 'next_step_sent_1_at' : 'next_step_sent_2_at'
    const newVal = step === 1 ? !nextStep1 : !nextStep2
    if (step === 1) setNextStep1(newVal); else setNextStep2(newVal)
    await supabase.from('candidate_engagements').update({ [field]: newVal, [timeField]: newVal ? new Date().toISOString() : null }).eq('id', ce.id)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 50 }}>
      <div style={{ background: '#fff', width: 560, height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0D2B45', margin: 0 }}>{ce.candidates?.full_name}</h2>
              <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>{ce.candidates?.current_title}{ce.candidates?.current_organization && ` · ${ce.candidates.current_organization}`}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#718096' }}><X size={20} /></button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {[['details', 'Details'], ...(showScorecard ? [['scorecard', 'Scorecard']] : [])].map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '5px 14px', fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? '#0D2B45' : '#718096', background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid #0B6E6E' : '2px solid transparent',
                cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {activeTab === 'details' && (
            <>
              {/* Stage status */}
              <div style={{ background: '#F7FAFC', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#A0AEC0', marginBottom: 4 }}>Current Stage</div>
                    {ce.not_proceeding
                      ? <span style={{ fontSize: 13, fontWeight: 700, color: '#C53030' }}>Not Proceeding — {REJECTION_REASONS[ce.not_proceeding_reason]}</span>
                      : <span style={{ fontSize: 13, fontWeight: 700, color: '#0D2B45' }}>{PIPELINE_STAGES[ce.pipeline_stage]?.label}</span>}
                  </div>
                  {aging !== 'normal' && !ce.not_proceeding && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: aging === 'red' ? '#C53030' : '#B7791F', background: aging === 'red' ? '#FFF5F5' : '#FFFBEB', padding: '4px 10px', borderRadius: 20 }}>
                      <Clock size={12} /> Awaiting decision
                    </div>
                  )}
                </div>
                {!ce.not_proceeding && ce.pipeline_stage < 10 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {canReject && <button onClick={onReject} style={{ padding: '7px 14px', fontSize: 12, background: '#FFF5F5', color: '#C53030', border: '1px solid #FED7D7', borderRadius: 6, cursor: 'pointer' }}>Not Proceeding</button>}
                    <button onClick={() => onMoveStage(ce.pipeline_stage + 1)} style={{ padding: '7px 14px', fontSize: 12, background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                      Move to {PIPELINE_STAGES[ce.pipeline_stage + 1]?.label} →
                    </button>
                  </div>
                )}
              </div>

              <Section title="Contact">
                <Row label="Email" value={ce.candidates?.email} />
                <Row label="LinkedIn" value={ce.candidates?.linkedin_url ? <a href={ce.candidates.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#2B6CB0' }}>View Profile</a> : '—'} />
                <Row label="Location (Zip)" value={ce.candidates?.zip_code || '—'} />
                <Row label="Applied" value={formatDate(ce.candidates?.date_applied)} />
                <Row label="Source" value={ce.candidates?.entry_type === 'converted_from_prospect' ? 'Converted from prospect' : 'Inbound application'} />
              </Section>

              {(ce.candidates?.resume_url || ce.candidates?.cover_letter_url) && (
                <Section title="Documents">
                  {ce.candidates?.resume_url && <Row label="Resume" value={<a href={`https://xxxgutfteftimhhmefoi.supabase.co/storage/v1/object/public/documents/${ce.candidates.resume_url}`} target="_blank" rel="noreferrer" style={{ color: '#2B6CB0' }}>Download</a>} />}
                  {ce.candidates?.cover_letter_url && <Row label="Cover Letter" value={<a href={`https://xxxgutfteftimhhmefoi.supabase.co/storage/v1/object/public/documents/${ce.candidates.cover_letter_url}`} target="_blank" rel="noreferrer" style={{ color: '#2B6CB0' }}>Download</a>} />}
                </Section>
              )}

              {[3, 4].includes(ce.pipeline_stage) && (
                <Section title="Interview Tracking">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input type="checkbox" id="ns1" checked={nextStep1} onChange={() => toggleNextStep(1)} style={{ cursor: 'pointer' }} />
                    <label htmlFor="ns1" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}>Next step sent — 1st interview scheduled</label>
                  </div>
                  {ce.pipeline_stage >= 4 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="checkbox" id="ns2" checked={nextStep2} onChange={() => toggleNextStep(2)} style={{ cursor: 'pointer' }} />
                      <label htmlFor="ns2" style={{ fontSize: 13, color: '#4A5568', cursor: 'pointer' }}>Next step sent — 2nd interview scheduled</label>
                    </div>
                  )}
                </Section>
              )}

              <Section title="Notes">
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', minHeight: 100, padding: '10px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  placeholder="Add notes about this candidate..." />
                <button onClick={saveNotes} disabled={saving}
                  style={{ marginTop: 8, padding: '7px 14px', fontSize: 12, background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : 'Save Notes'}
                </button>
              </Section>
            </>
          )}

          {activeTab === 'scorecard' && (
            <Scorecard
              candidateEngagementId={ce.id}
              engagementId={engagement.id}
              currentStage={ce.pipeline_stage}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F7FAFC', fontSize: 13 }}>
      <span style={{ color: '#718096' }}>{label}</span>
      <span style={{ color: '#0D2B45', fontWeight: 500, maxWidth: '60%', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function RejectionModal({ ce, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 460 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0D2B45', margin: '0 0 4px' }}>Mark as Not Proceeding</h3>
        <p style={{ fontSize: 13, color: '#718096', margin: '0 0 1.5rem' }}>{ce.candidates?.full_name}</p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>Reason *</label>
          <select value={reason} onChange={e => setReason(e.target.value)} required
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
            <option value="">Select a reason...</option>
            {Object.entries(REJECTION_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>Additional notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            style={{ width: '100%', minHeight: 80, padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Add any context..." />
        </div>
        <div style={{ background: '#EBF8FF', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#2B6CB0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={14} /> Rejection email template coming in Phase 4.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #CBD5E0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => reason && onConfirm(ce.id, reason, notes)} disabled={!reason}
            style={{ padding: '9px 18px', background: reason ? '#C53030' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: reason ? 'pointer' : 'not-allowed' }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function AddCandidateModal({ engagementId, onClose, onAdded }) {
  const [form, setForm] = useState({ full_name: '', email: '', current_title: '', current_organization: '', zip_code: '', linkedin_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function checkDuplicate(email) {
    if (!email) return
    const { data } = await supabase.from('candidates').select('id, full_name').eq('email', email).maybeSingle()
    if (data) setDuplicate(data)
    else setDuplicate(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    let candidateId
    const { data: existing } = await supabase.from('candidates').select('id').eq('email', form.email).maybeSingle()
    if (existing) {
      candidateId = existing.id
    } else {
      const { data: newCand, error: candErr } = await supabase.from('candidates').insert({ ...form, entry_type: 'inbound_application' }).select().single()
      if (candErr) { setError(candErr.message); setSaving(false); return }
      candidateId = newCand.id
    }
    const { data: existingCE } = await supabase.from('candidate_engagements').select('id').eq('candidate_id', candidateId).eq('engagement_id', engagementId).maybeSingle()
    if (existingCE) { setError('This candidate is already in the pipeline for this engagement.'); setSaving(false); return }
    const { error: ceErr } = await supabase.from('candidate_engagements').insert({ candidate_id: candidateId, engagement_id: engagementId, pipeline_stage: 1, stage_entered_at: new Date().toISOString(), acknowledgment_email_sent: false })
    if (ceErr) { setError(ceErr.message); setSaving(false); return }
    onAdded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '2rem', width: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0D2B45', margin: '0 0 1.5rem' }}>Add Candidate</h2>
        <form onSubmit={handleSubmit}>
          {[['full_name', 'Full Name', true], ['email', 'Email', true], ['current_title', 'Current Title', false], ['current_organization', 'Current Organization', false], ['zip_code', 'Zip Code', false], ['linkedin_url', 'LinkedIn URL', false]].map(([k, label, req]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>{label}{req && ' *'}</label>
              <input value={form[k]} onChange={e => { set(k, e.target.value); if (k === 'email') checkDuplicate(e.target.value) }}
                required={req} type={k === 'email' ? 'email' : 'text'}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          {duplicate && (
            <div style={{ background: '#FFFBEB', border: '1px solid #F6AD55', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#744210' }}>
              ⚠️ A candidate named <strong>{duplicate.full_name}</strong> already exists with this email. They will be linked to this engagement.
            </div>
          )}
          {error && <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#C53030', marginBottom: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', border: '1px solid #CBD5E0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WorkplanView({ engagementId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTasks() }, [engagementId])

  async function fetchTasks() {
    const { data } = await supabase.from('workplan_tasks').select('*').eq('engagement_id', engagementId).order('display_order')
    setTasks(data || [])
    setLoading(false)
  }

  async function updateStatus(taskId, status) {
    await supabase.from('workplan_tasks').update({ status }).eq('id', taskId)
    setTasks(t => t.map(task => task.id === taskId ? { ...task, status } : task))
  }

  const phases = [...new Set(tasks.map(t => t.phase))]
  const phaseColors = { 'Internal Preparation': '#0D2B45', 'Role Development': '#0B6E6E', 'Sourcing & Outreach': '#553C9A', 'Pipeline Management': '#276749', 'Closing': '#B7791F' }

  if (loading) return <div style={{ color: '#718096' }}>Loading...</div>

  return (
    <div>
      {phases.map(phase => (
        <div key={phase} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: phaseColors[phase] || '#0D2B45', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, padding: '6px 12px', background: (phaseColors[phase] || '#0D2B45') + '12', borderRadius: 6, display: 'inline-block' }}>{phase}</div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            {tasks.filter(t => t.phase === phase).map((task, i, arr) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F7FAFC' : 'none' }}>
                <select value={task.status} onChange={e => updateStatus(task.id, e.target.value)}
                  style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #CBD5E0', borderRadius: 6, color: task.status === 'done' ? '#276749' : task.status === 'na' ? '#A0AEC0' : '#4A5568', background: task.status === 'done' ? '#F0FFF4' : task.status === 'na' ? '#F7FAFC' : '#fff', cursor: 'pointer' }}>
                  <option value="to_do">To Do</option>
                  <option value="done">Done</option>
                  <option value="na">N/A</option>
                </select>
                <span style={{ flex: 1, fontSize: 13, color: task.status === 'done' ? '#A0AEC0' : task.status === 'na' ? '#CBD5E0' : '#0D2B45', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.task_name}</span>
                <span style={{ fontSize: 11, color: '#A0AEC0', flexShrink: 0 }}>{task.default_lead}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
