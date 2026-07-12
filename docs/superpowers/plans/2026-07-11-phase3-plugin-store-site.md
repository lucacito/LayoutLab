# Phase 3: Plugin-Store Site Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn divi5lab.com into a plugin-store: plugins-first homepage and nav, a /plugins hub with all three products (including the Divi→Elementor "pending wp.org review" page and the AI Editor waitlist), pricing rebuilt around licenses, migration-keyword guides, and the layout marketplace demoted to free goodies.

**Architecture:** All work in the layoutlab repo. The commerce spine stays: plugin checkout (`kind:'plugin'`) is the only purchasable product; pack/membership SALES surfaces are removed but the webhook's legacy fulfillment branches remain (defensive, tested, harmless). All packs flip to `kind='free'` via a data script so the existing free-capture flow covers the whole catalog with minimal code. Waitlists reuse `/api/lead` + `email_captures` with a `source` tag (one-line forwarding fix).

**Tech Stack:** Next.js App Router (RSC), Tailwind, Drizzle, Vitest (+jsdom), existing `lib/capture`, `lib/seo`, markdown guides in `content/guides/`.

## Global Constraints

- The ONLY purchasable products after this phase: plugin licenses via `POST /api/checkout` `{kind:'plugin', product}`. `BuyProButton` and everything under `app/api/license`, `app/api/plugin`, `lib/license-server` must be untouched.
- Do NOT touch `lib/stripe/fulfillment.ts` / `fulfillment-store.ts` (webhook stays able to process any stray legacy events) or `lib/stripe/checkout.ts`'s pack/membership functions (unreachable ≠ deleted; cleanup is out of scope).
- URLs are load-bearing: `/plugins/elementor-to-divi-5` (already live, linked from the shipped wp.org plugin), new pages exactly `/plugins`, `/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor`.
- Product naming in copy: "Elementor → Divi 5 Converter" / "Divi → Elementor Converter" / "Divi 5 AI Editor". Paid tier is always "Pro" — never "Premium". Price copy: **$49/yr, unlimited sites**.
- Divi→Elementor status copy (exact fact): the FREE plugin is submitted and pending wordpress.org review; Pro is coming after approval. No buy button for it in this phase.
- Waitlist source tags (exact strings, they flow to Loops): `ai_editor_waitlist`, `divi_to_elementor_waitlist`.
- Free catalog story: every layout and pack is free behind email capture. No "$", "paid", "premium", "membership", "all-access" claims anywhere user-facing about LAYOUTS (plugins keep their Pro pricing).
- Keyword pages: `tests/seo-keyword-pages.test.ts` pins exactly 13 pages — edit copy only, never add/remove slugs.
- Keep all existing routes alive (no 404 regressions): `/pricing`, `/packs`, `/contact`, `/browse`, taxonomy/keyword pages, checkout success/cancel.
- House rules: TDD per task; `npx vitest run <file>` while iterating; full `npm run test` + `npm run typecheck` + `npm run lint` before each commit; run in the worktree, never on checked-out main.

---

### Task 1: Waitlist plumbing — `/api/lead` forwards `source` + shared WaitlistForm

**Files:**
- Modify: `lib/capture/lead.ts` (add `source` param; currently hardcodes `'free_download'` at ~line 14)
- Modify: `app/api/lead/route.ts` (forward the validated `source` to `recordLeadCapture`)
- Create: `components/plugins/WaitlistForm.tsx`
- Test: `tests/lead-capture.test.ts` (extend), `tests/waitlist-form.test.tsx` (new)

**Interfaces:**
- Consumes: existing `recordLeadCapture(email)` in `lib/capture/lead.ts`, `/api/lead` zod schema (already accepts `source` max 40 chars but drops it).
- Produces: `recordLeadCapture(email: string, source?: string)` (default `'free_download'` — existing callers unchanged); `<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />` client component POSTing `{email, source}` to `/api/lead`, success state "You're on the list — we'll email you at launch.", error state on non-200.

- [ ] **Step 1: Extend `tests/lead-capture.test.ts`** — read the file first and follow its existing mocking style; add cases:

```ts
it('forwards a custom source to loops sync', async () => {
  // arrange per the file's existing fixture pattern, then:
  await recordLeadCapture('x@y.com', 'ai_editor_waitlist');
  expect(syncContactMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'ai_editor_waitlist' }));
});

it('defaults source to free_download', async () => {
  await recordLeadCapture('x@y.com');
  expect(syncContactMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'free_download' }));
});
```

