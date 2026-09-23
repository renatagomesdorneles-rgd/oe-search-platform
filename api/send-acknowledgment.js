import https from 'node:https'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { candidateName, candidateEmail, roleTitle, clientName } = req.body

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' })
  if (!candidateEmail) return res.status(400).json({ error: 'Missing candidateEmail' })

  const payload = JSON.stringify({
    from: 'OE Platform <onboarding@resend.dev>',
    to: ['renata.gomes.dorneles@oeconsulting.com'],
    reply_to: candidateEmail,
    subject: `Application Received: ${candidateName} — ${roleTitle || 'position'}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
        <h2 style="color: #0D2B45; font-size: 18px;">New Application Received</h2>
        <p><strong>Candidate:</strong> ${candidateName}</p>
        <p><strong>Email:</strong> <a href="mailto:${candidateEmail}">${candidateEmail}</a></p>
        <p><strong>Position:</strong> ${roleTitle || '—'}${clientName ? ` at ${clientName}` : ''}</p>
        <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
        <p style="color: #718096; font-size: 13px;">Reply to this email to send your acknowledgment directly to the candidate. Their email address is pre-filled in the reply-to field.</p>
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
