import { sendEmail } from './resend';
import { magicLinkEmail } from './magic-link';

export { sendEmail } from './resend';
export { magicLinkEmail } from './magic-link';

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const { subject, html, text } = magicLinkEmail(url);
  const { sent } = await sendEmail({ to: email, subject, html, text });
  if (!sent) console.log(`[auth:dev] magic sign-in link for ${email}:\n${url}`);
}
