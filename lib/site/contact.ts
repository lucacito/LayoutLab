import { sendEmail as realSendEmail } from '@/lib/email/resend';

// Display addresses shown on the site to build authority. These are brand
// addresses on the domain; actual mail is forwarded to the owner inbox.
export const SUPPORT_EMAIL = 'support@divi5lab.com';
export const SALES_EMAIL = 'sales@divi5lab.com';
export const INFO_EMAIL = 'info@divi5lab.com';

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

interface ContactDeps {
  sendEmail: (i: { to: string; subject: string; html: string; text?: string; replyTo?: string }) => Promise<{ sent: boolean }>;
  adminEmails: string | undefined;
}

// Where contact-form messages are delivered (the owner inbox). Set ADMIN_EMAILS.
export function contactRecipients(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c);

export async function sendContactMessage(input: ContactInput, deps: Partial<ContactDeps> = {}): Promise<{ sent: boolean }> {
  const sendEmail = deps.sendEmail ?? realSendEmail;
  const to = contactRecipients('adminEmails' in deps ? deps.adminEmails : process.env.ADMIN_EMAILS);
  if (to.length === 0) return { sent: false };
  const subject = `Contact form: ${input.name}`;
  const html =
    `<p><strong>From:</strong> ${esc(input.name)} &lt;${esc(input.email)}&gt;</p>` +
    `<p>${esc(input.message).replace(/\n/g, '<br>')}</p>`;
  const text = `From: ${input.name} <${input.email}>\n\n${input.message}`;
  const results = await Promise.all(to.map((addr) => sendEmail({ to: addr, subject, html, text, replyTo: input.email })));
  return { sent: results.some((r) => r.sent) };
}
