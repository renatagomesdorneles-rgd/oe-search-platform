import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, CheckCircle, AlertTriangle } from 'lucide-react'

// Maps the exact Greenhouse "Candidates Report" export columns
function mapRow(row) {
  const firstName = (row['First Name'] || '').trim()
  const lastName = (row['Last Name'] || '').trim()
  const email = (row['Email (work)'] || row['Email (other)'] || '').trim()
  return {
    full_name: `${firstName} ${lastName}`.trim(),
    email,
    location: (row['Location'] || '').trim(),
    gender: (row['Gender Identity'] || '').trim(),
    race: (row['Racial or Ethnic Identity'] || '').trim(),
    appliedFor: (row['Applied For'] || '').trim(),
    jobName: (row['Job Name'] || '').trim(),
    offerDate: (row['Offer Date'] || '').trim(),
    candidateId: (row['Candidate ID'] || '').trim(),
    applicationDate: (row['Application Date'] || '').trim(),
    rejectionDate: (row['Rejection Date'] || '').trim(),
    rejectionReason: (row['Rejection Reason'] || '').trim(),
  }
}

function safeDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function mapStage(mapped) {
  if (mapped.offerDate) return 10 // treat as placed/offer
  if (mapped.rejectionReason || mapped.rejectionDate) return 1 // will be marked not_proceeding
  return 1
}

function isNotProceeding(mapped) {
  return !!(mapped.rejectionReason || mapped.rejectionDate)
}

