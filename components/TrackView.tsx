'use client';
import { useEffect } from 'react';
import { trackEvent, type AnalyticsEvent } from '@/lib/analytics';

export function TrackView({ event, props }: { event: AnalyticsEvent; props?: Record<string, string | number | boolean | null> }) {
  useEffect(() => {
    trackEvent(event, props);
    // fire once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
