import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Save, Trash2, UserPlus } from 'lucide-react'

const DEFAULT_TEMPLATES = {
  does_not_meet_qualifications: {
    label: 'Does not meet minimum qualifications',
    subject: 'Your application for [ROLE TITLE] at [CLIENT NAME]',
    body: `Dear [CANDIDATE NAME],

Thank you for your interest in the [ROLE TITLE] position at [CLIENT NAME] and for taking the time to submit your application.

After careful review, we have determined that your background is not an exact match for the qualifications we are seeking at this time. We appreciate your interest and encourage you to keep an eye on future opportunities.

Thank you again for considering this role.

Warm regards,
[YOUR NAME]
OE Consulting`
  },
  insufficient_experience: {
    label: 'Insufficient relevant experience',
    subject: 'Your application for [ROLE TITLE] at [CLIENT NAME]',
    body: `Dear [CANDIDATE NAME],

Thank you for your interest in the [ROLE TITLE] position at [CLIENT NAME] and for submitting your application.

After reviewing your background carefully, we have decided to move forward with candidates whose experience more closely aligns with the specific requirements of this role. This was not an easy decision given the strength of our applicant pool.

We appreciate your time and wish you the best in your search.

Warm regards,
[YOUR NAME]
OE Consulting`
  },
  location_relocation: {
    label: 'Location / relocation not viable',
    subject: 'Your application for [ROLE TITLE] at [CLIENT NAME]',
    body: `Dear [CANDIDATE NAME],

Thank you for your interest in the [ROLE TITLE] position at [CLIENT NAME].

This role requires presence in [LOCATION], and after further consideration we are not able to move forward with your candidacy due to location constraints. We regret that we cannot accommodate a remote or relocated arrangement for this particular position.

We appreciate your openness to this opportunity and hope to be in touch about future searches that may be a better geographic fit.

Warm regards,
[YOUR NAME]
OE Consulting`
  },
  withdrew: {
    label: 'Withdrew / no longer interested',
    subject: 'Re: [ROLE TITLE] at [CLIENT NAME]',
    body: `Dear [CANDIDATE NAME],

Thank you for letting us know about your decision regarding the [ROLE TITLE] position at [CLIENT NAME]. We completely understand and appreciate you taking the time to be in touch.

We will keep your information on file and hope to connect again when the timing is right.

Best wishes,
[YOUR NAME]
OE Consulting`
  },
  other: {
    label: 'Other',
    subject: 'Your application for [ROLE TITLE] at [CLIENT NAME]',
    body: `Dear [CANDIDATE NAME],

Thank you for your interest in the [ROLE TITLE] position at [CLIENT NAME] and for the time you invested in this process.

After careful consideration, we have decided to move forward with other candidates at this time. We appreciate your enthusiasm for this opportunity.

Warm regards,
[YOUR NAME]
OE Consulting`
  }
}

export default function Settings() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('templates')
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [selectedTemplate, setSelectedTemplate] = useState('does_not_meet_qualifications')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    loadTemplates()
    if (activeTab === 'users') fetchUsers()
  }, [activeTab])

  async function loadTemplates() {
    const { data } = await supabase.from('profiles').select('id').eq('id', profile?.id).single()
    // Load saved templates from Supabase if they exist
    const { data: saved } = await supabase.storage.from('documents').download('templates/rejection_templates.json').catch(() => ({ data: null }))
    if (saved) {
      const text = await saved.text()
      try { setTemplates(JSON.parse(text)) } catch (e) { /* use defaults */ }
    }
  }

  async function saveTemplates() {
    setSaving(true)
    const blob = new Blob([JSON.stringify(templates)], { type: 'application/json' })
    await supabase.storage.from('documents').upload('templates/rejection_templates.json', blob, { upsert: true })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function fetchUsers() {
    setLoadingUsers(true)
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoadingUsers(false)
  }

  const updateTemplate = (key, field, value) => {
    setTemplates(t => ({ ...t, [key]: { ...t[key], [field]: value } }))
  }

  const current = templates[selectedTemplate]

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', margin: 0 }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
        {[['templates', 'Email Templates'], ['users', 'Team Members'], ['account', 'Account']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 20px', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? '#0D2B45' : '#718096', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid #0B6E6E' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
          {/* Template list */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Rejection Templates</div>
            {Object.entries(templates).map(([key, tmpl]) => (
              <button key={key} onClick={() => setSelectedTemplate(key)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', marginBottom: 4, borderRadius: 8, border: '1px solid', fontSize: 13,
                  borderColor: selectedTemplate === key ? '#0B6E6E' : '#E2E8F0',
                  background: selectedTemplate === key ? '#E6FFFA' : '#fff',
                  color: selectedTemplate === key ? '#0B6E6E' : '#4A5568',
                  fontWeight: selectedTemplate === key ? 600 : 400, cursor: 'pointer' }}>
                {tmpl.label}
              </button>
            ))}
            <div style={{ marginTop: 12, fontSize: 12, color: '#A0AEC0', lineHeight: 1.5 }}>
              Use [CANDIDATE NAME], [ROLE TITLE], [CLIENT NAME], [LOCATION], and [YOUR NAME] as placeholders — they will be filled in automatically when sending.
            </div>
          </div>

          {/* Template editor */}
          {current && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2B45' }}>{current.label}</div>
                <button onClick={saveTemplates} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: saved ? '#276749' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Templates'}
                </button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>Email Subject</label>
                <input value={current.subject} onChange={e => updateTemplate(selectedTemplate, 'subject', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>Email Body</label>
                <textarea value={current.body} onChange={e => updateTemplate(selectedTemplate, 'body', e.target.value)}
                  style={{ width: '100%', minHeight: 320, padding: '10px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }} />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ fontSize: 13, color: '#718096', marginBottom: 16, lineHeight: 1.6 }}>
            Team members are added directly through Supabase Authentication. To add a new team member, go to your Supabase project → Authentication → Users → Add user, then provide them with their login credentials.
          </div>
          <div style={{ background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#2B6CB0' }}>
            <strong>To add a team member:</strong> Supabase → Authentication → Users → Add user → enter their OE email and a temporary password.
          </div>
          {loadingUsers ? <div style={{ color: '#A0AEC0' }}>Loading...</div> : (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              {users.map((user, i) => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < users.length - 1 ? '1px solid #F7FAFC' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0B6E6E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {user.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0D2B45' }}>{user.full_name}</div>
                    <div style={{ fontSize: 12, color: '#718096' }}>{user.email}</div>
                  </div>
                  {user.id === profile?.id && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: '#E6FFFA', color: '#0B6E6E', padding: '2px 8px', borderRadius: 20 }}>You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'account' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2B45', marginBottom: '1.25rem' }}>Your Profile</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1.5rem', padding: '1rem', background: '#F7FAFC', borderRadius: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0B6E6E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {profile?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#0D2B45' }}>{profile?.full_name}</div>
                <div style={{ fontSize: 13, color: '#718096' }}>{profile?.email}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#718096', lineHeight: 1.6 }}>
              To update your name or password, go to your Supabase project → Authentication → Users → find your email → edit.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
