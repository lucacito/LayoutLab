# Phase 6b — Launch Polish & Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing `/license` and `/about` pages (currently 404 from the Header/Footer/sitemap) and polish `/pricing` with free packs + an FAQ.

**Architecture:** Two new static marketing pages + a pricing-page enhancement, all reusing the existing brand primitives. The license page renders the committed commercial license (`readLicense()`) plus a reusable `REFUND_POLICY`; the FAQ adds a `FAQPage` JSON-LD.

**Tech Stack:** Next.js 15 RSC, the existing `lib/seo/jsonld` + `components/ui/*`, Vitest + RTL.

## Global Constraints

- **Fix the broken links:** `/license` and `/about` are linked from `components/site/Header.tsx`, `Footer.tsx`, and listed in `lib/seo/sitemap.ts` — both routes MUST exist after this phase (build + a link-resolves check).
- **Reuse primitives:** `Container`, `Card`, `SectionTitle`, `Button`, `IconFeature` from `components/ui`; `<JsonLd>`; `BuyButton`; `readLicense()` (`@/lib/license`); `listPacks` (`@/lib/catalog/queries`). No new design system.
- **Do not invent membership dollar amounts** (Stripe Price IDs unset) — keep the subscribe CTAs.
- **Brand tokens only** (text-navy/text-muted/bg-action/etc.), responsive, accessible.
- Commit after each task; messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `/license` page + refund policy

**Files:**
- Create: `lib/legal/refund.ts`, `app/(marketing)/license/page.tsx`
- Test: `tests/license-page.test.tsx`

**Interfaces:**
- Consumes: `readLicense()` (`@/lib/license`), `Container`/`Card`.
- Produces: `REFUND_POLICY: string`; the `/license` route.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/license-page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/license', () => ({ readLicense: () => 'COMMERCIAL LICENSE AGREEMENT\n\nUse it on unlimited sites you own.' }));

import LicensePage from '@/app/(marketing)/license/page';
import { REFUND_POLICY } from '@/lib/legal/refund';

describe('REFUND_POLICY', () => {
  it('is a non-empty digital-goods statement', () => {
    expect(REFUND_POLICY.length).toBeGreaterThan(20);
    expect(REFUND_POLICY.toLowerCase()).toContain('digital');
  });
});

