// Purchase email for a plugin Pro license: the key, how to use it, account link.
export function licenseKeyEmail(input: { productTitle: string; licenseKey: string; signInUrl: string }): { subject: string; html: string; text: string } {
  const subject = `Your ${input.productTitle} license key`;
  const text = [
    `Thanks for your purchase of ${input.productTitle}!`,
    '',
    `Your license key: ${input.licenseKey}`,
    '',
    'To get started:',
    '1. Sign in to your account and download the Pro plugin zip:',
    `   ${input.signInUrl}`,
    '2. In WordPress: Plugins → Add New → Upload Plugin → install and activate it (keep the free plugin active too).',
    '3. Open the plugin settings, paste your license key, and click Activate.',
    '',
    'Your license covers unlimited sites and renews yearly. Manage it anytime from your account.',
  ].join('\n');
  const html = text
    .split('\n')
    .map((l) => (l ? `<p style="margin:0 0 8px">${l.replace(input.licenseKey, `<strong>${input.licenseKey}</strong>`)}</p>` : '<br/>'))
    .join('');
  return { subject, html, text };
}
