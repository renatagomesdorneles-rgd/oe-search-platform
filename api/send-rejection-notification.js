import https from 'node:https'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { candidateName, candidateEmail, roleTitle, clientName, rejectionReason, rejectionNotes, templateSubject, templateBody } = req.body

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' })
  if (!candidateEmail) return res.status(400).json({ error: 'Missing candidateEmail' })

  const filledSubject = (templateSubject || 'Your application for [ROLE TITLE]')
    .replace(/\[CANDIDATE NAME\]/gi, candidateName)
    .replace(/\[ROLE TITLE\]/gi, roleTitle || 'the position')
    .replace(/\[CLIENT NAME\]/gi, clientName || '')

  const filledBody = (templateBody || `Dear ${candidateName},\n\nThank you for your interest in the ${roleTitle} position. After careful consideration, we have decided to move forward with other candidates.\n\nWarm regards,\nOE Consulting`)
    .replace(/\[CANDIDATE NAME\]/gi, candidateName)
    .replace(/\[ROLE TITLE\]/gi, roleTitle || 'the position')
    .replace(/\[CLIENT NAME\]/gi, clientName || '')

  const payload = JSON.stringify({
    from: 'OE Platform <onboarding@resend.dev>',
    to: ['renata.gomes.dorneles@oeconsulting.com'],
    reply_to: candidateEmail,
    subject: `REJECTION READY TO SEND: ${candidateName} — ${roleTitle || 'position'}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <h2 style="color: #9B2C2C; font-size: 18px;">Rejection Notification — Action Required</h2>
        <p><strong>Candidate:</strong> ${candidateName}</p>
        <p><strong>Email:</strong> <a href="mailto:${candidateEmail}">${candidateEmail}</a></p>
        <p><strong>Position:</strong> ${roleTitle || '—'}${clientName ? ` at ${clientName}` : ''}</p>
        <p><strong>Reason:</strong> ${rejectionReason || '—'}</p>
        ${rejectionNotes ? `<p><strong>Notes:</strong> ${rejectionNotes}</p>` : ''}
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #0D2B45; font-weight: bold; font-size: 14px;">Suggested rejection email to forward to candidate:</p>
        <div style="background: #F7FAFC; border-left: 3px solid #CBD5E0; padding: 16px; margin: 12px 0; font-size: 14px; line-height: 1.7;">
          <p style="margin: 0 0 8px;"><strong>Subject:</strong> ${filledSubject}</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 8px 0;" />
          <div style="white-space: pre-wrap;">${filledBody}</div>
        </div>
        <p style="color: #718096; font-size: 13px;">Hit Reply to send directly to ${candidateName} — their email is pre-filled in the reply-to field. Copy the subject and body above into your reply.</p>
      </div>
    `,
  })

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }

    const httpReq = https.request(options, (httpRes) => {
      let responseBody = ''
      httpRes.on('data', chunk => responseBody += chunk)
      httpRes.on('end', () => {
        if (httpRes.statusCode >= 200 && httpRes.statusCode < 300) {
          res.status(200).json({ success: true })
        } else {
          res.status(500).json({ error: responseBody })
        }
        resolve()
      })
    })

    httpReq.on('error', (err) => {
      res.status(500).json({ error: err.message })
      resolve()
    })

    httpReq.write(payload)
    httpReq.end()
  })
}