- [ ] **Step 2: New `tests/waitlist-form.test.tsx`:**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';

describe('WaitlistForm', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('POSTs email + source to /api/lead and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join the waitlist/i }));
    await waitFor(() => expect(screen.getByText(/on the list/i)).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith('/api/lead', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'x@y.com', source: 'ai_editor_waitlist' }),
    }));
  });

  it('shows an error state when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    render(<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x@y.com' } });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));
    await waitFor(() => expect(screen.getByText(/try again/i)).toBeTruthy());
  });
});
```

- [ ] **Step 3: Run both to verify failure** — `npx vitest run tests/lead-capture.test.ts tests/waitlist-form.test.tsx` → FAIL.

- [ ] **Step 4: Implement**

`lib/capture/lead.ts`: change the signature to `recordLeadCapture(email: string, source = 'free_download')` and pass `source` through to the `syncContact` call (replace the hardcoded string).

`app/api/lead/route.ts`: pass the parsed `source` (when present) as the second arg: `await recordLeadCapture(email, source ?? undefined)`.

`components/plugins/WaitlistForm.tsx`:

```tsx
'use client';
import { useState } from 'react';

export function WaitlistForm({ source, cta }: { source: string; cta: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className="text-body font-medium text-navy">You’re on the list — we’ll email you at launch.</p>;
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-wrap gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-full border border-border bg-paper px-4 text-small text-navy outline-none focus:border-action"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="inline-flex h-11 items-center justify-center rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60"
      >
        {state === 'loading' ? 'Joining…' : cta}
      </button>
      {state === 'error' && <p className="w-full text-small text-red-600">Something went wrong — please try again.</p>}
    </form>
  );
}
```

- [ ] **Step 5: Run tests → PASS; typecheck; commit**

```bash
git add lib/capture/lead.ts app/api/lead/route.ts components/plugins/WaitlistForm.tsx tests/lead-capture.test.ts tests/waitlist-form.test.tsx
git commit -m "feat(store): lead capture carries a source tag + shared WaitlistForm"
```

---

### Task 2: /plugins hub + Divi→Elementor page + AI Editor waitlist page + sitemap

**Files:**
- Create: `app/(marketing)/plugins/page.tsx` (hub)
- Create: `app/(marketing)/plugins/divi-to-elementor/page.tsx`
- Create: `app/(marketing)/plugins/divi-5-ai-editor/page.tsx`
- Modify: `lib/seo/sitemap.ts` (add `/plugins` + the three product paths as static entries, priority 0.9)
- Test: `tests/plugins-hub.test.tsx`, `tests/plugin-d2e-page.test.tsx`, `tests/plugin-ai-editor-page.test.tsx` (new); `tests/sitemap.test.ts` (extend)

**Interfaces:**
- Consumes: `WaitlistForm` (Task 1), `Container`/`Card` primitives, `BuyProButton` (existing), metadata conventions from `app/(marketing)/plugins/elementor-to-divi-5/page.tsx` (read it first — it is the styling/JSON-LD reference for all three new pages).
- Produces: routes `/plugins`, `/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor` — linked by nav (Task 5), homepage (Task 4), pricing (Task 3).

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/plugins-hub.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginsHub, { metadata } from '@/app/(marketing)/plugins/page';

describe('/plugins hub', () => {
  it('lists all three products with correct links and statuses', async () => {
    render(await PluginsHub());
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getAllByText(/\$49\/yr/i).length).toBeGreaterThan(0);
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/plugins/i); });
});
```

```tsx
// tests/plugin-d2e-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import D2EPage, { metadata } from '@/app/(marketing)/plugins/divi-to-elementor/page';

describe('/plugins/divi-to-elementor', () => {
  it('states the pending-review status, has a notify form, and NO buy button', async () => {
    render(await D2EPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Divi.*Elementor/i);
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeTruthy();
    expect(screen.queryByText(/checkout|buy now/i)).toBeNull();
  });
  it('mentions the coming Pro tier price', async () => {
    render(await D2EPage());
    expect(screen.getAllByText(/\$49\/yr/).length).toBeGreaterThan(0);
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/Divi to Elementor/i); });
});
```

