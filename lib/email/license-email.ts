/** What the buyer paid, as Stripe reported it when the checkout completed. */
export interface PurchaseOrder {
  /** e.g. "Agency (Lifetime)", "Personal (annual)", "Personal (free trial)". */
  planLabel: string;
  /** Total charged now, after any discount, in the currency's minor unit (cents). */
  amountCents: number;
  /** How much the discount took off (0 when none). */
  discountCents: number;
  /** ISO currency code as Stripe sends it (lower case is fine). */
  currency: string;
  paidAt: Date;
  /** A Stripe id the buyer's bookkeeper can match: the payment intent or invoice id. */
  reference: string;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

function orderLines(order: PurchaseOrder): string[] {
  const date = order.paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return [
    'Order summary',
    `Plan: ${order.planLabel}`,
    `Date: ${date}`,
    ...(order.amountCents > 0
      ? [
          `Amount paid: ${money(order.amountCents, order.currency)} ${order.currency.toUpperCase()}`,
          ...(order.discountCents > 0 ? [`Discount applied: ${money(order.discountCents, order.currency)}`] : []),
        ]
      : ['No charge today.']),
    `Reference: ${order.reference}`,
    'Keep this email as your receipt. If your bookkeeper needs an invoice with your company details, email support@divi5lab.com.',
  ];
}

// Purchase email for a plugin Pro license: the key, how to use it, account link, and the order summary (it doubles as the receipt).
export function licenseKeyEmail(input: {
  productTitle: string;
  licenseKey: string;
  signInUrl: string;
  /** AI Editor Pro only: the tier label and its site limit (null = unlimited), and whether it is a lifetime licence. */
  tierLabel?: string;
  sitesAllowed?: number | null;
  lifetime?: boolean;
  /** What was paid. Omitted when the checkout did not report an amount. */
  order?: PurchaseOrder;
}): { subject: string; html: string; text: string } {
  const coverage = input.tierLabel === undefined
    ? 'Your license covers unlimited sites and renews yearly. Manage it anytime from your account.'
    : [
        `Your ${input.tierLabel} licence covers ${input.sitesAllowed == null ? 'unlimited sites' : input.sitesAllowed === 1 ? '1 site' : `${input.sitesAllowed} sites`}`,
        input.lifetime ? ' with a single payment and no renewal.' : ' and renews yearly.',
        ' You can free a site and use the slot elsewhere from your account. If it ever lapses, everything keeps working; only updates and support stop.',
      ].join('');
  const subject = `Your ${input.productTitle} license key${input.order ? ' and receipt' : ''}`;
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
    coverage,
    ...(input.order ? ['', ...orderLines(input.order)] : []),
  ].join('\n');
  const html = text
    .split('\n')
    .map((l) => (l ? `<p style="margin:0 0 8px">${l.replace(input.licenseKey, `<strong>${input.licenseKey}</strong>`)}</p>` : '<br/>'))
    .join('');
  return { subject, html, text };
}
