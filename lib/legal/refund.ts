export const REFUND_POLICY = `All sales are final. Divi5Lab products are digital goods delivered instantly as downloadable files, so we do not offer refunds. By completing a purchase you acknowledge that you are buying immediate access to digital content and waive any right to a refund. If a file is genuinely broken, fails to import, or you were charged in error, contact support@divi5lab.com within 14 days of purchase and we'll make it right with a fix or a replacement file, not a cash refund. Pro plugin licenses renew yearly and can be cancelled anytime. Cancelling stops future renewals and the plugin keeps working without updates.`;

import { PRICING } from '@/lib/pricing/config';

/**
 * The refund terms for AI Editor for Divi 5 Pro. The numbers come from config/pricing.json. The general policy above
 * keeps governing downloads and the converter plugins.
 */
export function aiEditorRefundPolicy(): string {
  const days = PRICING.refundWindowDays;
  const trial = `${PRICING.trial.days}-day free trial${PRICING.trial.requireCard ? '' : ', which needs no card'}`;
  return [
    `AI Editor for Divi 5 Pro has a ${trial}, so you can see it working on your own site before you pay. Because of that, a purchase is final once you have bought a plan: we do not refund a purchase because you changed your mind.`,
    `We do refund, in full, when you write to support@divi5lab.com within ${days} days of the charge and any of these is true: you were charged twice or in error; the add-on cannot be activated or does not work on a supported setup and we cannot fix it; or a yearly renewal was charged and you want to stop (we refund that renewal and cancel the plan).`,
    'You can cancel a plan at any time from your billing page. You keep the plan until the end of the period you paid for, and nothing is refunded for the time left. If a licence ends, for any reason, the Pro tools keep working on the sites where it was activated; only updates and support stop.',
    'An upgrade is charged as the prorated difference for the rest of your current period. Lifetime is a single payment and follows the same rules as any other purchase here.',
    'If the law where you live gives you a right to a refund that cannot be waived, nothing in this policy limits it.',
  ].join(' ');
}
