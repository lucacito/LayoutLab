# Services Nav + Homepage (A0 + A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-spine the site's front door from a layout store to a services funnel — a simplified funnel navigation and a services sales homepage aimed at trades (HVAC / roofing / plumbing) business owners.

**Architecture:** The top navigation drops the taxonomy mega-menu in favour of three plain funnel links (Work with us / Examples / Free Divi layouts) plus a "Get a free quote" CTA; taxonomy SEO links stay preserved in the footer. The homepage is recomposed from small, prop-driven presentational components (hero, offer tiers, steps, free-layout capture band) plus the existing `FeaturedPacks` proof band, replacing the catalog-showcase homepage.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Tailwind (custom `text-h*` utilities in `app/globals.css`), Vitest + @testing-library/react (jsdom for `.test.tsx`), existing `/api/lead` lead-capture endpoint.

## Global Constraints

- **Brand:** `Divi5Lab` / `divi5lab.com` (copy uses this literal brand string).
- **Positioning:** the site is a **services funnel**, not a store — nav and homepage sell "a great Divi site delivered fast," not layout browsing. Layouts are the free lead magnet.
- **Primary CTA everywhere:** **"Get a free quote"** → `/contact` (the existing lead form). The dedicated `/work-with-us` page is a later task (A2); until it exists, `/contact` is the quote destination.
- **Nav funnel targets:** Work with us → `/contact`; Examples → `/browse`; Free Divi layouts → `/free-divi-layouts` (canonical free hub; `/free` redirects there).
- **No secrets in client bundle.** Client components only call public routes (`/api/lead`).
- **TDD:** write the failing test first for every new component; `.test.tsx` files run under jsdom automatically (see `vitest.config.ts`).
- **Test commands:** single file `npx vitest run tests/<file> -v`; full suite `npm run test`; types `npm run typecheck`; build `npm run build`.
- **Design tokens (verified):** colors `ink paper navy muted action mist fog border`; radii `rounded-card` (16px) `rounded-button` (4px); shadow `shadow-soft`; text `text-h1 text-h2 text-h3 text-lead text-body text-small`. Icons are Material Icons **outlined ligature names** via `<Icon name="..." size={..} />`.

---

### Task 1: Funnel navigation (desktop) + Header CTA

Replace the taxonomy mega-menu with three funnel links and flip the header CTA from "Browse layouts" to "Get a free quote". Taxonomy SEO links remain in the footer (already present — no change needed there).

**Files:**
- Modify: `lib/nav/menu-data.ts` (add `PRIMARY_NAV`)
- Create: `components/site/PrimaryNav.tsx`
- Modify: `components/site/Header.tsx`
- Delete: `components/site/MegaMenu.tsx`
- Test: `tests/primary-nav.test.tsx`

**Interfaces:**
- Consumes: `NavLinkMenu` type (already exported from `lib/nav/menu-data.ts`).
- Produces:
  - `PRIMARY_NAV: NavLinkMenu[]` — funnel links, consumed by `PrimaryNav` (Task 1) and `MobileNav` (Task 2).
  - `PrimaryNav()` — desktop nav React component (no props).

- [ ] **Step 1: Write the failing test**

Create `tests/primary-nav.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrimaryNav } from '@/components/site/PrimaryNav';

describe('PrimaryNav', () => {
  it('renders the three funnel links with correct hrefs and no taxonomy mega-menu', () => {
    const { getByText } = render(<PrimaryNav />);
    const work = getByText('Work with us').closest('a');
    const examples = getByText('Examples').closest('a');
    const free = getByText('Free Divi layouts').closest('a');
    expect(work?.getAttribute('href')).toBe('/contact');
    expect(examples?.getAttribute('href')).toBe('/browse');
    expect(free?.getAttribute('href')).toBe('/free-divi-layouts');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/primary-nav.test.tsx -v`
Expected: FAIL — cannot resolve `@/components/site/PrimaryNav`.

- [ ] **Step 3: Add `PRIMARY_NAV` to nav data**

In `lib/nav/menu-data.ts`, append after the existing `NAV_MENUS` export (end of file):

```ts
// Funnel navigation (services-first). Replaces the taxonomy mega-menu as the
// site's front door; the taxonomy stays reachable via the footer + catalog pages.
export const PRIMARY_NAV: NavLinkMenu[] = [
  { key: 'work', label: 'Work with us', href: '/contact' },
  { key: 'examples', label: 'Examples', href: '/browse' },
  { key: 'free', label: 'Free Divi layouts', href: '/free-divi-layouts' },
];
```