describe('LicensePage', () => {
  it('renders the license text and a refunds section', () => {
    const { getByText, getByRole } = render(<LicensePage />);
    expect(getByText(/COMMERCIAL LICENSE AGREEMENT/)).toBeTruthy();
    expect(getByRole('heading', { name: /refund/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/license-page.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the refund policy**

```ts
// lib/legal/refund.ts
export const REFUND_POLICY = `Because Divi5Lab products are digital goods delivered instantly and downloaded as files, all sales are final and we do not offer refunds once a layout or pack has been downloaded. If a file is broken, fails to import, or you were charged in error, contact info@divi5lab.com within 14 days of purchase and we'll make it right — typically with a fix or a replacement. Membership can be cancelled anytime from your billing portal; cancellation stops future renewals and keeps access until the end of the current period.`;
```

- [ ] **Step 4: Implement the page**

```tsx
// app/(marketing)/license/page.tsx
import type { Metadata } from 'next';
import { readLicense } from '@/lib/license';
import { REFUND_POLICY } from '@/lib/legal/refund';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'License & Refunds — Divi5Lab',
  description: 'The commercial license that comes with every Divi5Lab purchase, plus our digital-goods refund policy.',
};

export default function LicensePage() {
  const license = readLicense();
  return (
    <main className="py-16">
      <Container className="max-w-3xl">
        <h1 className="text-h2 text-navy">License</h1>
        <p className="mt-3 text-body text-muted">
          Every purchase includes the commercial license below. It is also bundled inside every download.
        </p>
        <Card className="mt-8 p-6">
          <pre className="whitespace-pre-wrap font-sans text-small leading-relaxed text-navy">{license}</pre>
        </Card>

        <h2 className="mt-12 text-section text-navy">Refunds</h2>
        <p className="mt-3 text-body text-muted">{REFUND_POLICY}</p>
      </Container>
    </main>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- tests/license-page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add lib/legal/refund.ts "app/(marketing)/license" tests/license-page.test.tsx
git commit -m "feat: /license page (commercial license + digital-goods refund policy)"
```
(append the trailer)

> If `Container` does not accept a `className` prop, wrap children in a `<div className="mx-auto max-w-3xl">` instead — match the real signature used by other pages.

---

### Task 2: `/about` page

**Files:**
- Create: `app/(marketing)/about/page.tsx`
- Test: `tests/about-page.test.tsx`

**Interfaces:**
- Consumes: `Container`/`SectionTitle`/`IconFeature`/`Button`.
- Produces: the `/about` route.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/about-page.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AboutPage from '@/app/(marketing)/about/page';

describe('AboutPage', () => {
  it('renders the brand and a value proposition', () => {
    const { getAllByText, getByRole } = render(<AboutPage />);
    expect(getAllByText(/Divi5Lab/i).length).toBeGreaterThan(0);
    expect(getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- tests/about-page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// app/(marketing)/about/page.tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { IconFeature } from '@/components/ui/IconFeature';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'About — Divi5Lab',
  description: 'Divi5Lab is a marketplace of validated, import-ready Divi 5 layouts for WordPress builders.',
};

const POINTS = [
  { title: 'Built for Divi 5', body: 'Every layout is real, validated Divi 5 JSON — import it and keep building, no cleanup.' },
  { title: 'Quality-gated', body: 'A deterministic validator checks every layout before it reaches the catalog.' },
  { title: 'Yours to use', body: 'One simple commercial license: use what you buy on unlimited sites you own or build for clients.' },
];

export default function AboutPage() {
  return (
    <main className="py-16">
      <Container>
        <h1 className="text-h1 text-navy">About Divi5Lab</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted">
          Divi5Lab helps WordPress builders move faster with a growing library of validated, import-ready
          Divi 5 layouts — heroes, pricing, landing pages and more — that drop straight into the builder.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {POINTS.map((p) => (
            <IconFeature key={p.title} title={p.title}>{p.body}</IconFeature>
          ))}
        </div>

        <div className="mt-12">
          <Button href="/browse">Browse the catalog</Button>
        </div>
      </Container>
    </main>
  );
}
```

> Verify `IconFeature`'s prop API (it's used on the home page) — if it takes `body` as a prop rather than children, match that usage. Same for `Button` (href vs onClick).

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- tests/about-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

```bash
git add "app/(marketing)/about" tests/about-page.test.tsx
git commit -m "feat: /about page"
```
(append the trailer)

---

### Task 3: Pricing polish — free packs + FAQ

**Files:**
- Modify: `app/(catalog)/pricing/page.tsx`, `lib/seo/jsonld.ts`
- Test: `tests/faq-jsonld.test.ts`, `tests/pricing-page.test.tsx`

**Interfaces:**
- Consumes: `listPacks`, `Card`/`Container`/`SectionTitle`/`Button`/`BuyButton`, `<JsonLd>`.
- Produces: `faqJsonLd(items: { question: string; answer: string }[])` in `lib/seo/jsonld.ts`; the polished `/pricing`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/faq-jsonld.test.ts
import { describe, it, expect } from 'vitest';
import { faqJsonLd } from '@/lib/seo/jsonld';

describe('faqJsonLd', () => {
  it('builds a FAQPage with each question + answer', () => {
    const ld = faqJsonLd([{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }]) as any;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]['@type']).toBe('Question');
    expect(ld.mainEntity[0].name).toBe('Q1?');
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('A1');
  });
});
```

```tsx
// tests/pricing-page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/catalog/queries', () => ({
  listPacks: vi.fn(async () => [
    { id: 'f1', slug: 'free-heroes', title: 'Free Heroes', kind: 'free', priceCents: null, description: 'Lead magnet' },
    { id: 'p1', slug: 'pro-landers', title: 'Pro Landers', kind: 'paid', priceCents: 4900, description: 'Paid' },
  ]),
}));
vi.mock('@/components/BuyButton', () => ({ BuyButton: () => null }));

import PricingPage from '@/app/(catalog)/pricing/page';

describe('PricingPage', () => {
  it('shows free packs linking to their pack page, and an FAQ', async () => {
    const ui = await PricingPage();
    const { container, getByText } = render(ui);
    expect(getByText('Free Heroes')).toBeTruthy();
    expect(container.querySelector('a[href="/packs/free-heroes"]')).not.toBeNull();
    // FAQ present
    expect(getByText(/frequently asked|FAQ/i)).toBeTruthy();
    const ld = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('"FAQPage"'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test -- tests/faq-jsonld.test.ts tests/pricing-page.test.tsx`
Expected: FAIL — `faqJsonLd` missing / free packs + FAQ not rendered.

- [ ] **Step 3: Add `faqJsonLd` to `lib/seo/jsonld.ts`**

```ts
export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}
```

- [ ] **Step 4: Polish the pricing page**

Rewrite `app/(catalog)/pricing/page.tsx` to keep the membership + paid sections and ADD a free-packs block + an FAQ block (with JSON-LD). Full file:

```tsx
// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { listPacks } from '@/lib/catalog/queries';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BuyButton } from '@/components/BuyButton';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pricing — Divi5Lab', description: 'Free packs, one-time packs, or all-access membership for every Divi 5 layout.' };

const FAQ = [
  { question: 'What do I actually download?', answer: 'A Divi 5 layout as a JSON file, plus the commercial license. Import the JSON straight into the Divi builder.' },
  { question: 'What license do I get?', answer: 'One simple commercial license: use your purchases on unlimited sites you own or build for clients. Reselling or redistributing the files is not allowed.' },
  { question: 'Do you offer refunds?', answer: 'Layouts are digital goods delivered instantly, so sales are final once downloaded — but if a file is broken or you were charged in error, email info@divi5lab.com within 14 days and we will make it right. See the License & Refunds page.' },
  { question: 'How does the all-access membership work?', answer: 'While your membership is active you can download every layout in the library. Cancel anytime from your billing portal; access continues until the end of the period.' },
];

export default async function PricingPage() {
  let packs: Awaited<ReturnType<typeof listPacks>> = [];
  try { packs = await listPacks(); } catch { packs = []; }
  const freePacks = packs.filter((p) => p.kind === 'free');
  const paidPacks = packs.filter((p) => p.kind === 'paid');

  return (
    <main className="py-16">
      <Container>
        <SectionTitle eyebrow="Pricing" title="Start free, buy a pack, or unlock everything">Free lead-magnet packs, one-time purchases, or all-access membership.</SectionTitle>

        <div className="mx-auto mt-12 max-w-md">
          <Card className="p-8 text-center">
            <h3 className="text-section text-navy">All-access membership</h3>
            <p className="mt-2 text-body text-muted">Every layout in the library, while your membership is active.</p>
            <div className="mt-6 flex flex-col gap-3">
              <BuyButton kind="membership" plan="monthly" label="Subscribe monthly" />
              <BuyButton kind="membership" plan="yearly" label="Subscribe yearly" />
            </div>
          </Card>
        </div>

        {freePacks.length > 0 && (
          <section className="mt-16">
            <h2 className="text-section text-navy">Free packs</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {freePacks.map((p) => (
                <Card key={p.id} className="flex flex-col p-6">
                  <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                  {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                  <div className="mt-4 text-h3 text-action">Free</div>
                  <Link href={`/packs/${p.slug}`} className="mt-4 inline-flex h-10 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110">Get it free</Link>
                </Card>
              ))}
            </div>
          </section>
        )}

        {paidPacks.length > 0 && (
          <section className="mt-16">
            <h2 className="text-section text-navy">Packs</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paidPacks.map((p) => (
                <Card key={p.id} className="flex flex-col p-6">
                  <h3 className="text-body font-semibold text-navy">{p.title}</h3>
                  {p.description && <p className="mt-2 flex-1 text-small text-muted">{p.description}</p>}
                  <div className="mt-4 text-h3 text-action">{p.priceCents != null ? `$${(p.priceCents / 100).toFixed(0)}` : ''}</div>
                  <div className="mt-4"><BuyButton kind="pack" packId={p.id} label="Buy this pack" /></div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-20">
          <h2 className="text-section text-navy">Frequently asked questions</h2>
          <dl className="mt-6 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-small text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}
```

- [ ] **Step 5: Run the tests + full suite + typecheck + lint**

Run: `npm run test -- tests/faq-jsonld.test.ts tests/pricing-page.test.tsx && npm run test && npm run typecheck && npm run lint`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add app/\(catalog\)/pricing/page.tsx lib/seo/jsonld.ts tests/faq-jsonld.test.ts tests/pricing-page.test.tsx
git commit -m "feat: pricing polish — free packs section + FAQ (FAQPage JSON-LD)"
```
(append the trailer)

---

### Task 4: Acceptance — verification + broken-link check

**Files:** none beyond verification.

- [ ] **Step 1: Full unit suite + typecheck + lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 2: Production build (the routes compile, links resolve)**

Run:
```bash
NEXT_PUBLIC_SITE_URL=https://divi5lab.com DATABASE_URL=postgres://u:p@localhost/db AUTH_SECRET=test-secret-test-secret-32chars!! NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_ci STRIPE_SECRET_KEY=sk_test_ci STRIPE_WEBHOOK_SECRET=whsec_ci INGEST_API_TOKEN=test-ingest-token ADMIN_EMAILS=admin@divi5lab.com npm run build
```
Expected: PASS — `/license`, `/about`, `/pricing` all in the route table.

- [ ] **Step 3: Confirm the previously-broken links now resolve**

Run: `grep -rn "/license\|/about" components/site/Header.tsx components/site/Footer.tsx lib/seo/sitemap.ts`
Then confirm the matching route files exist:
Run: `ls "app/(marketing)/license/page.tsx" "app/(marketing)/about/page.tsx"`
Expected: both files exist — the Header/Footer/sitemap links no longer 404.

- [ ] **Step 4: Manual (user-run)**

```bash
npm run dev
# /license → license text + Refunds section. /about → renders. /pricing → free packs + FAQ.
# Click the Header/Footer "License" + "About" links → no 404.
```

- [ ] **Step 5: Commit (empty if nothing changed)**

```bash
git commit --allow-empty -m "chore: Phase 6b acceptance verified"
```
(append the trailer)

---

## Notes

- The refund text (`lib/legal/refund.ts`) is a reasonable digital-goods default — the
  user should review/adjust the wording and the support email/window to taste.
