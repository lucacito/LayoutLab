# Phase 6c — Analytics & Funnel Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vercel Analytics + a typed funnel-event catalog and fire three custom events (`product_viewed`, `checkout_started`, `free_capture_submitted`).

**Architecture:** A `lib/analytics` catalog + `trackEvent` wrapper around `@vercel/analytics`'s `track`; `<Analytics/>` mounted in the root layout; three client touchpoints fire events. Page views + Web Vitals are automatic.

**Tech Stack:** Next.js 15, `@vercel/analytics`, Vitest + RTL.

## Global Constraints

- **Consistent event names from day one:** every event name lives in `ANALYTICS_EVENTS` (`lib/analytics/events.ts`) as a `const`; nothing passes a raw string to `track`.
- **Analytics never breaks the UI:** `trackEvent` swallows errors; in dev / non-Vercel it no-ops.
- **No behavior regressions:** BuyButton still checks out, FreePackForm still captures + signs in — events are strictly additive.
- **Props are flat scalars** (`string | number | boolean | null`) per Vercel's `track` contract.
- Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Analytics foundation

**Files:**
- Create: `lib/analytics/events.ts`, `lib/analytics/track.ts`, `lib/analytics/index.ts`
- Modify: `app/layout.tsx`, `package.json` (add `@vercel/analytics`)
- Test: `tests/analytics.test.ts`

**Interfaces:**
- Produces: `ANALYTICS_EVENTS` (const map); `type AnalyticsEvent`; `trackEvent(name: AnalyticsEvent, props?: Record<string, string | number | boolean | null>): void`.

- [ ] **Step 1: Install @vercel/analytics**

Run: `npm install @vercel/analytics`
Expected: installs.

- [ ] **Step 2: Write the failing test**