- [ ] **Step 4: Create the `PrimaryNav` component**

Create `components/site/PrimaryNav.tsx`:

```tsx
import Link from 'next/link';
import { PRIMARY_NAV } from '@/lib/nav/menu-data';

// Desktop funnel navigation — plain links, no dropdowns. The taxonomy mega-menu
// was intentionally removed; taxonomy SEO links live in the footer.
export function PrimaryNav() {
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {PRIMARY_NAV.map((m) => (
        <Link
          key={m.key}
          href={m.href}
          className="rounded-full px-3 py-1.5 text-small font-medium text-navy transition hover:text-action"
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/primary-nav.test.tsx -v`
Expected: PASS.

- [ ] **Step 6: Wire `PrimaryNav` into the Header and flip the CTA**

Replace the entire contents of `components/site/Header.tsx` with:

```tsx
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { PrimaryNav } from './PrimaryNav';
import { MobileNav } from './MobileNav';
import { AccountNav } from './AccountNav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Wordmark />
        {/* Centered funnel navigation */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          <PrimaryNav />
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <AccountNav />
          <Button href="/contact">Get a free quote</Button>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
```

- [ ] **Step 7: Delete the obsolete mega-menu**

Run: `git rm components/site/MegaMenu.tsx`
Then confirm nothing else imports it:
Run: `grep -rn "MegaMenu" app components tests`
Expected: no output.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/nav/menu-data.ts components/site/PrimaryNav.tsx components/site/Header.tsx tests/primary-nav.test.tsx
git rm components/site/MegaMenu.tsx
git commit -m "feat(nav): replace taxonomy mega-menu with services funnel nav + quote CTA"
```

---

### Task 2: Funnel navigation (mobile)

Simplify the mobile menu to the same funnel links + quote CTA, dropping the taxonomy accordion. Keep the existing account/admin links (they use `useSession`).

**Files:**
- Modify: `components/site/MobileNav.tsx`
- Test: `tests/mobile-nav.test.tsx`

**Interfaces:**
- Consumes: `PRIMARY_NAV` (Task 1), `useSession` from `next-auth/react`, `Icon`, `Button`.
- Produces: `MobileNav()` — unchanged export name/signature (no props).

- [ ] **Step 1: Write the failing test**

Create `tests/mobile-nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const useSession = vi.fn();
vi.mock('next-auth/react', () => ({ useSession: () => useSession() }));

import { MobileNav } from '@/components/site/MobileNav';

