/**
 * Renewal reminder email for expiring licenses
 */

export interface RenewalReminderInput {
  email: string;
  tierLabel: string;
  expiryDate: Date;
  manageUrl: string;
}

export function renewalReminderEmail(input: RenewalReminderInput) {
  const formattedDate = input.expiryDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = 'Your AI Editor for Divi 5 Pro license expires soon';

  const text = `Your AI Editor for Divi 5 Pro ${input.tierLabel} license expires on ${formattedDate}.

All features keep working after expiry. You just won't receive updates and support.

To keep your license active and receive updates, renew it now:
${input.manageUrl}
`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.header { margin-bottom: 30px; }
.body-text { margin: 20px 0; }
.cta { margin: 30px 0; }
.cta-button { background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: 500; }
.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h2>License Expiry Notice</h2>
</div>

<div class="body-text">
<p>Your AI Editor for Divi 5 Pro <strong>${input.tierLabel}</strong> license expires on <strong>${formattedDate}</strong>.</p>

<p>All features keep working after expiry. You just won't receive updates and support.</p>

<p>To keep your license active and receive updates, renew it now:</p>
</div>

<div class="cta">
<a href="${input.manageUrl}" class="cta-button">Renew License</a>
</div>

<div class="footer">
<p>Questions? Visit your account page or contact support.</p>
</div>
</div>
</body>
</html>`;

  return { subject, html, text };
}
