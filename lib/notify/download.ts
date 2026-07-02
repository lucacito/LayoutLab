import { sendEmail as realSendEmail } from '@/lib/email/resend';

export interface NotifyDownloadInput {
  layoutTitle: string;
  slug: string;
  downloader: string;
  ip: string;
}

interface NotifyDeps {
  sendEmail: (i: { to: string; subject: string; html: string; text?: string }) => Promise<{ sent: boolean }>;
  adminEmails: string | undefined;
}

function recipients(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

// Notify the owner of a download. Best-effort: any send failure is swallowed so a
// download is never broken by a notification problem.
export async function notifyDownload(input: NotifyDownloadInput, deps: Partial<NotifyDeps> = {}): Promise<void> {
  const sendEmail = deps.sendEmail ?? realSendEmail;
  const to = recipients('adminEmails' in deps ? deps.adminEmails : process.env.ADMIN_EMAILS);
  if (to.length === 0) return;
  const subject = `New download: ${input.layoutTitle}`;
  const html =
    `<p>A layout was just downloaded.</p>` +
    `<ul><li><strong>Layout:</strong> ${input.layoutTitle} (${input.slug})</li>` +
    `<li><strong>Downloader:</strong> ${input.downloader}</li>` +
    `<li><strong>IP:</strong> ${input.ip}</li></ul>`;
  const text = `New download: ${input.layoutTitle} (${input.slug})\nDownloader: ${input.downloader}\nIP: ${input.ip}`;
  await Promise.all(
    to.map((addr) =>
      sendEmail({ to: addr, subject, html, text }).catch((e) => {
        console.warn(`[notify] download email to ${addr} failed: ${(e as Error).message}`);
        return { sent: false };
      }),
    ),
  );
}
