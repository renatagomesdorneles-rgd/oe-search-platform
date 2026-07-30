export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { candidateName, candidateEmail, roleTitle, clientName } = req.body

  if (!candidateEmail || !candidateName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Default template
  let subject = `Application received — ${roleTitle}`
  let bodyTemplate = `Dear [CANDIDATE NAME],

Thank you for applying for the [ROLE TITLE] position at [CLIENT NAME]. We have received your application and will be in touch as the search progresses.

We appreciate your interest in this opportunity.

Warm regards,
OE Consulting`

  // Try to load custom template from Supabase storage
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
    const templateRes = await fetch(
      `${supabaseUrl}/storage/v1/object/authenticated/documents/templates/acknowledgment_template.json`,
      { headers: { 'Authorization': `Bearer ${supabaseKey}` } }
    )
    if (templateRes.ok) {
      const tmpl = await templateRes.json()
      if (tmpl.subject) subject = tmpl.subject
      if (tmpl.body) bodyTemplate = tmpl.body
    }
  } catch (e) {
    // Use defaults if template fetch fails
  }

  // Replace placeholders
  const replacePlaceholders = (str) => str
    .replace(/\[CANDIDATE NAME\]/g, candidateName)
    .replace(/\[ROLE TITLE\]/g, roleTitle || '')
    .replace(/\[CLIENT NAME\]/g, clientName || '')

  const finalSubject = replacePlaceholders(subject)
  const finalBody = replacePlaceholders(bodyTemplate)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'OE Consulting <onboarding@resend.dev>',
        to: [candidateEmail],
        subject: finalSubject,
        html: `<div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; white-space: pre-wrap;">${finalBody}</div>`,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(500).json({ error: data.message || 'Failed to send email' })
    }
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