export default function GreenhouseImporter() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)
  const [step, setStep] = useState(1)
  const [defaultClient, setDefaultClient] = useState('')
  const [jobGroups, setJobGroups] = useState([])

  // RFC4180-compliant CSV parser: correctly handles quoted fields containing
  // commas, newlines, and escaped ("") quotes — and recovers gracefully from
  // stray/unescaped quote characters that sometimes appear in real-world exports.
  function parseCSV(text) {
    const rows = []
    let row = []
    let field = ''
    let inQuotes = false
    let i = 0
    const len = text.length

    while (i < len) {
      const char = text[i]

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue } // escaped quote
          inQuotes = false
          i++
          continue
        }
        field += char
        i++
        continue
      }

      if (char === '"') {
        // Only treat as a real quote-start if it's at the beginning of a field.
        // A stray quote mid-field (common export glitch) is kept as a literal character
        // instead of flipping us into quote-mode and corrupting the rest of the file.
        if (field === '') {
          inQuotes = true
          i++
          continue
        }
        field += char
        i++
        continue
      }

      if (char === ',') {
        row.push(field)
        field = ''
        i++
        continue
      }

      if (char === '\r') { i++; continue }

      if (char === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
        i++
        continue
      }

      field += char
      i++
    }
    // final field/row
    if (field !== '' || row.length > 0) {
      row.push(field)
      rows.push(row)
    }

    const headers = rows[0] || []
    const dataRows = rows.slice(1)
      .map(r => {
        const obj = {}
        headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim() })
        return obj
      })
      .filter(row => Object.values(row).some(v => v))

    return { headers, rows: dataRows }
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result)
      setPreview({ headers, rows })
    }
    reader.readAsText(f)
  }

  function buildJobGroups() {
    if (!preview) return
    const groups = {}
    preview.rows.forEach(row => {
      const job = (row['Job Name'] || '(No job listed)').trim() || '(No job listed)'
      if (!groups[job]) groups[job] = []
      groups[job].push(row)
    })
    const noEmailCount = preview.rows.filter(row => {
      const m = mapRow(row)
      return !m.email
    }).length
    setJobGroups(Object.entries(groups).map(([job, rows]) => ({ job, count: rows.length, client: defaultClient })))
    setStep(3)
  }

  async function runImport() {
    setImporting(true)
    let totalImported = 0
    let totalSkipped = 0
    let errors = []
    let placeholderCount = 0
    let rowsProcessed = 0
    const totalRows = preview.rows.length

    for (let gi = 0; gi < jobGroups.length; gi++) {
      const group = jobGroups[gi]
      setProgress({ current: gi + 1, total: jobGroups.length, job: group.job, rowsProcessed, totalRows })
      if (!group.client) { errors.push(`${group.job}: no client name provided, skipped`); continue }

      let engagementId
      const { data: existingEng } = await supabase.from('engagements')
        .select('id').eq('role_title', group.job).eq('client_name', group.client).maybeSingle()

      if (existingEng) {
        engagementId = existingEng.id
      } else {
        const { data: newEng, error: engErr } = await supabase.from('engagements').insert({
          role_title: group.job || 'Untitled Search',
          client_name: group.client,
          status: 'closed',
        }).select().single()
        if (engErr) { errors.push(`${group.job}: ${engErr.message}`); continue }
        engagementId = newEng.id
        await supabase.rpc('create_default_workplan', { p_engagement_id: engagementId })
      }

      const rowsForJob = preview.rows.filter(row => (row['Job Name'] || '(No job listed)').trim() === group.job || (!row['Job Name'] && group.job === '(No job listed)'))

      for (const row of rowsForJob) {
        rowsProcessed++
        if (rowsProcessed % 25 === 0) {
          setProgress({ current: gi + 1, total: jobGroups.length, job: group.job, rowsProcessed, totalRows })
        }
        let mapped
        try {
          mapped = mapRow(row)
        } catch (err) {
          errors.push(`Row parse failed: ${err.message}`)
          totalSkipped++
          continue
        }
        if (!mapped.full_name) { totalSkipped++; continue }

        let email = mapped.email
        let hasPlaceholder = false
        if (!email) {
          // Stable placeholder based on name so the same person across multiple
          // job applications resolves to the same candidate record
          const slug = mapped.full_name.toLowerCase().replace(/[^a-z0-9]/g, '-')
          email = `noemail-${slug}@import.local`
          hasPlaceholder = true
          placeholderCount++
        }

        try {
          const { data: existing } = await supabase.from('candidates').select('id').eq('email', email).maybeSingle()
          let candidateId

          if (existing) {
            candidateId = existing.id
          } else {
            const genderVal = mapped.gender && !['Decline to self-identify', ''].includes(mapped.gender) ? mapped.gender : null
            const raceVal = mapped.race && !['Decline to self-identify', ''].includes(mapped.race) ? [mapped.race] : null

            const { data: newCand, error: candErr } = await supabase.from('candidates').insert({
              full_name: mapped.full_name,
              email,
              has_placeholder_email: hasPlaceholder,
              zip_code: mapped.location || null,
              entry_type: 'inbound_application',
              gender_self_reported: genderVal,
              race_ethnicity_self_reported: raceVal,
              date_applied: safeDate(mapped.applicationDate) || new Date().toISOString(),
            }).select().single()
            if (candErr) { errors.push(`${mapped.full_name}: ${candErr.message}`); continue }
            candidateId = newCand.id
          }

          const { data: existingCE } = await supabase.from('candidate_engagements')
            .select('id').eq('candidate_id', candidateId).eq('engagement_id', engagementId).maybeSingle()

          if (!existingCE) {
            const notProceeding = isNotProceeding(mapped)
            await supabase.from('candidate_engagements').insert({
              candidate_id: candidateId,
              engagement_id: engagementId,
              pipeline_stage: mapStage(mapped),
              not_proceeding: notProceeding,
              not_proceeding_reason: notProceeding ? 'other' : null,
              import_rejection_note: mapped.rejectionReason || null,
              stage_entered_at: safeDate(mapped.rejectionDate) || new Date().toISOString(),
            })
            totalImported++
          } else {
            totalSkipped++
          }
        } catch (err) {
          errors.push(`${mapped.full_name}: ${err.message}`)
        }
      }
    }

    setResults({ imported: totalImported, skipped: totalSkipped, errors, engagementCount: jobGroups.length, placeholderCount })
    setImporting(false)
    setProgress(null)
    setStep(4)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45', margin: '0 0 8px' }}>Import from Greenhouse</h1>
      <p style={{ fontSize: 13, color: '#718096', margin: '0 0 2rem', lineHeight: 1.6 }}>
        Upload your full Greenhouse candidates export. Candidates without an email on file will still be imported using a placeholder so your full history stays searchable.
      </p>

      <div style={{ display: 'flex', gap: 0, marginBottom: '2rem', flexWrap: 'wrap' }}>
        {['Upload CSV', 'Confirm', 'Review Searches', 'Complete'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                background: step > i + 1 ? '#276749' : step === i + 1 ? '#0D2B45' : '#E2E8F0',
                color: step >= i + 1 ? '#fff' : '#A0AEC0' }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, color: step === i + 1 ? '#0D2B45' : '#A0AEC0', fontWeight: step === i + 1 ? 600 : 400 }}>{label}</span>
            </div>
            {i < 3 && <div style={{ width: 24, height: 1, background: '#E2E8F0', margin: '0 10px' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div style={{ border: '2px dashed #CBD5E0', borderRadius: 10, padding: '2.5rem', textAlign: 'center', marginBottom: 16 }}>
            <Upload size={32} style={{ color: '#CBD5E0', marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#4A5568', marginBottom: 8 }}>Upload your Greenhouse candidates CSV</div>
            <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 16 }}>Export with First Name, Last Name, Email, Job Name columns</div>
            <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} id="csv-upload" />
            <label htmlFor="csv-upload" style={{ display: 'inline-block', padding: '9px 20px', background: '#0D2B45', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Choose CSV File
            </label>
          </div>
          {preview && (
            <div>
              <div style={{ background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#276749', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} /> {preview.rows.length} rows detected in {file.name}
              </div>
              <button onClick={() => setStep(2)} style={{ padding: '10px 24px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {step === 2 && preview && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0D2B45', marginBottom: '1rem' }}>Confirm Preview</div>
            {preview.rows.slice(0, 3).map((row, i) => {
              const m = mapRow(row)
              return (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < 2 ? '1px solid #F7FAFC' : 'none', fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: '#0D2B45' }}>{m.full_name || '(no name)'}</span>
                  <span style={{ color: '#718096', marginLeft: 8 }}>{m.email || '(no email — will use placeholder)'}</span>
                  <span style={{ color: '#A0AEC0', marginLeft: 8 }}>→ {m.jobName}</span>
                </div>
              )
            })}
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 500, color: '#4A5568', marginBottom: 6 }}>Default Client Name</div>
            <p style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 8 }}>Used as a starting point for all detected searches — you can adjust each individually on the next screen.</p>
            <input value={defaultClient} onChange={e => setDefaultClient(e.target.value)} placeholder="e.g. Various Clients"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #CBD5E0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ padding: '10px 20px', border: '1px solid #CBD5E0', background: '#fff', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Back</button>
            <button onClick={buildJobGroups} style={{ padding: '10px 24px', background: '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Detect Searches →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ background: '#FFFBEB', border: '1px solid #F6AD55', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#744210', marginBottom: 16, lineHeight: 1.5 }}>
            Found <strong>{jobGroups.length} distinct searches</strong> across {preview.rows.length} candidates. This may take a few minutes to import — please don't close this tab once you start.
          </div>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 20, maxHeight: 420, overflowY: 'auto' }}>
            {jobGroups.map((g, i) => (
              <div key={g.job} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < jobGroups.length - 1 ? '1px solid #F7FAFC' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D2B45', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.job}</div>
                  <div style={{ fontSize: 11, color: '#A0AEC0' }}>{g.count} candidates</div>
                </div>
                <input value={g.client} onChange={e => {
                  const updated = [...jobGroups]
                  updated[i] = { ...updated[i], client: e.target.value }
                  setJobGroups(updated)
                }} placeholder="Client name"
                  style={{ width: 180, flexShrink: 0, padding: '7px 10px', border: '1px solid #CBD5E0', borderRadius: 6, fontSize: 12 }} />
              </div>
            ))}
          </div>
          {progress && (
            <div style={{ background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#2B6CB0' }}>
              <div>Search {progress.current} of {progress.total}: {progress.job}</div>
              {progress.totalRows && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span>{progress.rowsProcessed} / {progress.totalRows} candidate rows processed</span>
                    <span>{Math.round((progress.rowsProcessed / progress.totalRows) * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: '#fff', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(progress.rowsProcessed / progress.totalRows) * 100}%`, height: '100%', background: '#2B6CB0', borderRadius: 3, transition: 'width 0.2s' }} />
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setStep(2)} disabled={importing} style={{ padding: '10px 20px', border: '1px solid #CBD5E0', background: '#fff', borderRadius: 8, fontSize: 13, cursor: importing ? 'not-allowed' : 'pointer' }}>Back</button>
            <button onClick={runImport} disabled={importing || jobGroups.some(g => !g.client)}
              style={{ padding: '10px 24px', background: importing || jobGroups.some(g => !g.client) ? '#A0AEC0' : '#0D2B45', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: importing ? 'not-allowed' : 'pointer' }}>
              {importing ? 'Importing...' : `Import All ${preview.rows.length} Candidates`}
            </button>
          </div>
          {jobGroups.some(g => !g.client) && (
            <div style={{ fontSize: 12, color: '#C53030', marginTop: 8 }}>Please enter a client name for every search before importing.</div>
          )}
        </div>
      )}

      {step === 4 && results && (
        <div>
          <div style={{ background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 10, padding: '1.5rem', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <CheckCircle size={24} style={{ color: '#276749' }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: '#276749' }}>Import complete</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '12px', background: '#fff', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0D2B45' }}>{results.engagementCount}</div>
                <div style={{ fontSize: 11, color: '#718096' }}>Searches created</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: '#fff', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#276749' }}>{results.imported}</div>
                <div style={{ fontSize: 11, color: '#718096' }}>Candidates imported</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: '#fff', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#B7791F' }}>{results.placeholderCount}</div>
                <div style={{ fontSize: 11, color: '#718096' }}>No email on file</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: '#fff', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: results.errors.length > 0 ? '#C53030' : '#276749' }}>{results.errors.length}</div>
                <div style={{ fontSize: 11, color: '#718096' }}>Errors</div>
              </div>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div style={{ background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#C53030', marginBottom: 8 }}>Errors</div>
              {results.errors.slice(0, 8).map((e, i) => <div key={i} style={{ fontSize: 12, color: '#C53030', marginBottom: 4 }}>{e}</div>)}
              {results.errors.length > 8 && <div style={{ fontSize: 12, color: '#A0AEC0' }}>...and {results.errors.length - 8} more</div>}
            </div>
          )}
          <button onClick={() => { setStep(1); setFile(null); setPreview(null); setResults(null); setJobGroups([]); setProgress(null) }}
            style={{ padding: '10px 20px', border: '1px solid #CBD5E0', background: '#fff', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
