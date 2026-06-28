import { Resend } from 'resend';

const FALLBACK_FROM = 'LayoutLab <onboarding@resend.dev>';

export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Keyless dev: never block the flow — surface the email so it's testable locally.
    console.log(`[email:dev] no RESEND_API_KEY — would send to ${input.to}: ${input.subject}`);
    return { sent: false };
  }
  const from = process.env.RESEND_FROM || FALLBACK_FROM;
  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
    return { sent: true };
  } catch (err) {
    console.error('[email] Resend send failed:', err);
    throw err;
  }
}
