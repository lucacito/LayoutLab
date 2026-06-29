import { track } from '@vercel/analytics';
import type { AnalyticsEvent } from './events';

// Fire a named funnel event. Analytics must never break the UI, so any error
// (or a non-Vercel/dev environment where track no-ops) is swallowed.
export function trackEvent(name: AnalyticsEvent, props?: Record<string, string | number | boolean | null>): void {
  try {
    track(name, props);
  } catch {
    /* no-op */
  }
}
