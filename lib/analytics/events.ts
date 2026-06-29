export const ANALYTICS_EVENTS = {
  productViewed: 'product_viewed',
  checkoutStarted: 'checkout_started',
  freeCaptureSubmitted: 'free_capture_submitted',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
