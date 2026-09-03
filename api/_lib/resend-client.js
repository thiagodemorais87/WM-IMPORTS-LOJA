import { Resend } from 'resend'

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
}

export async function sendEmail({ to, subject, html }) {
  if (!isResendConfigured()) {
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY ou RESEND_FROM_EMAIL não configurados',
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[resend] send error:', error)
      return {
        ok: false,
        skipped: false,
        error: error.message || String(error),
      }
    }

    return {
      ok: true,
      skipped: false,
      providerId: data?.id ?? null,
    }
  } catch (error) {
    console.error('[resend] exception:', error)
    return {
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