```ts
// tests/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const track = vi.fn();
vi.mock('@vercel/analytics', () => ({ track }));

beforeEach(() => track.mockReset());

describe('ANALYTICS_EVENTS', () => {
  it('defines the three funnel events with snake_case names', async () => {
    const { ANALYTICS_EVENTS } = await import('@/lib/analytics');
    expect(ANALYTICS_EVENTS.productViewed).toBe('product_viewed');
    expect(ANALYTICS_EVENTS.checkoutStarted).toBe('checkout_started');
    expect(ANALYTICS_EVENTS.freeCaptureSubmitted).toBe('free_capture_submitted');
  });
});

describe('trackEvent', () => {
  it('forwards the name + props to @vercel/analytics track', async () => {
    const { trackEvent } = await import('@/lib/analytics');
    trackEvent('checkout_started', { kind: 'pack', packId: 'p1' });
    expect(track).toHaveBeenCalledWith('checkout_started', { kind: 'pack', packId: 'p1' });
  });

  it('never throws if track throws', async () => {
    track.mockImplementation(() => { throw new Error('no analytics'); });
    const { trackEvent } = await import('@/lib/analytics');
    expect(() => trackEvent('product_viewed')).not.toThrow();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- tests/analytics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the catalog + wrapper**

```ts
// lib/analytics/events.ts
export const ANALYTICS_EVENTS = {
  productViewed: 'product_viewed',
  checkoutStarted: 'checkout_started',
  freeCaptureSubmitted: 'free_capture_submitted',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
```

```ts
// lib/analytics/track.ts
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
```

```ts
// lib/analytics/index.ts
export { ANALYTICS_EVENTS, type AnalyticsEvent } from './events';
export { trackEvent } from './track';
```

- [ ] **Step 5: Mount `<Analytics/>` in the root layout**

In `app/layout.tsx`: add `import { Analytics } from '@vercel/analytics/react';` and render `<Analytics />` inside `<body>` after `<Footer />`:
```tsx
      <body className="font-sans">
        <Header />
        {children}
        <Footer />
        <Analytics />
      </body>
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- tests/analytics.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/analytics app/layout.tsx package.json package-lock.json tests/analytics.test.ts
git commit -m "feat: Vercel Analytics + typed funnel-event catalog (trackEvent)"
```
(append the trailer)

---

### Task 2: Instrument the funnel touchpoints

**Files:**
- Create: `components/TrackView.tsx`
- Modify: `components/BuyButton.tsx`, `components/FreePackForm.tsx`, `app/(catalog)/layouts/[slug]/page.tsx`, `app/(catalog)/packs/[slug]/page.tsx`
- Test: `tests/track-view.test.tsx`, `tests/buybutton.test.tsx`, extend `tests/free-pack-form.test.tsx`

**Interfaces:**
- Consumes: `trackEvent`, `ANALYTICS_EVENTS` (Task 1).
- Produces: `TrackView({ event, props })` — fires once on mount, renders null.

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/track-view.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent, ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

import { TrackView } from '@/components/TrackView';

describe('TrackView', () => {
  it('fires the event once on mount with its props', () => {
    render(<TrackView event="product_viewed" props={{ kind: 'pack', slug: 'a' }} />);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('product_viewed', { kind: 'pack', slug: 'a' });
  });
});
```

```tsx
// tests/buybutton.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent, ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

import { BuyButton } from '@/components/BuyButton';

beforeEach(() => {
  trackEvent.mockReset();
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ url: 'https://checkout.test/s' }) })));
  vi.spyOn(window.location, 'assign').mockImplementation(() => {});
});

describe('BuyButton', () => {
  it('fires checkout_started with the pack id when clicked', async () => {
    const { getByRole } = render(<BuyButton kind="pack" packId="p1" label="Buy" />);
    fireEvent.click(getByRole('button', { name: 'Buy' }));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('checkout_started', { kind: 'pack', packId: 'p1' }));
  });

  it('fires checkout_started with the plan for membership', async () => {
    const { getByRole } = render(<BuyButton kind="membership" plan="monthly" label="Subscribe" />);
    fireEvent.click(getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('checkout_started', { kind: 'membership', plan: 'monthly' }));
  });
});
```

Add to `tests/free-pack-form.test.tsx` (keep the existing render test; mock analytics at the top):
```tsx
// at top, alongside the existing actions mock:
import { fireEvent } from '@testing-library/react';
const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent, ANALYTICS_EVENTS: { productViewed: 'product_viewed', checkoutStarted: 'checkout_started', freeCaptureSubmitted: 'free_capture_submitted' } }));

// new test:
it('fires free_capture_submitted on submit', () => {
  const { container } = render(<FreePackForm packId="p1" />);
  fireEvent.submit(container.querySelector('form')!);
  expect(trackEvent).toHaveBeenCalledWith('free_capture_submitted', { packId: 'p1' });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test -- tests/track-view.test.tsx tests/buybutton.test.tsx tests/free-pack-form.test.tsx`
Expected: FAIL — `TrackView` missing; BuyButton/FreePackForm don't call `trackEvent` yet.

- [ ] **Step 3: Implement `TrackView`**

```tsx
// components/TrackView.tsx
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
```

- [ ] **Step 4: Fire `checkout_started` in BuyButton**

In `components/BuyButton.tsx`, add `import { trackEvent } from '@/lib/analytics';` and, as the first line inside `go()` (before `setLoading(true)`):
```ts
    trackEvent('checkout_started', props.kind === 'pack' ? { kind: 'pack', packId: props.packId } : { kind: 'membership', plan: props.plan });
```

- [ ] **Step 5: Fire `free_capture_submitted` in FreePackForm**

Convert `components/FreePackForm.tsx` to a client component that fires the event on submit (the server action still runs):
```tsx
// components/FreePackForm.tsx
'use client';
import { captureFreePackAction } from '@/lib/capture/actions';
import { trackEvent } from '@/lib/analytics';

export function FreePackForm({ packId }: { packId: string }) {
  return (
    <form
      action={captureFreePackAction.bind(null, packId)}
      onSubmit={() => trackEvent('free_capture_submitted', { packId })}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 w-full rounded-card border border-fog bg-paper px-3 text-body text-navy outline-none focus:border-action sm:w-64"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
      >
        Email me this free pack
      </button>
    </form>
  );
}
```
(Keep the markup/classes identical to the current version — only add `'use client'`, the analytics import, and `onSubmit`.)

- [ ] **Step 6: Mount `TrackView` on the detail pages**

In `app/(catalog)/layouts/[slug]/page.tsx`, add `import { TrackView } from '@/components/TrackView';` and render it inside the returned JSX (e.g. just after the opening `<main>` or alongside the JsonLd blocks):
```tsx
        <TrackView event="product_viewed" props={{ kind: 'layout', slug: layout.slug }} />
```
In `app/(catalog)/packs/[slug]/page.tsx`, the same with the pack:
```tsx
        <TrackView event="product_viewed" props={{ kind: 'pack', slug: pack.slug }} />
```
(Place it inside the existing top-level element so it renders; it outputs nothing.)

- [ ] **Step 7: Run the tests + full suite + typecheck + lint**

Run: `npm run test -- tests/track-view.test.tsx tests/buybutton.test.tsx tests/free-pack-form.test.tsx && npm run test && npm run typecheck && npm run lint`
Expected: PASS — the three event tests green; no regressions (BuyButton still fetches + redirects; FreePackForm still renders + binds the action).

- [ ] **Step 8: Commit**

```bash
git add components/TrackView.tsx components/BuyButton.tsx components/FreePackForm.tsx "app/(catalog)/layouts/[slug]/page.tsx" "app/(catalog)/packs/[slug]/page.tsx" tests/track-view.test.tsx tests/buybutton.test.tsx tests/free-pack-form.test.tsx
git commit -m "feat: fire product_viewed / checkout_started / free_capture_submitted events"
```
(append the trailer)

---

### Task 3: Acceptance — verification

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS — analytics, track-view, buybutton, free-pack-form, plus all prior suites green; DB-gated suites skip.

- [ ] **Step 2: Production build**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://layoutlab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@layoutlab.com npm run build
```
Expected: PASS — the app compiles with `<Analytics/>` mounted and the instrumented pages/components.

- [ ] **Step 3: Confirm wiring**

Run: `grep -rn "trackEvent(" components/ app/ | grep -vE "lib/analytics|test"`
Expected: shows `checkout_started` (BuyButton), `free_capture_submitted` (FreePackForm), and `TrackView` usage (`product_viewed`) on the two detail pages.

- [ ] **Step 4: Manual (prod-only note)**

Vercel Analytics custom events report only on a Vercel deployment. After deploy:
view a layout/pack (`product_viewed`), click Buy (`checkout_started`), submit a free
pack (`free_capture_submitted`) → events appear in the Vercel Analytics dashboard.
Locally they no-op (expected).

- [ ] **Step 5: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: Phase 6c acceptance verified"
```
(append the trailer)

---

## Notes

- Custom events surface only on a Vercel production deployment; local dev no-ops by
  design. The build + unit tests verify the wiring; the dashboard verifies the data
  post-deploy.
