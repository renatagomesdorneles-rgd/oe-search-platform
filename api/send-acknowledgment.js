export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { candidateName, candidateEmail, roleTitle, clientName } = req.body

  if (!candidateEmail || !candidateName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

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
        subject: `Application received — ${roleTitle}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
            <p>Dear ${candidateName},</p>
            <p>Thank you for applying for the <strong>${roleTitle}</strong> position${clientName ? ` at ${clientName}` : ''}. We have received your application and will be in touch as the search progresses.</p>
            <p>We appreciate your interest in this opportunity.</p>
            <br/>
            <p>Warm regards,</p>
            <p><strong>OE Consulting</strong></p>
          </div>
        `,
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
