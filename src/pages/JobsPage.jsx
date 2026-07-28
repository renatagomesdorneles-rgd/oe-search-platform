import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function JobsPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchJobs() }, [])

  async function fetchJobs() {
    const { data } = await supabase
      .from('engagements')
      .select('id, role_title, client_name, location, job_posting_text, application_form_slug')
      .eq('status', 'active')
      .eq('published', true)
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', color: '#718096' }}>Loading...</div>
  )

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      {jobs.length === 0 ? (
        <p style={{ color: '#718096', fontSize: 15 }}>No open positions at this time. Please check back soon.</p>
      ) : (
        <div>
          {jobs.map((job, i) => (
            <div key={job.id} style={{
              borderBottom: i < jobs.length - 1 ? '1px solid #E2E8F0' : 'none',
              paddingBottom: '2rem', marginBottom: '2rem',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0D2B45', margin: '0 0 4px' }}>{job.role_title}</h2>
              <div style={{ fontSize: 14, color: '#718096', marginBottom: job.job_posting_text ? 16 : 20 }}>
                {job.client_name}{job.location && ` · ${job.location}`}
              </div>
              {job.job_posting_text && (
                <div style={{ fontSize: 14, color: '#4A5568', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
                  {job.job_posting_text}
                </div>
              )}
              {job.application_form_slug && (
                <a href={`/apply/${job.application_form_slug}?source=oe-website`}
                  style={{ display: 'inline-block', padding: '10px 24px', background: '#0D2B45', color: '#fff', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
                  Apply Now
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
