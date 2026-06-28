export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  const subject = 'Sign in to LayoutLab';
  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F9FB;padding:32px">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="color:#0B3558;font-size:22px;margin:0 0 12px">Sign in to LayoutLab</h1>
      <p style="color:#476788;font-size:15px;line-height:1.5;margin:0 0 24px">Click the button below to sign in. This link expires soon and can be used once.</p>
      <a href="${url}" style="display:inline-block;background:#006BFF;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:4px">Sign in</a>
      <p style="color:#476788;font-size:13px;margin:24px 0 0">Or paste this link into your browser:<br><a href="${url}" style="color:#006BFF">${url}</a></p>
    </td></tr>
  </table></body></html>`;
  const text = `Sign in to LayoutLab\n\nOpen this link to sign in (expires soon, single use):\n${url}\n`;
  return { subject, html, text };
}