```tsx
// tests/plugin-ai-editor-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiEditorPage, { metadata } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('is a coming-soon page with a waitlist form', async () => {
    render(await AiEditorPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI Editor/i);
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /join the waitlist/i })).toBeTruthy();
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/AI Editor/i); });
});
```

Extend `tests/sitemap.test.ts` (match its existing style): assert entries for `/plugins`, `/plugins/elementor-to-divi-5`, `/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor`.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement the three pages** (mirror the existing E2D5 page's structure/classes; content requirements below are binding, exact copy may be polished):

`/plugins` hub: metadata title `WordPress Plugins by Divi5Lab — converters & AI tools`; H1 "Plugins"; three `Card`s:
1. **Elementor → Divi 5 Converter** — "Free on wordpress.org · Pro $49/yr" chip; blurb (migrate pages, kits, headers/footers); links: page (`/plugins/elementor-to-divi-5`) + wp.org listing.
2. **Divi → Elementor Converter** — amber status chip "Free plugin pending wordpress.org review"; blurb (35+ modules, batch conversion); link `/plugins/divi-to-elementor`; "Pro coming after approval — $49/yr".
3. **Divi 5 AI Editor** — "Coming soon" chip; blurb (edit Divi 5 pages with AI, validated output); link `/plugins/divi-5-ai-editor`.

`/plugins/divi-to-elementor`: metadata title `Divi to Elementor Converter — free WordPress plugin (pending review)`, description mentioning converting Divi pages/templates to Elementor; H1 "Convert Divi to Elementor"; status banner (amber Card): "The free plugin is submitted and **pending wordpress.org review** — leave your email and we'll tell you the moment it's approved." + `<WaitlistForm source="divi_to_elementor_waitlist" cta="Notify me" />`; features grid (35+ Divi modules mapped, batch conversion, all three Divi export formats, conversion reports); "Pro coming after approval" section ($49/yr, unlimited sites — Theme Builder templates, WooCommerce widgets, batch tooling); small FAQ; NO buy button, NO JSON-LD Product (nothing purchasable — use only `faqJsonLd` if a FAQ is included).

`/plugins/divi-5-ai-editor`: metadata title `Divi 5 AI Editor — coming soon`; H1 "The Divi 5 AI Editor"; subhead: edit and generate Divi 5 pages with AI, every change checked by a deterministic validator so output always imports cleanly; three feature teaser bullets; prominent "Coming soon" + `<WaitlistForm source="ai_editor_waitlist" cta="Join the waitlist" />`; a cross-link band to the two converters.

`lib/seo/sitemap.ts`: add to the static entries (read the file's entry shape first):

```ts
  { url: `${base}/plugins`, priority: 0.9 },
  { url: `${base}/plugins/elementor-to-divi-5`, priority: 0.9 },
  { url: `${base}/plugins/divi-to-elementor`, priority: 0.8 },
  { url: `${base}/plugins/divi-5-ai-editor`, priority: 0.6 },
```

(match the existing object shape exactly — `lastModified`/`changeFrequency` fields as siblings use).

- [ ] **Step 4: Run tests → PASS; typecheck; commit**

```bash
git add "app/(marketing)/plugins" lib/seo/sitemap.ts tests/plugins-hub.test.tsx tests/plugin-d2e-page.test.tsx tests/plugin-ai-editor-page.test.tsx tests/sitemap.test.ts
git commit -m "feat(store): /plugins hub + divi-to-elementor pending page + AI editor waitlist"
```

---

### Task 3: Pricing page rebuilt around plugin licenses

**Files:**
- Modify: `app/(catalog)/pricing/page.tsx` (full rewrite of content; keep route + `faqJsonLd` pattern)
- Test: `tests/pricing-page.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `BuyProButton` (existing), `Container`/`Card`, `faqJsonLd` from `lib/seo` (read current page for import paths).
- Produces: `/pricing` = plugin licensing page. Linked from nav CTA (Task 5) and account/licenses (already).

- [ ] **Step 1: Rewrite `tests/pricing-page.test.tsx`:**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/plugins/BuyProButton', () => ({
  BuyProButton: ({ product }: { product: string }) => <div data-testid={`buy-${product}`} />,
}));

import PricingPage, { metadata } from '@/app/(catalog)/pricing/page';

describe('/pricing (plugin licenses)', () => {
  it('shows the Elementor→Divi5 Pro card with a live buy button', async () => {
    render(await PricingPage());
    expect(screen.getByText(/Elementor → Divi 5 Pro/i)).toBeTruthy();
    expect(screen.getAllByText(/\$49/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-elementor-to-divi5-pro')).toBeTruthy();
  });
  it('shows Divi→Elementor Pro as coming soon (no buy button)', async () => {
    render(await PricingPage());
    expect(screen.getByText(/Divi → Elementor Pro/i)).toBeTruthy();
    expect(screen.queryByTestId('buy-divi-to-elementor-pro')).toBeNull();
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
  });
  it('mentions free layouts but sells no packs or membership', async () => {
    render(await PricingPage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
    expect(screen.queryByText(/all-access|membership/i)).toBeNull();
  });
  it('keeps FAQ JSON-LD', async () => {
    const { container } = render(await PricingPage());
    const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
    expect(scripts.some((s) => (s.textContent ?? '').includes('FAQPage'))).toBe(true);
  });
  it('has plugin-focused metadata', () => {
    expect(String(metadata.title)).toMatch(/pricing/i);
    expect(String(metadata.description)).toMatch(/plugin|converter/i);
  });
});
```

- [ ] **Step 2: Run → FAIL** (old page still renders packs/membership).

- [ ] **Step 3: Rewrite the page.** Structure (keep the file's existing imports/conventions where reusable; remove `listPacks`/`BuyButton` usage entirely):
  - Metadata: title `Pricing — Pro plugin licenses`, description about converter Pro licenses at $49/yr.
  - H1 "Simple pricing" + subhead ("Free plugins on wordpress.org. Pro unlocks the full migration toolkit — $49/yr, unlimited sites.").
  - Card 1 **Elementor → Divi 5 Pro** — feature bullets (kit ZIP import, global headers/footers → Theme Builder, global styles, 1 year updates + support, unlimited sites), price `$49/yr`, `<BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />`, link to `/plugins/elementor-to-divi-5`.
  - Card 2 **Divi → Elementor Pro** — same bullet style (Theme Builder templates, WooCommerce widgets, batch tooling), "Coming soon — free plugin pending wordpress.org review", link to `/plugins/divi-to-elementor` ("Get notified").
  - Band: **Divi 5 AI Editor** teaser → `/plugins/divi-5-ai-editor`.
  - Band: **Free Divi 5 layouts** — "Every layout in our catalog is free — grab as many as you like." → `/free-divi-layouts` and `/browse`. No prices.
  - FAQ (rewrite; keep `faqJsonLd`): what does Pro include; do licenses cover client sites (yes, unlimited); what happens if I don't renew (keeps working, no updates); are the layouts really free (yes, email signup).

- [ ] **Step 4: Run tests → PASS; run `npx vitest run tests/sitemap.test.ts` (pricing stays in sitemap); typecheck; commit**

```bash
git add "app/(catalog)/pricing/page.tsx" tests/pricing-page.test.tsx
git commit -m "feat(store): pricing page sells plugin licenses; layouts are free goodies"
```

---

### Task 4: Homepage rebuild + services funnel deletion + announcement bar

**Files:**
- Modify: `app/(marketing)/page.tsx` (full rewrite)
- Create: `components/marketing/PluginHero.tsx`, `components/marketing/PluginCards.tsx`, `components/marketing/FreeLayoutsBand.tsx`
- Modify: `components/site/AnnouncementBar.tsx` (~lines 36-38: message + link; bump dismiss key to `ll_announce_dismissed_v3`)
- Delete: `components/services/` (all 4), `components/marketing/FeaturedPacks.tsx`, and the verified-unused marketing components (`CustomBuildCta.tsx`, `FaqSection.tsx`, `SocialProof.tsx`, `HowItWorks.tsx`, `WhyChoose.tsx`, `PopularStartingPoints.tsx`, `Testimonials.tsx`, `ClosingCta.tsx`, `TrustBadges.tsx`, `ProblemSolutionProof.tsx` — CONFIRM each has zero importers via grep before deleting; keep any that has one)
- Delete: `tests/services-hero.test.tsx`, `tests/services-offer.test.tsx`, `tests/services-free-band.test.tsx`
- Test: `tests/homepage.test.tsx` (new)

**Interfaces:**
- Consumes: `WaitlistForm` (via FreeLayoutsBand? no — FreeLayoutsBand uses `/api/lead` like the old ServicesFreeBand: reuse its form logic, source `homepage_free_band`), Container/Card.
- Produces: homepage composed of `<PluginHero /> <PluginCards /> <FreeLayoutsBand />` + closing CTA to `/pricing`.

- [ ] **Step 1: Write `tests/homepage.test.tsx`:**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(marketing)/page';

describe('homepage (plugin store)', () => {
  it('leads with the plugin story and links all three products', async () => {
    render(await HomePage());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/page builder|convert|migrate/i);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
  });
  it('has no services-funnel remnants', async () => {
    render(await HomePage());
    expect(screen.queryByText(/free quote|work with us|brings in work/i)).toBeNull();
  });
  it('keeps a free-layouts band', async () => {
    render(await HomePage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement.**
  - `PluginHero`: H1 "Move your site between page builders — without rebuilding it." subhead (converters validated against real Divi 5 / Elementor structure; free plugins on wp.org, Pro for whole-site migrations); CTAs: primary → `/plugins/elementor-to-divi-5` ("Convert Elementor to Divi 5"), secondary → `/plugins` ("All plugins"). Proof strip: "100+ active installs on wordpress.org · 140+ Elementor widgets mapped · 35+ Divi modules mapped".
  - `PluginCards`: the same three-card layout as the /plugins hub but condensed (title, one-liner, status chip, link). Keep it dumb/static (no data fetch).
  - `FreeLayoutsBand`: port the email-capture band pattern from `components/services/ServicesFreeBand.tsx` BEFORE deleting it (same `/api/lead` POST, `source: 'homepage_free_band'`), reworded: "Free Divi 5 layouts — the whole catalog, free." + links to `/browse`.
  - `app/(marketing)/page.tsx`: drop `listPacks`/paidPacks entirely (page can stop being `force-dynamic` if nothing dynamic remains — check what else forces it); compose Hero + Cards + FreeLayoutsBand + closing CTA section ("Ship your migration this week" → `/pricing`).
  - `AnnouncementBar.tsx`: message "The Elementor → Divi 5 converter is live — free on wordpress.org." link "Get the plugin" → `/plugins/elementor-to-divi-5`; bump dismiss key to v3 so everyone sees it once.
  - Deletions per Files (grep each "unused" component first; delete only zero-importer files).

- [ ] **Step 4: Full suite** (`npm run test`) — fix any test that imported deleted components (`tests/components.test.tsx` and others may reference them; adapt by removing those cases, never by weakening unrelated assertions). Typecheck + lint.

- [ ] **Step 5: Commit**

```bash
git add -A app components tests
git commit -m "feat(store)!: plugin-store homepage; services funnel removed"
```

---

### Task 5: Nav, header CTA, mobile nav, footer

**Files:**
- Modify: `lib/nav/menu-data.ts` (PRIMARY_NAV ~lines 95-99; delete the dead `NAV_MENUS` export + its types if truly unconsumed — verify by grep)
- Modify: `components/site/Header.tsx` (~line 19 CTA), `components/site/MobileNav.tsx` (icon map line ~9, CTA line ~40), `components/site/Footer.tsx` (line ~19 "Pricing & all-access", brand blurb lines ~48-49; add a "Plugins" column)
- Test: `tests/primary-nav.test.tsx`, `tests/mobile-nav.test.tsx`, `tests/site-chrome.test.tsx`, `tests/menu-data.test.ts` (update)

**Interfaces:**
- Produces the new nav contract consumed by tests:

```ts
export const PRIMARY_NAV = [
  { key: 'plugins', label: 'Plugins', href: '/plugins' },
  { key: 'layouts', label: 'Free layouts', href: '/free-divi-layouts' },
  { key: 'browse', label: 'Browse', href: '/browse' },
  { key: 'guides', label: 'Guides', href: '/guides' },
] as const;
```

Header + MobileNav CTA: label `Get Pro` → `/pricing`.

- [ ] **Step 1: Update the three nav test files FIRST** (TDD): assert the four links above, the `Get Pro`→`/pricing` CTA, absence of "Work with us"/"Get a free quote"/`/contact` in the primary nav (contact stays reachable via footer). Follow each test file's existing render/mocking approach; keep "Sign in" assertions.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the PRIMARY_NAV change, MobileNav icon map (`plugins`→`extension`, `layouts`→`dashboard_customize`, `browse`→`grid_view`, `guides`→`menu_book` — verify each icon name exists in the material font the same way Task 10 of the licensing plan did, or reuse icons already in the map), Header/MobileNav CTA swap, Footer: rename "Pricing & all-access"→"Pricing", add a Plugins column (3 product links + `/plugins`), brand blurb → "Free, validated Divi 5 layouts and migration plugins for WordPress builders." Keep taxonomy columns.
- [ ] **Step 4: Full suite + typecheck + lint; commit**

```bash
git add lib/nav/menu-data.ts components/site tests/primary-nav.test.tsx tests/mobile-nav.test.tsx tests/site-chrome.test.tsx tests/menu-data.test.ts
git commit -m "feat(store): plugins-first navigation + Get Pro CTA"
```

---

### Task 6: Marketplace demotion — everything free-with-capture, sales surfaces removed

**Files:**
- Create: `scripts/make-packs-free.ts` (data: flip all packs to `kind='free'`)
- Modify: `app/api/checkout/route.ts` (drop `pack` + `membership` from the zod union + their branches; only `plugin` remains)
- Modify: `app/api/download/[layoutId]/route.ts` (~lines 40-52: remove the `isPaidOnlyLayout` branch — every layout needs only `capturedEmail || sessionEmail`; keep taster cookie code only if still referenced — it becomes moot, remove its usage here)
- Modify: `app/api/download/pack/[packId]/route.ts` (drop the entitlement gate: allow when `canDownloadPack` OR a captured email/session exists — since all packs are `kind='free'` after the data flip, the existing free-pack logic may already suffice; verify `canDownloadPack`'s free-pack handling and prefer the minimal change)
- Modify: `app/(catalog)/layouts/[slug]/page.tsx` (~lines 61-77, 140-161: always render `FreeDownloadGate`; delete the `PaidLayoutCta` branch)
- Modify: `components/PackCta.tsx` (free-only: entitled → download link; else `FreePackForm`; delete the BuyButton branch)
- Delete: `components/BuyButton.tsx`, `components/PaidLayoutCta.tsx`, `components/ScrollOffer.tsx` + `components/ExitIntentPopup.tsx` ONLY IF their sole purpose was the taster giveaway — check what they render and where mounted (likely `app/layout.tsx`); if they're generic capture popups, retarget their copy instead of deleting. `lib/capture/taster.ts` + `/api/taster` route: delete if nothing references them after the popup decision; otherwise leave.
- Modify: `app/(catalog)/packs/page.tsx` (~lines 16-17, 50: hero copy → free story; "See pricing & all-access" → "Get the free layouts")
- Test: update `tests/checkout.test.ts` (route-level cases if any assert pack/membership acceptance — the UNIT tests for `buildCheckoutSessionParams` stay untouched), `tests/download-route.test.ts`, `tests/pack-download-route.test.ts`, `tests/pack-cta.test.tsx`, delete `tests/buy-button.test.tsx`/`tests/buybutton.test.tsx`/`tests/pack-cta` paid cases; add `tests/make-packs-free.test.ts` for the script's pure logic if it has any (else verify by running against local DB)

**Interfaces:**
- Consumes: `readCaptureEmail` (lib/capture/cookie), `canDownloadPack`/`canDownloadLayout` (KEEP these pure functions and their tests — they still gate "has captured email" semantics).
- Produces: `/api/checkout` accepts ONLY `{kind:'plugin', product}` (400 `invalid_request` otherwise) — the shipped plugin checkout must keep working unchanged.

- [ ] **Step 1: TDD the route changes** — update `tests/download-route.test.ts`: a layout that belongs only to paid packs now downloads with just a captured email (flip the old paid-only assertions); update checkout route tests: POST `{kind:'pack',packId}` → 400. Watch fail.
- [ ] **Step 2: Implement route + page + component changes** per Files. In `app/api/download/[layoutId]/route.ts` the new gate is exactly:

```ts
  const email = sessionEmail ?? capturedEmail;
  if (!email) {
    return NextResponse.json({ error: 'capture_required' }, { status: 403 });
  }
```

(preserving the existing rate-limit, download recording, and zip logic; keep the response shapes the FreeDownloadGate expects — read `components/FreeDownloadGate.tsx` first).
- [ ] **Step 3: `scripts/make-packs-free.ts`** (pattern-match `scripts/` conventions):

```ts
// Flip every pack to kind='free' (marketplace demotion — plugins are the paid product).
// Usage: npx tsx scripts/make-packs-free.ts        (uses env DATABASE_URL/POSTGRES_URL)
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { packs } from '@/db/schema';

async function main() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';
  console.error('flipping packs on DB host:', url ? new URL(url).host : '(unset)');
  const updated = await db.update(packs).set({ kind: 'free', priceCents: null }).where(eq(packs.kind, 'paid')).returning({ id: packs.id, slug: packs.slug });
  console.log(`made free: ${updated.length} packs`);
  for (const p of updated) console.log(' -', p.slug);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

Run it against the LOCAL db and show the output (prod run happens at deploy).
- [ ] **Step 4: Fix the fallout across the suite** (`npm run test`): pack detail page (`packs/[slug]`) paid-price JSON-LD path, `PackCta` tests, catalog cards that show prices (`components/` cards — grep `formatPriceCents` usages and neutralize price display for packs), `account/purchases` page copy (reframe: "Purchases" → keeps listing legacy orders but CTA copy → plugins). Never weaken plugin-checkout or license tests.
- [ ] **Step 5: Full suite + typecheck + lint; commit**

```bash
git add -A app components lib scripts tests
git commit -m "feat(store)!: marketplace demoted — all layouts/packs free with capture; checkout is plugin-only"
```

---

### Task 7: Copy sweep — keyword pages, llms.txt, account, packs hero, checkout pages

**Files:**
- Modify: `lib/seo/keyword-pages.ts` (all 21 pack/membership/all-access copy mentions — the explorer located them at ~L58, 67-70, 85, 114, 275, 279-281, 302, 326, 352, 366-368, 392-394; grep `pack|membership|all-access|paid` in the file for the authoritative list)
- Modify: `app/llms.txt/route.ts` (~lines 12, 16)
- Modify: `app/(account)/account/page.tsx` (~56-57, 66, 112-113), `app/(account)/account/purchases/page.tsx` (~32-43), `app/(account)/account/billing/page.tsx` (~24-40)
- Modify: `app/checkout/cancel/page.tsx` (~line 15 "Back to pricing" stays valid — just verify copy isn't pack-specific)
- Test: `tests/seo-keyword-pages.test.ts` must still pass (13 pages pinned); add copy assertions:

```ts
it('no keyword page sells packs or membership anymore', () => {
  for (const page of listKeywordPages()) {
    const text = JSON.stringify(page).toLowerCase();
    expect(text).not.toMatch(/all-access|membership/);
  }
});
```

(Place inside the existing describe; keep every existing assertion.)

- [ ] **Step 1: Add the failing copy test → run → FAIL.**
- [ ] **Step 2: Rewrite the copy.** Story for every keyword page: the catalog is 100% free (email signup), validated for Divi 5, import-ready; where copy previously upsold packs/membership, upsell the PLUGINS instead ("migrating from Elementor? Our converter moves your whole site — free on wordpress.org"). FAQs about pricing → answer "every layout is free"; keep each page's keyword targeting intact (don't shorten intros below what the tests/SEO need — check `tests/seo-keyword-pages.test.ts` for length constraints).
- [ ] **Step 3: llms.txt**: describe the site as "free validated Divi 5 layouts + WordPress migration plugins (Elementor↔Divi converters, AI editor)"; update the `/pricing` line to "Pro plugin licenses".
- [ ] **Step 4: Account pages**: purchases → keep order history table but header copy "Legacy purchases"; CTA → `/plugins` "Browse plugins"; billing → keep Stripe portal for plugin subscriptions (it IS used by license renewals — reframe copy to "Manage your plugin license billing"); account dashboard → replace all-access banner with license summary link to `/account/licenses`.
- [ ] **Step 5: Full suite + typecheck; commit**

```bash
git add lib/seo/keyword-pages.ts app/llms.txt "app/(account)" app/checkout tests/seo-keyword-pages.test.ts
git commit -m "feat(store): copy sweep — free-catalog + plugins story everywhere"
```

---

### Task 8: Migration-keyword guides

**Files:**
- Create: `content/guides/how-to-convert-elementor-to-divi-5.md`, `content/guides/how-to-convert-divi-to-elementor.md`, `content/guides/elementor-to-divi-migration-checklist.md`
- Modify: the 4 existing guides with stale pack/membership claims (`best-divi-5-layouts-for-agencies.md`, `best-divi-5-layouts-for-restaurants.md`, `how-to-import-a-divi-5-layout.md`, `free-vs-premium-divi-layouts.md`) — update ONLY the stale sentences (packs are paid / membership exists) to the free-catalog + plugins story; `free-vs-premium-divi-layouts.md` gets reframed as "free layouts vs Pro plugins"
- Modify: `tests/guides.test.ts` — add `/plugins` to the allowed internal-link prefixes (~L47-49); bump the guide-count floor to ≥11
- Test: `tests/guides.test.ts` (the system tests validate frontmatter/length/links automatically)

**Content requirements per new guide (the test enforces: description 80-165 chars, ≥700 words, ≥2 keywords, ≥6 internal links, kebab slug, valid date = today):**
1. **how-to-convert-elementor-to-divi-5** — keywords `convert elementor to divi`, `elementor to divi migration`; steps: export from Elementor (page JSON / kit ZIP), install the free converter from wp.org (link), upload in Tools → Elementor → Divi 5, review the conversion report, publish; when you need Pro (kits, headers/footers) → `/plugins/elementor-to-divi-5`; link `/browse`, `/guides/how-to-import-a-divi-5-layout`, `/plugins`, `/pricing`.
2. **how-to-convert-divi-to-elementor** — keywords `convert divi to elementor`, `divi to elementor`; honest status: plugin pending wp.org review, join the notify list (`/plugins/divi-to-elementor`); explain what it converts (35+ modules, batch, all Divi export formats) and the manual-alternative steps meanwhile; links as above.
3. **elementor-to-divi-migration-checklist** — keywords `elementor to divi checklist`, `divi 5 migration`; pre-flight inventory (pages, templates, global styles, forms), conversion order, QA checklist (responsive, links, forms), rollback plan; links to both converter pages + first guide.

- [ ] **Step 1: Update `tests/guides.test.ts`** (allowed prefixes + count) → run → FAIL (count).
- [ ] **Step 2: Write the three guides + retouch the four stale ones.** Author real, useful prose (700+ words each, concrete steps, no fluff); the plugin links use the exact URLs from Global Constraints.
- [ ] **Step 3: `npx vitest run tests/guides.test.ts` → PASS** (system tests validate everything); full suite; commit

```bash
git add content/guides tests/guides.test.ts
git commit -m "feat(seo): migration-keyword guides + stale marketplace claims updated"
```

---

### Task 9: Verification — full suite + visual pass + deploy prep

- [ ] **Step 1: Full gates** — `npm run test`, `npm run typecheck`, `npm run lint`: all green. Grep sweeps (show output): `grep -rn "all-access\|membership" app components lib/seo lib/nav content --include='*.tsx' --include='*.ts' --include='*.md' | grep -vi "test\|legacy\|stripe/"` → only intentional remnants (account legacy copy, fulfillment internals).
- [ ] **Step 2: Visual pass** — run the dev server on a spare port; Playwright-screenshot `/`, `/plugins`, `/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor`, `/pricing`, `/browse`, a layout detail page, a pack page (desktop 1280 + mobile 390). Eyeball each (per the visual-review house rule): no broken layouts, no lingering quote/services copy, free downloads gate correctly. Fix what's broken.
- [ ] **Step 3: Functional spot-checks against the dev server** (curl/Playwright, show output): waitlist POST records a lead with the right source (check DB); `/api/checkout` `{kind:'pack'}` → 400; `{kind:'plugin'}` → session URL; a previously-paid layout downloads with a captured-email cookie.
- [ ] **Step 4: Deploy checklist for the controller (NOT executed by this task):** merge → run `scripts/make-packs-free.ts` against PROD → push main → verify live pages → archive the legacy pack/membership Stripe products in the dashboard (optional tidiness).

---

## Out of scope

- Divi→Elementor Pro split + its buy flow (Phase 4 — flips the D2E page from notify to buy).
- AI Editor product build.
- Deleting legacy fulfillment/checkout code paths, `orders`/`subscriptions` tables, or admin surfaces.
- OG-image generation, further SEO articles beyond the three guides.
