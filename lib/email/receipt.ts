export function purchaseReceiptEmail(input: { kind: 'pack' | 'membership'; packTitle?: string; amountCents?: number; signInUrl: string }): { subject: string; html: string; text: string } {
  const item = input.kind === 'membership' ? 'All-access membership' : (input.packTitle ?? 'Your pack');
  const amount = input.amountCents != null ? `$${(input.amountCents / 100).toFixed(input.amountCents % 100 === 0 ? 0 : 2)}` : '';
  const subject = 'Your LayoutLab purchase receipt';
  const amountLine = amount ? `<p style="color:#476788;font-size:15px;margin:0 0 8px">Amount: <strong>${amount}</strong></p>` : '';
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F9FB;padding:32px">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="color:#0B3558;font-size:22px;margin:0 0 12px">Thank you for your purchase</h1>
      <p style="color:#476788;font-size:15px;margin:0 0 8px">Item: <strong>${item}</strong></p>
      ${amountLine}
      <p style="color:#476788;font-size:15px;line-height:1.5;margin:16px 0 24px">Your files are ready. Click below to sign in and download — no password needed.</p>
      <a href="${input.signInUrl}" style="display:inline-block;background:#006BFF;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:4px">Access your downloads</a>
      <p style="color:#476788;font-size:13px;margin:24px 0 0">Or paste this link into your browser:<br><a href="${input.signInUrl}" style="color:#006BFF">${input.signInUrl}</a></p>
    </td></tr>
  </table></body></html>`;
  const text = `Thank you for your purchase\n\nItem: ${item}${amount ? `\nAmount: ${amount}` : ''}\n\nYour files are ready. Open this link to sign in and download (no password needed):\n${input.signInUrl}\n`;
  return { subject, html, text };
}
