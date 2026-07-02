import { describe, it, expect, vi } from 'vitest';
import { notifyDownload } from '@/lib/notify/download';

const input = { layoutTitle: 'Bold Fitness Hero', slug: 'bold-fitness-hero', downloader: 'buyer@example.com', ip: '1.2.3.4' };

describe('notifyDownload', () => {
  it('emails each ADMIN_EMAILS recipient with the layout title in the subject', async () => {
    const sendEmail = vi.fn(async (_i: { to: string; subject: string; html: string; text?: string }) => ({ sent: true }));
    await notifyDownload(input, { sendEmail, adminEmails: 'a@x.com, b@x.com' });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    const calls = sendEmail.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.to).sort()).toEqual(['a@x.com', 'b@x.com']);
    expect(calls[0]!.subject).toContain('Bold Fitness Hero');
    expect(calls[0]!.html).toContain('buyer@example.com');
    expect(calls[0]!.text).toContain('bold-fitness-hero');
  });
  it('does nothing when ADMIN_EMAILS is empty', async () => {
    const sendEmail = vi.fn(async () => ({ sent: true }));
    await notifyDownload(input, { sendEmail, adminEmails: '' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it('never rejects when sendEmail throws (a failed notification must not break a download)', async () => {
    const sendEmail = vi.fn(async () => { throw new Error('resend down'); });
    await expect(notifyDownload(input, { sendEmail, adminEmails: 'a@x.com' })).resolves.toBeUndefined();
  });
});
