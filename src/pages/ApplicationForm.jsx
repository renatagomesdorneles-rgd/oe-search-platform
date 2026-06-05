import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GENDER_OPTIONS = [
  'Man', 'Woman', 'Non-binary', 'Transgender',
  'Prefer to self-describe', 'Prefer not to say'
]

const RACE_OPTIONS = [
  'African American', 'Asian', 'Asian American', 'Black',
  'Latinx / Hispanic', 'Middle Eastern', 'Mixed Race',
  'Native American', 'Pacific Islander', 'White',
  'Prefer to self-describe', 'Prefer not to say'
]

export default function ApplicationForm() {
  const { slug } = useParams()
  const [engagement, setEngagement] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  const [form, setForm] = useState({
    full_name: '', email: '', linkedin_url: '', zip_code: '',
    current_title: '', current_organization: '',
    gender: '', race: [], relocation: '', compensation: '',
    custom_responses: {},
  })
  const [resumeFile, setResumeFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)

  useEffect(() => { fetchEngagement() }, [slug])

  async function fetchEngagement() {
    const { data: eng } = await supabase
      .from('engagements')
      .select(`*, engagement_form_questions(*)`)
      .eq('application_form_slug', slug)
      .eq('status', 'active')
      .single()
    if (eng) {
      setEngagement(eng)
      setQuestions(eng.engagement_form_questions || [])
    }
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleRace = (val) => setForm(f => ({
    ...f,
    race: f.race.includes(val) ? f.race.filter(r => r !== val) : [...f.race, val]
  }))

  async function uploadFile(file, folder) {
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file)
    if (error) throw error
    return path
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!resumeFile) { setError('Please upload your resume.'); return }
    if (!coverFile) { setError('Please upload your cover letter.'); return }
    setSubmitting(true)
    setError('')

    try {
      // Check for duplicate
      const { data: existing } = await supabase
        .from('candidates')
        .select('id, full_name')
        .eq('email', form.email)
        .maybeSingle()

      // Check if already applied to this engagement
      if (existing) {
        const { data: existingCE } = await supabase
          .from('candidate_engagements')
          .select('id')
          .eq('candidate_id', existing.id)
          .eq('engagement_id', engagement.id)
          .maybeSingle()
        if (existingCE) {
          setDuplicate(true)
          setSubmitting(false)
          return
        }
      }

      // Upload files
      const resumePath = await uploadFile(resumeFile, 'resumes')
      const coverPath = await uploadFile(coverFile, 'cover-letters')

      // Get signed URLs for storage
      const resumeUrl = resumePath
      const coverUrl = coverPath

      let candidateId
      if (existing) {
        candidateId = existing.id
        // Update with latest info
        await supabase.from('candidates').update({
          current_title: form.current_title,
          current_organization: form.current_organization,
          zip_code: form.zip_code,
          linkedin_url: form.linkedin_url,
          resume_url: resumeUrl,
          cover_letter_url: coverUrl,
          gender_self_reported: form.gender || null,
          race_ethnicity_self_reported: form.race.length ? form.race : null,
        }).eq('id', candidateId)
      } else {
        const { data: newCand, error: candErr } = await supabase
          .from('candidates')
          .insert({
            full_name: form.full_name,
            email: form.email,
            linkedin_url: form.linkedin_url || null,
            current_title: form.current_title || null,
            current_organization: form.current_organization || null,
            zip_code: form.zip_code || null,
            resume_url: resumeUrl,
            cover_letter_url: coverUrl,
            entry_type: 'inbound_application',
            gender_self_reported: form.gender || null,
            race_ethnicity_self_reported: form.race.length ? form.race : null,
            date_applied: new Date().toISOString(),
          })
          .select()
          .single()
        if (candErr) throw candErr
        candidateId = newCand.id
      }

      // Check if this was a prospect (email match)
      const { data: prospect } = await supabase
        .from('prospects')
        .select('id')
        .eq('email', form.email)
        .eq('engagement_id', engagement.id)
        .maybeSingle()

      if (prospect) {
        await supabase.from('prospects').update({
          converted: true,
          converted_at: new Date().toISOString(),
          linked_candidate_id: candidateId,
          stage: 'converted',
        }).eq('id', prospect.id)
      }

      // Create candidate engagement record
      const { error: ceErr } = await supabase
        .from('candidate_engagements')
        .insert({
          candidate_id: candidateId,
          engagement_id: engagement.id,
          pipeline_stage: 1,
          stage_entered_at: new Date().toISOString(),
          relocation_willingness: form.relocation || null,
          compensation_expectations: form.compensation || null,
          custom_question_responses: Object.keys(form.custom_responses).length ? form.custom_responses : null,
          acknowledgment_email_sent: false,
        })
      if (ceErr) throw ceErr

      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F9FA' }}>
      <div style={{ color: '#718096' }}>Loading...</div>
    </div>
  )

  if (!engagement) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F9FA' }}>
      <div style={{ textAlign: 'center', color: '#718096' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#0D2B45' }}>Position not found</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>This position may no longer be accepting applications.</div>
      </div>
    </div>
  )

  if (duplicate) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F9FA' }}>
      <div style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D2B45', marginBottom: 8 }}>Already applied</h2>
        <p style={{ color: '#718096', fontSize: 14 }}>We already have an application from this email address for this position. If you have questions, please contact the search team directly.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F9FA' }}>
      <div style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6FFFA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: 28 }}>✓</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', marginBottom: 8 }}>Application received</h2>
        <p style={{ color: '#718096', fontSize: 14, lineHeight: 1.6 }}>
          Thank you for applying for the <strong>{engagement.role_title}</strong> position
          {engagement.client_name && ` at ${engagement.client_name}`}.
          We have received your application and will be in touch.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FA', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#0B6E6E', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>OE Consulting</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#0D2B45', margin: '0 0 4px' }}>{engagement.role_title}</h1>
          {engagement.client_name && <div style={{ fontSize: 15, color: '#718096' }}>{engagement.client_name}{engagement.location && ` · ${engagement.location}`}</div>}
        </div>

        {/* Job posting */}
        {engagement.job_posting_text && (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0D2B45', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>About the Role</h2>
            <div style={{ fontSize: 14, color: '#4A5568', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{engagement.job_posting_text}</div>
          </div>
        )}

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2B45', marginBottom: '1.5rem' }}>Your Application</h2>
          <form onSubmit={handleSubmit}>

            <FormSection title="Personal Information">
              <FormField label="Full Name" required>
                <input value={form.full_name} onChange={e => set('full_name', e.target.value)} required placeholder="Jane Smith" style={inputStyle} />
              </FormField>
              <FormField label="Email Address" required>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="jane@example.com" style={inputStyle} />
              </FormField>
              <TwoCol>
                <FormField label="Current Title">
                  <input value={form.current_title} onChange={e => set('current_title', e.target.value)} placeholder="Director of Programs" style={inputStyle} />
                </FormField>
                <FormField label="Current Organization">
                  <input value={form.current_organization} onChange={e => set('current_organization', e.target.value)} placeholder="Organization name" style={inputStyle} />
                </FormField>
              </TwoCol>
              <TwoCol>
                <FormField label="Zip Code">
                  <input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="10001" style={inputStyle} />
                </FormField>
                <FormField label="LinkedIn URL">
                  <input value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="linkedin.com/in/..." style={inputStyle} />
                </FormField>
              </TwoCol>
            </FormSection>

            <FormSection title="Documents">
              <FormField label="Resume" required hint="PDF or Word document">
                <FileUpload file={resumeFile} onChange={setResumeFile} accept=".pdf,.doc,.docx" />
              </FormField>
              <FormField label="Cover Letter" required hint="PDF or Word document">
                <FileUpload file={coverFile} onChange={setCoverFile} accept=".pdf,.doc,.docx" />
              </FormField>
            </FormSection>

            {engagement.relocation_required && (
              <FormSection title="Relocation">
                <FormField label="This position is based in {engagement.location}. Are you willing to relocate?">
                  <select value={form.relocation} onChange={e => set('relocation', e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="open_to_discuss">Open to discuss</option>
                  </select>
                </FormField>
              </FormSection>
            )}

            {engagement.compensation_field_enabled && (
              <FormSection title="Compensation">
                <FormField label="Compensation expectations (optional)">
                  <input value={form.compensation} onChange={e => set('compensation', e.target.value)} placeholder="e.g. $120,000 – $140,000" style={inputStyle} />
                </FormField>
              </FormSection>
            )}

            {questions.length > 0 && (
              <FormSection title="Additional Questions">
                {questions.sort((a, b) => a.display_order - b.display_order).map(q => (
                  <FormField key={q.id} label={q.question_text}>
                    {q.question_type === 'yes_no' ? (
                      <select value={form.custom_responses[q.id] || ''} onChange={e => set('custom_responses', { ...form.custom_responses, [q.id]: e.target.value })} style={inputStyle}>
                        <option value="">Select...</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : q.question_type === 'multiple_choice' ? (
                      <select value={form.custom_responses[q.id] || ''} onChange={e => set('custom_responses', { ...form.custom_responses, [q.id]: e.target.value })} style={inputStyle}>
                        <option value="">Select...</option>
                        {(q.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <textarea value={form.custom_responses[q.id] || ''} onChange={e => set('custom_responses', { ...form.custom_responses, [q.id]: e.target.value })}
                        style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} />
                    )}
                  </FormField>
                ))}
              </FormSection>
            )}

            <FormSection title="Voluntary Demographics">
              <p style={{ fontSize: 12, color: '#718096', marginBottom: 16, lineHeight: 1.6 }}>
                OE Consulting is committed to building diverse candidate slates. The following information is entirely optional and will never be used in selection decisions. It is collected solely for internal equity tracking.
              </p>
              <FormField label="Gender Identity (optional)">
                <select value={form.gender} onChange={e => set('gender', e.target.value)} style={inputStyle}>
                  <option value="">Prefer not to say</option>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </FormField>
              <FormField label="Race / Ethnicity (optional, select all that apply)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  {RACE_OPTIONS.map(r => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4A5568', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.race.includes(r)} onChange={() => toggleRace(r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </FormField>
            </FormSection>

            {error && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C53030', marginBottom: 16 }}>{error}</div>
            )}

            <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 16, lineHeight: 1.6 }}>
              By submitting this application, you consent to OE Consulting storing and processing your information for the purpose of this search.
            </div>

            <button type="submit" disabled={submitting}
              style={{ width: '100%', padding: '12px', background: submitting ? '#A0AEC0' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }

function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #F7FAFC' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function FormField({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#E53E3E' }}> *</span>}
        {hint && <span style={{ fontWeight: 400, color: '#A0AEC0', marginLeft: 6 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function FileUpload({ file, onChange, accept }) {
  return (
    <div>
      <input type="file" accept={accept} onChange={e => onChange(e.target.files[0])}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', cursor: 'pointer', background: '#FAFAFA' }} />
      {file && <div style={{ fontSize: 12, color: '#38A169', marginTop: 4 }}>✓ {file.name}</div>}
    </div>
  )
}
