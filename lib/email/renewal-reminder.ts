/**
 * Renewal reminder email. Subscriptions renew automatically, so this says when the renewal is charged and how to change
 * or cancel it, and repeats the promise that nothing stops working if the licence ends.
 */

export interface RenewalReminderInput {
  email: string;
  tierLabel: string;
  renewalDate: Date;
  manageUrl: string;
}

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renewalReminderEmail(input: RenewalReminderInput) {
  const date = input.renewalDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const subject = `Your AI Editor for Divi 5 Pro licence renews on ${date}`;

  const lines = [
    `Your AI Editor for Divi 5 Pro ${input.tierLabel} licence renews on ${date}.`,
    '',
    'The renewal is charged automatically to the payment method on file, at the price of your current plan.',
    'To change your plan, update your card or cancel, use your account:',
    input.manageUrl,
    '',
    'If you cancel, everything keeps working on the sites where it is activated. Only updates and support stop.',
  ];
  const text = lines.join('\n');

  const html = [
    `<p>Your AI Editor for Divi 5 Pro <strong>${escapeHtml(input.tierLabel)}</strong> licence renews on <strong>${escapeHtml(date)}</strong>.</p>`,
    '<p>The renewal is charged automatically to the payment method on file, at the price of your current plan.</p>',
    `<p>To change your plan, update your card or cancel, use <a href="${escapeHtml(input.manageUrl)}">your account</a>.</p>`,
    '<p>If you cancel, everything keeps working on the sites where it is activated. Only updates and support stop.</p>',
  ].join('');

  return { subject, html, text };
}