describe('MobileNav', () => {
  it('opens to show the funnel links and the quote CTA', () => {
    useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { getByLabelText, getByText } = render(<MobileNav />);
    fireEvent.click(getByLabelText('Toggle menu'));
    expect(getByText('Work with us').closest('a')?.getAttribute('href')).toBe('/contact');
    expect(getByText('Examples').closest('a')?.getAttribute('href')).toBe('/browse');
    expect(getByText('Free Divi layouts').closest('a')?.getAttribute('href')).toBe('/free-divi-layouts');
    expect(getByText('Get a free quote')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mobile-nav.test.tsx -v`
Expected: FAIL — current `MobileNav` renders "Browse all" / taxonomy accordion / "Browse layouts", not the funnel links.

- [ ] **Step 3: Rewrite `MobileNav`**

Replace the entire contents of `components/site/MobileNav.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PRIMARY_NAV } from '@/lib/nav/menu-data';

const ICONS: Record<string, string> = { work: 'handshake', examples: 'grid_view', free: 'download' };

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user as { role?: string } | undefined;
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="rounded-button p-2 text-navy">
        <Icon name={open ? 'close' : 'menu'} size={26} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full max-h-[80vh] overflow-y-auto border-b border-border bg-paper px-4 py-4">
          {PRIMARY_NAV.map((m) => (
            <Link key={m.key} href={m.href} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy first:border-t-0">
              <Icon name={ICONS[m.key] ?? 'chevron_right'} size={20} className="text-muted" /> {m.label}
            </Link>
          ))}

          {user?.role === 'admin' && (
            <Link href="/admin" onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-action">
              <Icon name="shield_person" size={20} className="text-action" /> Admin
            </Link>
          )}
          <Link href={user ? '/account' : '/login'} onClick={close} className="flex items-center gap-2 border-t border-fog px-2 py-3 text-body font-medium text-navy">
            <Icon name={user ? 'account_circle' : 'login'} size={20} className="text-muted" /> {user ? 'Account' : 'Sign in'}
          </Link>
          <div className="mt-3">
            <Button href="/contact" className="w-full" onClick={close}>Get a free quote</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/mobile-nav.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/site/MobileNav.tsx tests/mobile-nav.test.tsx
git commit -m "feat(nav): simplify mobile menu to funnel links + quote CTA"
```

---

### Task 3: `ServicesHero` — homepage hero

The services sales-page hero: outcome headline, subhead, primary + secondary CTA, trust bar.

**Files:**
- Create: `components/services/ServicesHero.tsx`
- Test: `tests/services-hero.test.tsx`

**Interfaces:**
- Produces: `ServicesHero()` — no props. Consumed by the homepage (Task 7).

- [ ] **Step 1: Write the failing test**

Create `tests/services-hero.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesHero } from '@/components/services/ServicesHero';

describe('ServicesHero', () => {
  it('renders the outcome headline and both CTAs', () => {
    const { getByRole, getByText } = render(<ServicesHero />);
    expect(getByRole('heading', { level: 1 }).textContent).toMatch(/more calls/i);
    expect(getByText('Get a free quote').closest('a')?.getAttribute('href')).toBe('/contact');
    expect(getByText('See examples').closest('a')?.getAttribute('href')).toBe('/browse');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services-hero.test.tsx -v`
Expected: FAIL — cannot resolve `@/components/services/ServicesHero`.

- [ ] **Step 3: Create the component**

Create `components/services/ServicesHero.tsx`:

```tsx
import { Icon } from '@/components/ui/Icon';

const TRUST = ['Built on Divi 5', 'Live in about a week', 'Conversion-first', 'You own everything'];

export function ServicesHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(60% 90% at 30% 0%, rgba(99,91,255,0.55), transparent), radial-gradient(55% 80% at 85% 30%, rgba(0,153,255,0.45), transparent), #07070B',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/80" />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-small font-semibold text-paper backdrop-blur">
          <Icon name="bolt" size={16} className="text-action" /> Divi 5 websites for trades
        </span>
        <h1 className="mt-5 text-h1 text-paper">Websites that get HVAC, roofing &amp; plumbing companies more calls.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lead text-paper/85">
          We design and build fast, mobile-first Divi 5 sites engineered around one thing: turning visitors into phone calls and
          quote requests. Built in days, not months.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="/contact" className="inline-flex h-12 items-center justify-center rounded-full bg-action px-7 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </a>
          <a href="/browse" className="inline-flex h-12 items-center justify-center rounded-full border border-paper/25 bg-paper/5 px-7 text-body font-semibold text-paper backdrop-blur transition hover:bg-paper/15">
            See examples
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {TRUST.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-small text-paper/75">
              <Icon name="check_circle" size={16} className="text-action" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/services-hero.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/services/ServicesHero.tsx tests/services-hero.test.tsx
git commit -m "feat(home): add ServicesHero"
```

---

### Task 4: `ServicesOffer` — productized offer tiers

Three productized tiers with starting prices and a quote CTA.

**Files:**
- Create: `components/services/ServicesOffer.tsx`
- Test: `tests/services-offer.test.tsx`

**Interfaces:**
- Consumes: `Container`, `SectionTitle`, `Icon`.
- Produces: `ServicesOffer()` — no props. Consumed by the homepage (Task 7).

- [ ] **Step 1: Write the failing test**

Create `tests/services-offer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesOffer } from '@/components/services/ServicesOffer';

describe('ServicesOffer', () => {
  it('renders three tiers with prices and a quote CTA', () => {
    const { getByText, getAllByText } = render(<ServicesOffer />);
    expect(getByText('Landing Page')).toBeTruthy();
    expect(getByText('Full Website')).toBeTruthy();
    expect(getByText('Site Refresh')).toBeTruthy();
    expect(getAllByText(/^from \$/).length).toBe(3);
    expect(getByText('Get a free quote').closest('a')?.getAttribute('href')).toBe('/contact');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services-offer.test.tsx -v`
Expected: FAIL — cannot resolve `@/components/services/ServicesOffer`.

- [ ] **Step 3: Create the component**

Create `components/services/ServicesOffer.tsx`:

```tsx
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

// Starting prices — adjust freely; every project still gets a fixed quote up front.
const TIERS: { name: string; price: string; icon: string; blurb: string; points: string[]; featured?: boolean }[] = [
  {
    name: 'Landing Page',
    price: 'from $299',
    icon: 'ads_click',
    blurb: 'A single high-converting page — hero, services, trust and a quote form built to make the phone ring.',
    points: ['Mobile-first design', 'Click-to-call button', 'Quote / estimate form', '~3-day delivery'],
  },
  {
    name: 'Full Website',
    price: 'from $899',
    icon: 'web',
    blurb: 'A complete multi-page site: home, services, service areas, about, reviews and contact — all conversion-tuned.',
    points: ['5–7 pages', 'Per-service pages', 'Local-SEO ready', 'Live in about a week'],
    featured: true,
  },
  {
    name: 'Site Refresh',
    price: 'from $199',
    icon: 'auto_fix_high',
    blurb: 'Keep your content, lose the dated look. We rebuild your existing site in modern Divi 5.',
    points: ['Modern redesign', 'Faster load', 'Mobile fixes', 'Quick turnaround'],
  },
];

export function ServicesOffer() {
  return (
    <section className="py-16">
      <Container>
        <SectionTitle eyebrow="What we build" title="A site built to bring in work — not just look nice">
          Most trades sites are online brochures. We build the version that turns visitors into booked jobs.
        </SectionTitle>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`flex flex-col rounded-card border p-7 ${t.featured ? 'border-action bg-mist shadow-soft' : 'border-border bg-paper'}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-button bg-action/10 text-action">
                <Icon name={t.icon} size={22} />
              </span>
              <h3 className="mt-4 text-h3 text-navy">{t.name}</h3>
              <p className="mt-1 text-lead font-semibold text-action">{t.price}</p>
              <p className="mt-3 text-body text-muted">{t.blurb}</p>
              <ul className="mt-5 space-y-2">
                {t.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-small text-navy">
                    <Icon name="check_circle" size={16} className="text-action" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-small text-muted">Prices are starting points — every project gets a fixed quote up front.</p>
          <a href="/contact" className="inline-flex h-12 items-center justify-center rounded-full bg-action px-7 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </a>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/services-offer.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/services/ServicesOffer.tsx tests/services-offer.test.tsx
git commit -m "feat(home): add ServicesOffer tiers"
```

---

### Task 5: `ServicesSteps` — how it works

Four-step "how it works" band; the pipeline is the "fast".

**Files:**
- Create: `components/services/ServicesSteps.tsx`
- Test: `tests/services-steps.test.tsx`

**Interfaces:**
- Consumes: `Container`, `SectionTitle`, `Icon`.
- Produces: `ServicesSteps()` — no props. Consumed by the homepage (Task 7).

- [ ] **Step 1: Write the failing test**

Create `tests/services-steps.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesSteps } from '@/components/services/ServicesSteps';

describe('ServicesSteps', () => {
  it('renders all four steps', () => {
    const { getByText } = render(<ServicesSteps />);
    expect(getByText('Tell us about your business')).toBeTruthy();
    expect(getByText('We design a mockup')).toBeTruthy();
    expect(getByText('We build it in Divi 5')).toBeTruthy();
    expect(getByText('Launch & get calls')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services-steps.test.tsx -v`
Expected: FAIL — cannot resolve `@/components/services/ServicesSteps`.

- [ ] **Step 3: Create the component**

Create `components/services/ServicesSteps.tsx`:

```tsx
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: 'chat', title: 'Tell us about your business', body: 'Share your trade, service area, and what you want the site to do.' },
  { icon: 'draw', title: 'We design a mockup', body: 'You see a real preview built for your business — fast, thanks to our layout pipeline.' },
  { icon: 'build', title: 'We build it in Divi 5', body: 'Validated, import-ready, and fully yours — no lock-in.' },
  { icon: 'call', title: 'Launch & get calls', body: 'We help you go live, wired for click-to-call and quote requests.' },
];

export function ServicesSteps() {
  return (
    <section className="border-y border-border bg-mist py-16">
      <Container>
        <SectionTitle eyebrow="How it works" title="From first call to live site in about a week">
          A simple, fast process — no agency runaround.
        </SectionTitle>
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col rounded-card border border-border bg-paper p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-small font-bold text-paper">{i + 1}</span>
                <Icon name={s.icon} size={22} className="text-action" />
              </div>
              <h3 className="mt-4 text-body font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-small text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/services-steps.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/services/ServicesSteps.tsx tests/services-steps.test.tsx
git commit -m "feat(home): add ServicesSteps"
```

---

### Task 6: `ServicesFreeBand` — free-layout email capture

The lead-magnet band for DIY Divi builders: email capture (reusing `/api/lead`) + a link to the free library. Client component.

**Files:**
- Create: `components/services/ServicesFreeBand.tsx`
- Test: `tests/services-free-band.test.tsx`

**Interfaces:**
- Consumes: `Icon`; `POST /api/lead` with body `{ email: string, source: 'homepage_free_band' }` (existing route).
- Produces: `ServicesFreeBand()` — no props. Consumed by the homepage (Task 7).

- [ ] **Step 1: Write the failing test**

Create `tests/services-free-band.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ServicesFreeBand } from '@/components/services/ServicesFreeBand';

describe('ServicesFreeBand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the heading, email input and free-library link', () => {
    const { getByText, getByPlaceholderText } = render(<ServicesFreeBand />);
    expect(getByText(/free Divi 5 layouts/i)).toBeTruthy();
    expect(getByPlaceholderText('you@email.com')).toBeTruthy();
    expect(getByText('Browse the free library').closest('a')?.getAttribute('href')).toBe('/free-divi-layouts');
  });

  it('posts the email to /api/lead and shows a confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { getByPlaceholderText, getByText, findByText } = render(<ServicesFreeBand />);
    fireEvent.change(getByPlaceholderText('you@email.com'), { target: { value: 'diy@example.com' } });
    fireEvent.click(getByText('Send me layouts'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/lead');
    expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({ email: 'diy@example.com', source: 'homepage_free_band' });
    expect(await findByText(/Check your inbox/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services-free-band.test.tsx -v`
Expected: FAIL — cannot resolve `@/components/services/ServicesFreeBand`.

- [ ] **Step 3: Create the component**

Create `components/services/ServicesFreeBand.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

// Lead-magnet band: DIY Divi builders swap an email for the free layout library.
// Reuses the general lead endpoint (→ email_captures + Loops).
export function ServicesFreeBand() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source: 'homepage_free_band' }),
      });
      setStatus(res.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-card border border-border bg-mist p-8 md:p-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-action/10 px-3 py-1 text-small font-semibold text-action">
            <Icon name="download" size={16} /> Free for Divi builders
          </span>
          <h2 className="mt-4 text-h3 text-navy">Building it yourself? Grab free Divi 5 layouts.</h2>
          <p className="mt-3 max-w-xl text-body text-muted">
            Hundreds of validated, import-ready sections — free. Drop your email and we&apos;ll send new ones as they land.
          </p>

          {status === 'done' ? (
            <p className="mt-6 flex items-center gap-2 text-body font-semibold text-navy">
              <Icon name="mark_email_read" size={20} className="text-action" /> Check your inbox — you&apos;re on the list!
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Your email"
                className="min-w-0 flex-1 rounded-full border border-border bg-paper px-4 py-3 text-body text-navy outline-none"
              />
              <button type="submit" className="shrink-0 rounded-full bg-action px-6 py-3 text-small font-semibold text-paper transition hover:brightness-110">
                Send me layouts
              </button>
            </form>
          )}
          {status === 'error' && <p className="mt-2 text-small text-red-600">Something went wrong — try again.</p>}

          <a href="/free-divi-layouts" className="mt-5 inline-flex items-center gap-1 text-small font-semibold text-action hover:underline">
            Browse the free library <Icon name="arrow_forward" size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/services-free-band.test.tsx -v`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add components/services/ServicesFreeBand.tsx tests/services-free-band.test.tsx
git commit -m "feat(home): add ServicesFreeBand lead-magnet capture"
```

---

### Task 7: Recompose the homepage as a services sales page

Replace the catalog-showcase homepage with the services funnel: hero → offer → steps → proof (existing `FeaturedPacks`, if any paid packs) → free-layout band → closing quote CTA. Drops the heavy catalog data-crunching; keeps only the paid-packs fetch for the proof band.

**Files:**
- Modify: `app/(marketing)/page.tsx` (full replace)
- Reuse (no change): `components/marketing/FeaturedPacks.tsx`, `components/ui/Container.tsx`, `lib/catalog/queries.ts` (`listPacks`)

**Interfaces:**
- Consumes: `ServicesHero` (T3), `ServicesOffer` (T4), `ServicesSteps` (T5), `ServicesFreeBand` (T6), `FeaturedPacks({ packs })` (existing), `listPacks()` (existing, returns rows with `.kind` and `.createdAt: Date`).
- Produces: the `/` route (default export `HomePage`).

- [ ] **Step 1: Replace the homepage**

Replace the entire contents of `app/(marketing)/page.tsx` with:

```tsx
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { FeaturedPacks } from '@/components/marketing/FeaturedPacks';
import { ServicesHero } from '@/components/services/ServicesHero';
import { ServicesOffer } from '@/components/services/ServicesOffer';
import { ServicesSteps } from '@/components/services/ServicesSteps';
import { ServicesFreeBand } from '@/components/services/ServicesFreeBand';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // Paid multi-page theme packs double as proof of build quality on the services
  // homepage (newest first). Failure is non-fatal — the band just hides.
  let paidPacks: Awaited<ReturnType<typeof listPacks>> = [];
  try {
    paidPacks = (await listPacks())
      .filter((p) => p.kind === 'paid')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    paidPacks = [];
  }

  return (
    <main>
      <ServicesHero />
      <ServicesOffer />
      <ServicesSteps />
      {paidPacks.length > 0 && <FeaturedPacks packs={paidPacks} />}
      <ServicesFreeBand />

      {/* Closing quote CTA */}
      <section className="border-t border-border bg-ink py-20 text-paper">
        <Container className="text-center">
          <h2 className="mx-auto max-w-2xl text-h2 text-paper">Ready for a site that brings in work?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-paper/85">
            Tell us about your business and we&apos;ll send a free quote and a preview built for you.
          </p>
          <a href="/contact" className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </a>
        </Container>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `FeaturedPacks`'s `packs` prop type complains, it consumes exactly `listPacks()` filtered output — the pre-pivot homepage passed the same shape, so it matches.)

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — including the six new tests. No existing test imports the old homepage sections directly; if one references removed homepage copy, update that test to the new copy (search: `grep -rn "Free Divi 5 sections" tests`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds; `/` compiles.

- [ ] **Step 5: Visual verification (evidence before done)**

Run: `npm run dev`, open `http://localhost:3000/`. Confirm: services hero with "Get a free quote" + "See examples"; three offer tiers with prices; four steps; free-layout email band; closing quote CTA. Confirm the header shows Work with us / Examples / Free Divi layouts + the quote button, and the mobile menu (narrow the window) shows the same. Note anything visually off for follow-up.

- [ ] **Step 6: Commit**

```bash
git add app/(marketing)/page.tsx
git commit -m "feat(home): recompose homepage as trades services sales page"
```

---

## Self-Review

**Spec coverage (A0 + A1 slice of §7):**
- A0 new IA/nav — Tasks 1 (desktop) + 2 (mobile): funnel links + "Get a free quote" CTA; taxonomy demoted (mega-menu removed, footer SEO links preserved). ✓
- A1 homepage — hero (T3), offer tiers (T4), how-it-works (T5), free lead-magnet band (T6), proof via `FeaturedPacks` + closing CTA (T7). ✓
- Out of this plan (own later cycles): A2 `/work-with-us` page, A3 portfolio/Examples system, A4 catalog re-frame, A5 exit-intent/scroll popup, and all of Workstream B. The nav's "Work with us"/"Examples" point at `/contact`/`/browse` until A2/A3 repoint them — called out in Global Constraints.

**Placeholder scan:** No TBD/TODO. Prices are concrete constants with an inline "adjust freely" comment (Lucas to confirm final numbers — flagged, not a blank).

**Type consistency:** `PRIMARY_NAV: NavLinkMenu[]` defined in Task 1, consumed in Tasks 1 & 2. All new components are zero-prop `() => JSX`. `FeaturedPacks({ packs })` is fed the same `listPacks()`-filtered shape the previous homepage used. Lead POST body `{ email, source }` matches the existing `/api/lead` zod schema.

**Ambiguity check:** Nav targets, CTA destination, and lead `source` string are all pinned to exact values in Global Constraints and the task steps.
