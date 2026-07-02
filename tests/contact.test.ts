import { describe, it, expect, vi } from 'vitest';
import { sendContactMessage, contactRecipients, SUPPORT_EMAIL } from '@/lib/site/contact';

describe('contactRecipients', () => {
  it('parses ADMIN_EMAILS into a list, empty when unset', () => {
    expect(contactRecipients('a@x.com, b@x.com')).toEqual(['a@x.com', 'b@x.com']);
    expect(contactRecipients('')).toEqual([]);
    expect(contactRecipients(undefined)).toEqual([]);
  });
});

describe('sendContactMessage', () => {
  const input = { name: 'Ada', email: 'ada@x.com', message: 'Hi there' };

  it('emails each recipient, includes the message, and sets reply-to the sender', async () => {
    const sendEmail = vi.fn(async (_i: { to: string; subject: string; html: string; text?: string; replyTo?: string }) => ({ sent: true }));
    const res = await sendContactMessage(input, { sendEmail, adminEmails: 'owner@x.com' });
    expect(res.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0]![0];
    expect(call.to).toBe('owner@x.com');
    expect(call.replyTo).toBe('ada@x.com');
    expect(call.subject).toContain('Ada');
    expect(call.html).toContain('Hi there');
    expect(call.text).toContain('ada@x.com');
  });

  it('reports not-sent when there are no recipients (does not throw)', async () => {
    const sendEmail = vi.fn(async () => ({ sent: true }));
    const res = await sendContactMessage(input, { sendEmail, adminEmails: '' });
    expect(res.sent).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('exposes a display support address on the divi5lab.com domain', () => {
    expect(SUPPORT_EMAIL).toMatch(/@divi5lab\.com$/);
  });
});
