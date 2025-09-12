type SendEmailArgs = {
    to: string
    subject: string
    html: string
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
    // Si tienes RESEND_API_KEY usa Resend (recomendado)
    // Si no, por ahora hacemos console.log (no revienta en dev)
    const key = process.env.RESEND_API_KEY
    if (!key) {
        console.log('[DEV EMAIL MOCK]', { to, subject })
        return
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'no-reply@glimmerglass.app',
            to: [to],
            subject,
            html,
        }),
    })

    if (!res.ok) {
        const t = await res.text().catch(() => '')
        console.error('sendEmail failed:', res.status, t)
    }
}