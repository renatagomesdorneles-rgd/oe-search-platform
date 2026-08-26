import https from 'node:https'

export default async function handler(req, res) {
  // Allow cross-origin requests from any origin (needed for iframe embed)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { candidateName, candidateEmail, roleTitle, clientName } = req.body

  if (!candidateEmail || !candidateName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY' })
  }

  const body = `Dear ${candidateName},\n\nThank you for applying for the ${roleTitle || 'position'}${clientName ? ` at ${clientName}` : ''}. We have received your application and will be in touch as the search progresses.\n\nWe appreciate your interest in this opportunity.\n\nWarm regards,\nOE Consulting`

  const payload = JSON.stringify({
    from: 'OE Consulting <onboarding@resend.dev>',
    to: [candidateEmail],
    subject: `Application received — ${roleTitle || 'your application'}`,
    html: `<div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">${body.replace(/\n/g, '<br>')}</div>`,
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
