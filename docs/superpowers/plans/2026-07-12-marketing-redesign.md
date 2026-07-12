# Marketing Site Redesign ("Validator Spine") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all 10 marketing pages around the "deterministic validation" spine — new copy (craftsman-technical voice), new sections, and code-built visual demos — per `docs/superpowers/specs/2026-07-12-marketing-redesign-design.md`.

**Architecture:** A small data layer (`lib/site/stats.ts`, `lib/site/widget-mappings.ts`) feeds real numbers to seven new shared marketing components (`components/marketing/`). Pages compose those components; all bands are React Server Components except `ValidatorChatDemo` (client, stepped animation). No new routes, no schema changes, no new dependencies.

**Tech Stack:** Next.js App Router + RSC, Tailwind (existing tokens only), Vitest + Testing Library (jsdom), existing `Container`/`Card`/`Icon`/`SectionTitle` UI kit.

## Global Constraints

- **No Blob-hosted assets anywhere** — all visuals are CSS/SVG/JSX. No files in `/public` needed.
- **No new npm dependencies.**
- **Existing design tokens only:** colors `navy #0B3558, action #635BFF, paper, mist, fog, muted, ink, border` + chip greens/ambers already in use; type classes `text-display/h1/h2/h3/section/lead/body/small`; radii `rounded-card` (16px), `rounded-button` (4px), `rounded-full`; `shadow-soft`.
- **All animation respects `prefers-reduced-motion`** (CSS media query for CSS animations; `matchMedia` check in `ValidatorChatDemo`).
- **Stats must be real** (verified 2026-07-12): 124 Elementor widget types registered in the converter registry (`registerWidget` calls in `jhmg-elementor-to-divi5/.../class-converter-registry.php`); 15 violation-code constants (`E_*` in `Divi 5 Deterministic Validator/src/Validator.php`); 61 Divi 5 block types in `SchemaRules.php`; 198 published layouts on prod (display "190+"); "100+ active installs" and "35+ Divi modules mapped" carried over from existing verified claims.
- **Copy voice:** craftsman-technical. Specific CTAs (never "Learn more" as a primary), concrete numbers, honest limits.
- **Keep intact:** all routes/URLs, canonicals, `JsonLd` usage (`Product`, `FAQPage`, breadcrumbs), `/api/lead` endpoint + `homepage_free_band` and `divi_to_elementor_waitlist` source tags, `BuyProButton`/`FreeDownloadForm`/`WaitlistForm`/`ContactForm` components, root `title.template` (page titles must NOT append "| Divi5Lab").
- **Existing test regexes that new copy must keep satisfying:** E→D5 H1 matches `/Elementor to Divi 5/i`; AI Editor H1 matches `/AI Editor/i`; D→E H1 matches `/Divi.*Elementor/i` + page shows "pending wordpress.org review" + a "Notify me" button; pricing shows `Elementor → Divi 5 Pro`, `$49`, `coming soon`, `free divi 5 layouts`, and **no** `all-access|membership`; homepage keeps links to all three plugin pages and text matching `/free divi 5 layouts/i` and no `/free quote|work with us|brings in work/i`.
- Run all commands from `/Users/Lucas/Documents/JHMG-Local/layoutlab`. Test runner: `npx vitest run <file>`.

---

### Task 1: Widget-mappings data module

**Files:**
- Create: `lib/site/widget-mappings.ts`
- Test: `tests/widget-mappings.test.ts`

**Interfaces:**
- Produces: `WIDGET_MAPPING_GROUPS: { group: string; widgets: string[] }[]` and `WIDGET_TYPES_MAPPED: number` (total count, currently 124). Consumed by `lib/site/stats.ts` (Task 2) and the E→D5 page (Task 12).

The list is extracted from the converter's real registry. To regenerate later:
`grep -oE "registerWidget\(\s*'[a-z0-9_-]+'" "/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi/includes/converter/registry/class-converter-registry.php" | sed "s/registerWidget( *'//;s/'//" | sort -u`

- [ ] **Step 1: Write the failing test**

```ts
// tests/widget-mappings.test.ts
import { describe, it, expect } from 'vitest';
import { WIDGET_MAPPING_GROUPS, WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';

describe('widget mappings data', () => {
  it('counts every widget across groups', () => {
    const sum = WIDGET_MAPPING_GROUPS.reduce((n, g) => n + g.widgets.length, 0);
    expect(WIDGET_TYPES_MAPPED).toBe(sum);
    expect(WIDGET_TYPES_MAPPED).toBeGreaterThanOrEqual(120);
  });
  it('has no duplicate widget names', () => {
    const all = WIDGET_MAPPING_GROUPS.flatMap((g) => g.widgets);
    expect(new Set(all).size).toBe(all.length);
  });
  it('groups the major ecosystems', () => {
    const names = WIDGET_MAPPING_GROUPS.map((g) => g.group).join(' ');
    expect(names).toMatch(/Elementor core/);
    expect(names).toMatch(/Essential Addons/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/widget-mappings.test.ts`
Expected: FAIL — cannot resolve `@/lib/site/widget-mappings`.

- [ ] **Step 3: Write the data module**

```ts
// lib/site/widget-mappings.ts
// Elementor widget types with a dedicated converter in the E→D5 plugin.
// Source of truth: registerWidget() calls in
// jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi/
//   includes/converter/registry/class-converter-registry.php
// Regenerate with the grep in docs/superpowers/plans/2026-07-12-marketing-redesign.md (Task 1).

export type WidgetMappingGroup = { group: string; widgets: string[] };

export const WIDGET_MAPPING_GROUPS: WidgetMappingGroup[] = [
  {
    group: 'Elementor core',
    widgets: [
      'accordion', 'alert', 'animated-headline', 'audio', 'button', 'call-to-action',
      'countdown', 'counter', 'divider', 'flip-box', 'form', 'gallery', 'google-maps',
      'heading', 'hotspot', 'html', 'icon', 'icon-box', 'icon-list', 'image', 'image-box',
      'image-carousel', 'lottie', 'menu-anchor', 'nav-menu', 'page-title', 'portfolio',
      'posts', 'price-list', 'price-table', 'progress-bar', 'search', 'shortcode',
      'sidebar', 'site-logo', 'slides', 'social-icons', 'spacer', 'star-rating',
      'table-of-contents', 'tabs', 'testimonial', 'text-editor', 'text-path', 'toggle',
      'video',
    ],
  },
  {
    group: 'Elementor v4 atomic (e-*)',
    widgets: [
      'e-accordion', 'e-button', 'e-divider', 'e-heading', 'e-icon', 'e-icon-box',
      'e-image', 'e-image-box', 'e-paragraph', 'e-spacer', 'e-tabs', 'e-toggle',
    ],
  },
  {
    group: 'Essential Addons (eael-*)',
    widgets: [
      'eael-adv-accordion', 'eael-adv-tabs', 'eael-advanced-data-table', 'eael-breadcrumbs',
      'eael-caldera-form', 'eael-code-snippet', 'eael-contact-form-7', 'eael-content-ticker',
      'eael-countdown', 'eael-creative-button', 'eael-cta-box', 'eael-data-table',
      'eael-dual-color-header', 'eael-embedpress', 'eael-event-calendar', 'eael-fancy-text',
      'eael-feature-list', 'eael-filterable-gallery', 'eael-flip-box', 'eael-fluentform',
      'eael-gravity-form', 'eael-image-accordion', 'eael-info-box', 'eael-interactive-circle',
      'eael-login-register', 'eael-ninja', 'eael-post-grid', 'eael-post-timeline',
      'eael-pricing-table', 'eael-progress-bar', 'eael-simple-menu', 'eael-sticky-video',
      'eael-team-member', 'eael-testimonial', 'eael-tooltip', 'eael-weform',
      'eael-woo-add-to-cart', 'eael-woo-cart', 'eael-woo-checkout', 'eael-woo-product-carousel',
      'eael-woo-product-compare', 'eael-woo-product-gallery', 'eael-woo-product-images',
      'eael-woo-product-list', 'eael-woo-product-price', 'eael-woo-product-rating',
      'eael-wpforms',
    ],
  },
  {
    group: 'ElementsKit',
    widgets: [
      'elementskit-accordion', 'elementskit-dual-button', 'elementskit-heading',
      'elementskit-testimonial', 'elementskit-video',
    ],
  },
  {
    group: 'Header Footer Elementor (hfe-*)',
    widgets: [
      'hfe-basic-posts', 'hfe-breadcrumbs-widget', 'hfe-cart', 'hfe-counter',
      'hfe-search-button', 'hfe-site-tagline', 'hfe-site-title',
    ],
  },
  {
    group: 'Other add-ons',
    widgets: [
      'copyright', 'infocard', 'navigation-menu', 'post-info-widget',
      'premium-addon-blog', 'retina', 'woo-product-grid',
    ],
  },
];

export const WIDGET_TYPES_MAPPED = WIDGET_MAPPING_GROUPS.reduce((n, g) => n + g.widgets.length, 0);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/widget-mappings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/site/widget-mappings.ts tests/widget-mappings.test.ts
git commit -m "feat(site): widget-mappings data module extracted from converter registry"
```

---

### Task 2: Marketing stats module

**Files:**
- Create: `lib/site/stats.ts`
- Test: `tests/site-stats.test.ts`

**Interfaces:**
- Consumes: `WIDGET_TYPES_MAPPED` from Task 1.
- Produces: `STATS` object — `{ elementorWidgetsMapped: number; diviModulesMapped: 35; validatorViolationClasses: 15; validatorBlockTypes: 61; freeLayoutsPublished: 190; activeInstalls: 100 }`. Consumed by every page that shows numbers.

- [ ] **Step 1: Write the failing test**

```ts
// tests/site-stats.test.ts
import { describe, it, expect } from 'vitest';
import { STATS } from '@/lib/site/stats';
import { WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';

describe('marketing stats', () => {
  it('derives the widget count from the mapping data (single source of truth)', () => {
    expect(STATS.elementorWidgetsMapped).toBe(WIDGET_TYPES_MAPPED);
  });
  it('carries the verified validator and catalog numbers', () => {
    expect(STATS.validatorViolationClasses).toBe(15);
    expect(STATS.validatorBlockTypes).toBe(61);
    expect(STATS.freeLayoutsPublished).toBeGreaterThanOrEqual(190);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/site-stats.test.ts`
Expected: FAIL — cannot resolve `@/lib/site/stats`.

- [ ] **Step 3: Write the module**

```ts
// lib/site/stats.ts
// Real, verifiable marketing numbers. Every figure has a source; update the
// source, then this file — never invent.
import { WIDGET_TYPES_MAPPED } from './widget-mappings';

export const STATS = {
  /** registerWidget() calls in the E→D5 converter registry (see widget-mappings.ts). */
  elementorWidgetsMapped: WIDGET_TYPES_MAPPED,
  /** D→E converter module coverage (established claim, plugin README). */
  diviModulesMapped: 35,
  /** E_* violation-code constants in Divi5Validator/src/Validator.php. */
  validatorViolationClasses: 15,
  /** divi/* block types modeled in Divi5Validator/src/SchemaRules.php. */
  validatorBlockTypes: 61,
  /** Floor of published layouts on prod (198 on 2026-07-12, via sitemap). */
  freeLayoutsPublished: 190,
  /** wordpress.org active installs floor for the E→D5 free plugin. */
  activeInstalls: 100,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/site-stats.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/site/stats.ts tests/site-stats.test.ts
git commit -m "feat(site): single-source marketing stats module"
```

---

### Task 3: StatStrip component

**Files:**
- Create: `components/marketing/StatStrip.tsx`
- Test: `tests/stat-strip.test.tsx`

**Interfaces:**
- Produces: `StatStrip({ stats, className }: { stats: { value: string; label: string }[]; className?: string })` — server component; renders a `<dl>`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/stat-strip.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatStrip } from '@/components/marketing/StatStrip';

describe('StatStrip', () => {
  it('renders each stat as a definition pair', () => {
    render(<StatStrip stats={[{ value: '124', label: 'widgets mapped' }, { value: '15', label: 'violation classes' }]} />);
    expect(screen.getByText('124')).toBeTruthy();
    expect(screen.getByText(/violation classes/i)).toBeTruthy();
    expect(document.querySelectorAll('dl dt').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stat-strip.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/StatStrip.tsx
// Row of hard numbers. dt = the number (visual lead), dd = what it counts.
export function StatStrip({ stats, className = '' }: { stats: { value: string; label: string }[]; className?: string }) {
  return (
    <dl className={`flex flex-wrap items-start justify-center gap-x-10 gap-y-6 ${className}`}>
      {stats.map((s) => (
        <div key={s.label} className="min-w-[120px] text-center">
          <dt className="text-h3 tabular-nums text-navy">{s.value}</dt>
          <dd className="mt-1 text-small font-medium text-muted">{s.label}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stat-strip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/StatStrip.tsx tests/stat-strip.test.tsx
git commit -m "feat(marketing): StatStrip component"
```

---

### Task 4: VerdictCard component

**Files:**
- Create: `components/marketing/VerdictCard.tsx`
- Test: `tests/verdict-card.test.tsx`

**Interfaces:**
- Produces: `VerdictCard({ title, failures, passSummary, className })` where `failures: { code: string; detail: string }[]`, `passSummary: string`. Server component; monospace, styled like real validator output. Real violation codes to use in pages: `WRONG_NESTING`, `UNKNOWN_MODULE_TYPE`, `WRONG_FIELD_TYPE` (they exist in `Validator.php`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/verdict-card.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictCard } from '@/components/marketing/VerdictCard';

describe('VerdictCard', () => {
  it('shows violations then the passing verdict', () => {
    render(
      <VerdictCard
        title="validator output"
        failures={[{ code: 'WRONG_NESTING', detail: 'divi/button directly inside divi/section' }]}
        passSummary="Valid — 14 blocks, 0 violations"
      />,
    );
    expect(screen.getByText('WRONG_NESTING')).toBeTruthy();
    expect(screen.getByText(/0 violations/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/verdict-card.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/VerdictCard.tsx
// A validator transcript: caught violations, the retry, the clean verdict.
// Deliberately monospace and terminal-flavored — this is the product talking.
export function VerdictCard({
  title,
  failures,
  passSummary,
  className = '',
}: {
  title: string;
  failures: { code: string; detail: string }[];
  passSummary: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-card border border-border bg-ink text-paper shadow-soft ${className}`}>
      <div className="flex items-center gap-2 border-b border-paper/10 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="ml-2 font-mono text-small text-paper/60">{title}</span>
      </div>
      <div className="space-y-2.5 px-5 py-5 font-mono text-small leading-relaxed">
        {failures.map((f) => (
          <p key={f.code + f.detail} className="text-paper/90">
            <span className="text-red-400">✗ </span>
            <span className="font-semibold text-red-300">{f.code}</span>
            <span className="text-paper/70">  {f.detail}</span>
          </p>
        ))}
        <p className="text-paper/50">→ {failures.length} violation{failures.length === 1 ? '' : 's'} returned · re-validating…</p>
        <p>
          <span className="text-green-400">✓ </span>
          <span className="text-green-300">{passSummary}</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/verdict-card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/VerdictCard.tsx tests/verdict-card.test.tsx
git commit -m "feat(marketing): VerdictCard validator-transcript component"
```

---

### Task 5: ValidatorChatDemo component (client, animated)

**Files:**
- Create: `components/marketing/ValidatorChatDemo.tsx`
- Test: `tests/validator-chat-demo.test.tsx`

**Interfaces:**
- Produces: `ValidatorChatDemo({ steps, className }: { steps: ChatStep[]; className?: string })` and `type ChatStep = { role: 'user' | 'assistant' | 'validator-fail' | 'validator-pass'; text: string }`. Client component. Steps appear one-by-one (~1.3s cadence); with `prefers-reduced-motion: reduce` all steps render immediately. Used on homepage (Task 10) and AI Editor page (Task 14).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/validator-chat-demo.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';

const STEPS: ChatStep[] = [
  { role: 'user', text: 'Center the hero button on Home.' },
  { role: 'assistant', text: 'Calling update_page_layout…' },
  { role: 'validator-pass', text: 'Valid — saved to “Home”.' },
];

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduced, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }));
}

afterEach(() => vi.useRealTimers());

describe('ValidatorChatDemo', () => {
  it('renders all steps immediately under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
  it('renders all steps immediately when matchMedia is unavailable (jsdom default)', () => {
    // @ts-expect-error simulate environments without matchMedia
    delete window.matchMedia;
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
  it('reveals steps over time when motion is allowed', () => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    render(<ValidatorChatDemo steps={STEPS} />);
    expect(screen.getByText(/center the hero button/i)).toBeTruthy();
    expect(screen.queryByText(/saved to/i)).toBeNull();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText(/saved to/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validator-chat-demo.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/ValidatorChatDemo.tsx
'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export type ChatStep = {
  role: 'user' | 'assistant' | 'validator-fail' | 'validator-pass';
  text: string;
};

// Stepped "AI edit → validator verdict" transcript. SSR renders step one;
// the effect either reveals the rest on a timer or, under
// prefers-reduced-motion, all at once.
export function ValidatorChatDemo({ steps, className = '' }: { steps: ChatStep[]; className?: string }) {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    // No matchMedia (jsdom/tests) or reduced motion → show the finished transcript.
    const canAnimate =
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canAnimate) {
      setVisible(steps.length);
      return;
    }
    if (visible >= steps.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 1300);
    return () => clearTimeout(t);
  }, [visible, steps.length]);

  return (
    <div className={`rounded-card border border-border bg-paper p-5 shadow-soft sm:p-6 ${className}`} aria-label="AI Editor demo">
      <ol className="space-y-3">
        {steps.slice(0, visible).map((s, i) => (
          <li key={i} className={s.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {s.role === 'user' && (
              <p className="max-w-[85%] rounded-card rounded-br-none bg-action px-4 py-2.5 text-small font-medium text-paper">{s.text}</p>
            )}
            {s.role === 'assistant' && (
              <p className="max-w-[85%] rounded-card rounded-bl-none bg-fog px-4 py-2.5 font-mono text-small text-navy">{s.text}</p>
            )}
            {s.role === 'validator-fail' && (
              <p className="flex max-w-[85%] items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-2.5 font-mono text-small text-red-700">
                <Icon name="close" size={16} className="mt-0.5 shrink-0" /> {s.text}
              </p>
            )}
            {s.role === 'validator-pass' && (
              <p className="flex max-w-[85%] items-start gap-2 rounded-card border border-green-200 bg-green-50 px-4 py-2.5 font-mono text-small text-green-700">
                <Icon name="check" size={16} className="mt-0.5 shrink-0" /> {s.text}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/validator-chat-demo.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/marketing/ValidatorChatDemo.tsx tests/validator-chat-demo.test.tsx
git commit -m "feat(marketing): animated ValidatorChatDemo with reduced-motion fallback"
```

---

### Task 6: MappingPanel component + CSS stagger animation

**Files:**
- Create: `components/marketing/MappingPanel.tsx`
- Modify: `app/globals.css` (add `.anim-rise` utility inside `@layer components`)
- Test: `tests/mapping-panel.test.tsx`

**Interfaces:**
- Produces: `MappingPanel({ pairs, fromLabel, toLabel, className })` where `pairs: { from: string; to: string }[]` — server component; two labeled columns joined by arrows, rows stagger-fade in via CSS only. Used on E→D5 page (Task 12); homepage uses its own inline motif.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/mapping-panel.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MappingPanel } from '@/components/marketing/MappingPanel';

describe('MappingPanel', () => {
  it('renders every mapping pair with source and target', () => {
    render(
      <MappingPanel
        fromLabel="Elementor"
        toLabel="Divi 5"
        pairs={[{ from: 'price-table', to: 'divi/pricing-tables' }, { from: 'form', to: 'divi/contact-form' }]}
      />,
    );
    expect(screen.getByText('price-table')).toBeTruthy();
    expect(screen.getByText('divi/pricing-tables')).toBeTruthy();
    expect(screen.getByText('Elementor')).toBeTruthy();
    expect(screen.getByText('Divi 5')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/mapping-panel.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Add the CSS utility**

In `app/globals.css`, inside the existing `@layer components { … }` block, append after the `.prose-divi` rules:

```css
  /* Stagger-rise entrance for marketing panels. Rows set --rise-i. */
  @keyframes rise-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  .anim-rise { animation: rise-in 0.5s ease-out both; animation-delay: calc(var(--rise-i, 0) * 120ms); }
  @media (prefers-reduced-motion: reduce) {
    .anim-rise { animation: none; }
  }
```

- [ ] **Step 4: Implement the component**

```tsx
// components/marketing/MappingPanel.tsx
import { Icon } from '@/components/ui/Icon';

// Widget → module mapping rows, terminal-tag styled, staggered entrance.
export function MappingPanel({
  pairs,
  fromLabel,
  toLabel,
  className = '',
}: {
  pairs: { from: string; to: string }[];
  fromLabel: string;
  toLabel: string;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-border bg-paper p-6 shadow-soft ${className}`}>
      <div className="mb-4 flex items-center justify-between text-small font-semibold uppercase tracking-wide text-muted">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
      <ul className="space-y-2.5">
        {pairs.map((p, i) => (
          <li key={p.from} className="anim-rise flex items-center justify-between gap-3" style={{ ['--rise-i' as string]: i }}>
            <code className="rounded-button bg-fog px-2.5 py-1.5 font-mono text-small text-navy">{p.from}</code>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <Icon name="arrow_forward" size={16} className="shrink-0 text-action" />
            <code className="rounded-button bg-navy px-2.5 py-1.5 font-mono text-small text-paper">{p.to}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/mapping-panel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/marketing/MappingPanel.tsx tests/mapping-panel.test.tsx app/globals.css
git commit -m "feat(marketing): MappingPanel with reduced-motion-safe stagger entrance"
```

---

### Task 7: ComparisonTable component

**Files:**
- Create: `components/marketing/ComparisonTable.tsx`
- Test: `tests/comparison-table.test.tsx`

**Interfaces:**
- Produces: `ComparisonTable({ caption, columns, rows, footnote, className })` where `columns: string[]` (e.g. `['Free', 'Pro']`) and `rows: { label: string; values: (boolean | string)[] }[]`. Boolean `true` renders a check icon, `false` renders an em-dash, strings render verbatim. Accessible `<table>` with `<caption>` (visually hidden). Used on plugin pages (Tasks 12–14).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/comparison-table.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';

describe('ComparisonTable', () => {
  it('renders columns, rows, and mixed value types', () => {
    render(
      <ComparisonTable
        caption="Free vs Pro"
        columns={['Free', 'Pro']}
        rows={[
          { label: 'Single-page import', values: [true, true] },
          { label: 'Full kit ZIP import', values: [false, true] },
          { label: 'Updates', values: ['—', '1 year'] },
        ]}
      />,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Full kit ZIP import')).toBeTruthy();
    expect(screen.getByText('1 year')).toBeTruthy();
    expect(screen.getAllByText('Included').length).toBe(3); // sr-only labels on checks
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/comparison-table.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/ComparisonTable.tsx
import { Icon } from '@/components/ui/Icon';

export function ComparisonTable({
  caption,
  columns,
  rows,
  footnote,
  className = '',
}: {
  caption: string;
  columns: string[];
  rows: { label: string; values: (boolean | string)[] }[];
  footnote?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-card border border-border bg-paper shadow-soft ${className}`}>
      <table className="w-full min-w-[480px] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-mist">
            <th scope="col" className="px-5 py-3.5 text-small font-semibold uppercase tracking-wide text-muted">Capability</th>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-5 py-3.5 text-small font-semibold uppercase tracking-wide text-navy">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-b-0">
              <th scope="row" className="px-5 py-3.5 text-body font-normal text-navy">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className="px-5 py-3.5 text-body text-muted">
                  {v === true ? (
                    <>
                      <Icon name="check_circle" size={20} className="text-action" />
                      <span className="sr-only">Included</span>
                    </>
                  ) : v === false ? (
                    <span aria-label="Not included">—</span>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footnote && <p className="border-t border-border bg-mist px-5 py-3 text-small text-muted">{footnote}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/comparison-table.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/ComparisonTable.tsx tests/comparison-table.test.tsx
git commit -m "feat(marketing): accessible ComparisonTable"
```

---

### Task 8: CtaBand component

**Files:**
- Create: `components/marketing/CtaBand.tsx`
- Test: `tests/cta-band.test.tsx`

**Interfaces:**
- Produces: `CtaBand({ title, body, cta, secondary })` — dark (`bg-ink`) closing band; `cta`/`secondary`: `{ label: string; href: string }`. Used as the closing band on every redesigned page.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/cta-band.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CtaBand } from '@/components/marketing/CtaBand';

describe('CtaBand', () => {
  it('renders title, body and both actions', () => {
    render(
      <CtaBand
        title="Stop rebuilding. Start shipping."
        body="Move a whole site this week."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Browse layouts', href: '/browse' }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/stop rebuilding/i);
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /browse layouts/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cta-band.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/CtaBand.tsx
import Link from 'next/link';
import { Container } from '@/components/ui/Container';

export function CtaBand({
  title,
  body,
  cta,
  secondary,
}: {
  title: string;
  body?: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="border-t border-border bg-ink py-20 text-paper">
      <Container className="text-center">
        <h2 className="mx-auto max-w-2xl text-h2 text-paper">{title}</h2>
        {body && <p className="mx-auto mt-4 max-w-xl text-lead text-paper/85">{body}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={cta.href}
            className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
          >
            {cta.label}
          </Link>
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex h-12 items-center justify-center rounded-full border border-paper/30 px-8 text-body font-semibold text-paper transition hover:border-paper"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cta-band.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/CtaBand.tsx tests/cta-band.test.tsx
git commit -m "feat(marketing): CtaBand closing-band component"
```

---

### Task 9: UseCaseVignettes component

**Files:**
- Create: `components/marketing/UseCaseVignettes.tsx`
- Test: `tests/use-case-vignettes.test.tsx`

**Interfaces:**
- Produces: `UseCaseVignettes({ items, className })` where `items: { icon: string; title: string; body: string }[]` (`icon` is a Material icon name). Used on plugin pages (Tasks 12–14).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/use-case-vignettes.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

describe('UseCaseVignettes', () => {
  it('renders a card per vignette', () => {
    render(
      <UseCaseVignettes
        items={[
          { icon: 'business_center', title: 'The agency', body: 'Migrates client sites.' },
          { icon: 'person', title: 'The site owner', body: 'Switches builders once.' },
        ]}
      />,
    );
    expect(screen.getByText('The agency')).toBeTruthy();
    expect(screen.getByText(/switches builders/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/use-case-vignettes.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement**

```tsx
// components/marketing/UseCaseVignettes.tsx
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export function UseCaseVignettes({
  items,
  className = '',
}: {
  items: { icon: string; title: string; body: string }[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-3 ${className}`}>
      {items.map((v) => (
        <Card key={v.title} className="p-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-fog text-action">
            <Icon name={v.icon} size={22} />
          </div>
          <h3 className="mt-4 text-body font-semibold text-navy">{v.title}</h3>
          <p className="mt-2 text-body text-muted">{v.body}</p>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/use-case-vignettes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/UseCaseVignettes.tsx tests/use-case-vignettes.test.tsx
git commit -m "feat(marketing): UseCaseVignettes component"
```

---

### Task 10: ProductDoors component + homepage rebuild

**Files:**
- Create: `components/marketing/ProductDoors.tsx`
- Modify: `app/(marketing)/page.tsx` (full rewrite below)
- Modify: `components/marketing/FreeLayoutsBand.tsx` (copy only, lines 38-42)
- Delete: `components/marketing/PluginHero.tsx`, `components/marketing/PluginCards.tsx`
- Test: modify `tests/homepage.test.tsx`; create `tests/product-doors.test.tsx`

**Interfaces:**
- Consumes: `STATS` (Task 2), `StatStrip` (3), `VerdictCard` (4), `ValidatorChatDemo` (5), `CtaBand` (8).
- Produces: `ProductDoors()` — no props; renders the three product cards with motifs. Reused by `/plugins` hub (Task 11).

- [ ] **Step 1: Write the failing ProductDoors test**

```tsx
// tests/product-doors.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductDoors } from '@/components/marketing/ProductDoors';

describe('ProductDoors', () => {
  it('links all three products with job-to-be-done headlines and specific CTAs', () => {
    render(<ProductDoors />);
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/plugins/elementor-to-divi-5');
    expect(hrefs).toContain('/plugins/divi-to-elementor');
    expect(hrefs).toContain('/plugins/divi-5-ai-editor');
    expect(screen.getByText(/leave elementor without rebuilding/i)).toBeTruthy();
    expect(screen.queryByText(/^learn more$/i)).toBeNull();
  });
  it('keeps honest status chips', () => {
    render(<ProductDoors />);
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getAllByText(/free/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/product-doors.test.tsx`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Implement ProductDoors**

```tsx
// components/marketing/ProductDoors.tsx
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { STATS } from '@/lib/site/stats';

type Door = {
  headline: string;
  name: string;
  chip: { label: string; tone: 'green' | 'amber' };
  body: string;
  stats: string;
  href: string;
  cta: string;
  motif: React.ReactNode;
};

const CHIP: Record<'green' | 'amber', string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
};

// Tiny code-built motifs — one visual idea per product, no images.
function MotifMapping() {
  return (
    <div className="flex items-center gap-2 font-mono text-small" aria-hidden>
      <span className="rounded-button bg-fog px-2 py-1 text-navy">price-table</span>
      <Icon name="arrow_forward" size={14} className="text-action" />
      <span className="rounded-button bg-navy px-2 py-1 text-paper">divi/pricing-tables</span>
    </div>
  );
}
function MotifBatch() {
  return (
    <div className="space-y-1.5 font-mono text-small" aria-hidden>
      <p className="text-muted">home ✓ · about ✓ · services ✓</p>
      <p className="text-muted">pricing ✓ · contact <span className="text-action">converting…</span></p>
    </div>
  );
}
function MotifChat() {
  return (
    <div className="space-y-1.5 text-small" aria-hidden>
      <p className="w-fit rounded-card rounded-br-none bg-action/10 px-2.5 py-1 text-navy">“Center the hero button”</p>
      <p className="w-fit rounded-card rounded-bl-none bg-green-50 px-2.5 py-1 font-mono text-green-700">✓ validated · saved</p>
    </div>
  );
}

const DOORS: Door[] = [
  {
    headline: 'Leave Elementor without rebuilding',
    name: 'Elementor → Divi 5 Converter',
    chip: { label: 'Free on wordpress.org · Pro $49/yr', tone: 'green' },
    body: 'Pages, full kits, global headers and footers — converted into real, validated Divi 5 markup that imports clean the first time.',
    stats: `${STATS.elementorWidgetsMapped} widget types mapped · ${STATS.activeInstalls}+ active installs`,
    href: '/plugins/elementor-to-divi-5',
    cta: 'See the converter',
    motif: <MotifMapping />,
  },
  {
    headline: 'Going the other way? Also covered.',
    name: 'Divi → Elementor Converter',
    chip: { label: 'Free plugin pending wordpress.org review', tone: 'amber' },
    body: `Batch-convert whole sites from Divi into Elementor — ${STATS.diviModulesMapped}+ modules mapped, every Divi export format supported.`,
    stats: 'Batch conversion · conversion report per run',
    href: '/plugins/divi-to-elementor',
    cta: 'Join the waitlist',
    motif: <MotifBatch />,
  },
  {
    headline: 'Edit Divi 5 in plain English',
    name: 'AI Editor for Divi 5',
    chip: { label: 'Free download · Pro $79/yr', tone: 'green' },
    body: 'Connect Claude, Cursor, or ChatGPT to your site. Every AI edit passes the validator before it touches your database.',
    stats: `${STATS.validatorViolationClasses} violation classes checked on every save`,
    href: '/plugins/divi-5-ai-editor',
    cta: 'Meet the AI Editor',
    motif: <MotifChat />,
  },
];

export function ProductDoors() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {DOORS.map((d) => (
        <Card key={d.href} className="flex flex-col p-7">
          <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-small font-semibold ${CHIP[d.chip.tone]}`}>
            {d.chip.label}
          </span>
          <h3 className="mt-5 text-section leading-snug text-navy">{d.headline}</h3>
          <p className="mt-1 text-small font-semibold uppercase tracking-wide text-muted">{d.name}</p>
          <div className="mt-5 rounded-card bg-mist p-4">{d.motif}</div>
          <p className="mt-4 flex-1 text-body text-muted">{d.body}</p>
          <p className="mt-3 text-small font-medium text-muted">{d.stats}</p>
          <Link
            href={d.href}
            className="mt-6 inline-flex h-11 w-fit items-center justify-center gap-1.5 rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
          >
            {d.cta} <Icon name="arrow_forward" size={15} />
          </Link>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the ProductDoors test**

Run: `npx vitest run tests/product-doors.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update the homepage test (failing against old page)**

Replace the full contents of `tests/homepage.test.tsx`:

```tsx
// tests/homepage.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(marketing)/page';

describe('homepage (validator spine)', () => {
  it('leads with the never-broken promise and links all three products', async () => {
    render(await HomePage());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/broken layout/i);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
  });
  it('shows the proof strip with real numbers', async () => {
    render(await HomePage());
    // getAllBy: these phrases appear in both the StatStrip and ProductDoors stats.
    expect(screen.getAllByText(/violation classes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/widget types mapped/i).length).toBeGreaterThan(0);
  });
  it('shows the validator mechanism band', async () => {
    render(await HomePage());
    expect(screen.getByText(/same input, same verdict/i)).toBeTruthy();
    expect(screen.getByText(/WRONG_NESTING/)).toBeTruthy();
  });
  it('has no services-funnel remnants', async () => {
    render(await HomePage());
    expect(screen.queryByText(/free quote|work with us|brings in work/i)).toBeNull();
  });
  it('keeps a free-layouts band', async () => {
    render(await HomePage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
  });
  it('links featured guides', async () => {
    render(await HomePage());
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links.some((h) => h?.startsWith('/guides/'))).toBe(true);
  });
});
```

Run: `npx vitest run tests/homepage.test.tsx` — Expected: FAIL (old page).

- [ ] **Step 6: Rewrite the homepage**

Replace the full contents of `app/(marketing)/page.tsx`:

```tsx
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { STATS } from '@/lib/site/stats';
import { listGuides } from '@/lib/guides';
import { StatStrip } from '@/components/marketing/StatStrip';
import { VerdictCard } from '@/components/marketing/VerdictCard';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { ProductDoors } from '@/components/marketing/ProductDoors';
import { CtaBand } from '@/components/marketing/CtaBand';
import { FreeLayoutsBand } from '@/components/marketing/FreeLayoutsBand';

const DEMO_STEPS: ChatStep[] = [
  { role: 'user', text: 'Change the hero headline to “Spring sale — 20% off everything” and center the button.' },
  { role: 'assistant', text: 'update_page_layout(page: "Home", …)' },
  { role: 'validator-fail', text: 'WRONG_FIELD_TYPE — button alignment must be an object, got string' },
  { role: 'assistant', text: 'Correcting the attribute shape, re-submitting…' },
  { role: 'validator-pass', text: 'Valid — 14 blocks, 0 violations. Saved to “Home”.' },
];

const FEATURED_GUIDES = ['how-to-convert-elementor-to-divi-5', 'connect-claude-to-divi-5', 'elementor-to-divi-migration-checklist'];

export default async function HomePage() {
  const guides = listGuides().filter((g) => FEATURED_GUIDES.includes(g.slug)).slice(0, 3);

  return (
    <main>
      {/* 1 — Hero: the promise, then proof */}
      <section className="border-b border-border bg-mist py-20">
        <Container className="text-center">
          <h1 className="mx-auto max-w-3xl text-h1 text-navy">Divi 5 tools that never ship a broken layout.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-muted">
            Converters and an AI editor built on a deterministic validator — every block, attribute, and nesting
            rule checked before anything touches your site. If it imports, it works.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/plugins/elementor-to-divi-5"
              className="inline-flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
            >
              Convert Elementor to Divi 5
            </Link>
            <Link
              href="/plugins/divi-5-ai-editor"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Meet the AI Editor
            </Link>
          </div>
          <StatStrip
            className="mt-12"
            stats={[
              { value: String(STATS.elementorWidgetsMapped), label: 'widget types mapped' },
              { value: String(STATS.validatorBlockTypes), label: 'Divi 5 block types modeled' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
              { value: `${STATS.freeLayoutsPublished}+`, label: 'free layouts shipped' },
            ]}
          />
        </Container>
      </section>

      {/* 2 — Problem band */}
      <section className="bg-ink py-16 text-paper">
        <Container className="max-w-3xl text-center">
          <p className="text-small font-semibold uppercase tracking-wide text-paper/60">The problem</p>
          <h2 className="mt-3 text-h3 text-paper">Page-builder markup is unforgiving.</h2>
          <p className="mt-4 text-lead text-paper/85">
            Rebuild a site by hand and you lose weeks. Trust a naive converter — or raw AI output — and you get
            markup Divi half-renders: collapsed sections, attributes that don&apos;t exist, nesting the builder never
            allowed. And you find out after the import.
          </p>
        </Container>
      </section>

      {/* 3 — Mechanism */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-small font-semibold uppercase tracking-wide text-action">The fix</p>
              <h2 className="mt-3 text-h2 text-navy">Same input, same verdict.</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Everything we produce — converted pages, AI edits, generated layouts — runs through the same
                deterministic validator before it reaches you. Not a linter, not a vibe check: a strict schema of{' '}
                {STATS.validatorBlockTypes} Divi 5 block types with every attribute and nesting rule enforced.
              </p>
              <ol className="mt-8 space-y-4">
                {[
                  { t: 'Convert or generate', b: 'A converter maps your old markup; the AI drafts your edit.' },
                  { t: 'Validate', b: `${STATS.validatorViolationClasses} classes of violations checked — exact codes come back, and the tool self-corrects.` },
                  { t: 'Import clean', b: 'Only layouts with a passing verdict ever reach your site.' },
                ].map((s, i) => (
                  <li key={s.t} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</span>
                    <div>
                      <h3 className="text-body font-semibold text-navy">{s.t}</h3>
                      <p className="mt-0.5 text-body text-muted">{s.b}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <VerdictCard
              title="divi5-validator — layout.json"
              failures={[
                { code: 'WRONG_NESTING', detail: 'divi/button directly inside divi/section' },
                { code: 'UNKNOWN_MODULE_TYPE', detail: '“divi/hero” is not a Divi 5 block' },
              ]}
              passSummary="Valid — 14 blocks, 0 violations"
            />
          </div>
        </Container>
      </section>

      {/* 4 — Three doors */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-h2 text-navy">Three tools, one guarantee</h2>
            <p className="mt-4 text-lead text-muted">Different jobs, same validator underneath.</p>
          </div>
          <div className="mt-12">
            <ProductDoors />
          </div>
        </Container>
      </section>

      {/* 5 — Centerpiece demo */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <ValidatorChatDemo steps={DEMO_STEPS} />
            <div>
              <p className="text-small font-semibold uppercase tracking-wide text-action">Watch it work</p>
              <h2 className="mt-3 text-h2 text-navy">The AI makes the edit. The validator keeps it honest.</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                When your assistant gets an attribute wrong, it doesn&apos;t reach your database — it gets the exact
                violation back and fixes it. You see the corrected result, not the mistake.
              </p>
              <Link href="/plugins/divi-5-ai-editor" className="mt-6 inline-flex items-center gap-1.5 text-body font-semibold text-action hover:underline">
                Meet the AI Editor <Icon name="arrow_forward" size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* 6 — Free layouts (lead capture, reworded in FreeLayoutsBand) */}
      <FreeLayoutsBand />

      {/* 7 — Guides strip */}
      <section className="border-t border-border bg-mist py-16">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-h3 text-navy">From the lab notebook</h2>
            <Link href="/guides" className="text-small font-semibold text-action hover:underline">All guides</Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="group block">
                <Card className="h-full p-6 transition group-hover:-translate-y-0.5">
                  <h3 className="text-body font-semibold text-navy transition group-hover:text-action">{g.title}</h3>
                  <p className="mt-2 text-small text-muted">{g.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* 8 — Closing CTA */}
      <CtaBand
        title="Stop rebuilding. Start shipping."
        body="Move a whole site this week — headers, footers, global styles and all — into real, validated Divi 5 markup."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Browse free layouts', href: '/browse' }}
      />
    </main>
  );
}
```

- [ ] **Step 7: Reword FreeLayoutsBand copy**

In `components/marketing/FreeLayoutsBand.tsx`, replace the heading + paragraph block (currently the `<h2>` "Free Divi 5 layouts — the whole catalog, free." and the `<p>` under it) with:

```tsx
          <h2 className="mt-4 text-h3 text-navy">Free Divi 5 layouts, straight from the lab.</h2>
          <p className="mt-3 max-w-xl text-body text-muted">
            The catalog is the validator&apos;s proving ground: 190+ sections and pages generated, validated,
            rendered, and shipped — every one free. Drop your email and new ones land in your inbox.
          </p>
```

Leave the form, endpoint, and source tag untouched.

- [ ] **Step 8: Delete the superseded components**

```bash
rm components/marketing/PluginHero.tsx components/marketing/PluginCards.tsx
grep -rn "PluginHero\|PluginCards" app components && echo "STILL REFERENCED — fix" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 9: Run homepage + full marketing tests**

Run: `npx vitest run tests/homepage.test.tsx tests/product-doors.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 10: Commit**

```bash
git add app/\(marketing\)/page.tsx components/marketing tests/homepage.test.tsx tests/product-doors.test.tsx
git commit -m "feat(home): validator-spine homepage — story arc, proof strip, live demo"
```

---

### Task 11: Plugins hub rebuild

**Files:**
- Modify: `app/(marketing)/plugins/page.tsx` (full rewrite below)
- Test: modify `tests/plugins-hub.test.tsx`

**Interfaces:**
- Consumes: `ProductDoors` (Task 10), `CtaBand` (8), `STATS` (2).

- [ ] **Step 1: Update the hub test (failing)**

Replace the body of the first `it(...)` blocks in `tests/plugins-hub.test.tsx` with (keep the existing imports/mocks at the top of the file exactly as they are):

```tsx
describe('/plugins hub', () => {
  it('renders all three products with honest chips', async () => {
    render(await PluginsHub());
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getByText(/\$79\/yr/i)).toBeTruthy();
    expect(screen.getByText(/\$49\/yr/i)).toBeTruthy();
  });
  it('has a which-tool decision strip', async () => {
    render(await PluginsHub());
    expect(screen.getByText(/which tool do i need/i)).toBeTruthy();
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/plugins/i); });
});
```

(If the existing test calls `PluginsHub()` without `await`, keep that calling convention.)

Run: `npx vitest run tests/plugins-hub.test.tsx` — Expected: FAIL (no decision strip yet).

- [ ] **Step 2: Rewrite the hub page**

Replace the full contents of `app/(marketing)/plugins/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProductDoors } from '@/components/marketing/ProductDoors';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'WordPress Plugins by Divi5Lab — converters & AI tools',
  description:
    'WordPress plugins for Divi 5: convert Elementor pages to Divi 5, convert Divi to Elementor, and edit Divi 5 pages with a validated AI editor.',
};

const DECISIONS = [
  {
    icon: 'sync_alt',
    situation: 'I have an Elementor site and want Divi 5.',
    answer: 'Elementor → Divi 5 Converter',
    href: '/plugins/elementor-to-divi-5',
  },
  {
    icon: 'u_turn_left',
    situation: 'I have a Divi site and need Elementor.',
    answer: 'Divi → Elementor Converter',
    href: '/plugins/divi-to-elementor',
  },
  {
    icon: 'smart_toy',
    situation: 'I already run Divi 5 and want AI to edit it safely.',
    answer: 'AI Editor for Divi 5',
    href: '/plugins/divi-5-ai-editor',
  },
];

export default function PluginsHub() {
  return (
    <main>
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <h1 className="text-h1 text-navy">Plugins</h1>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            Migration converters and an AI editor for Divi 5 — every one built on the same deterministic
            validator, so the output is real, importable markup. Never a guess.
          </p>
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <ProductDoors />
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <Card className="p-8">
            <h2 className="text-section text-navy">Which tool do I need?</h2>
            <ul className="mt-6 divide-y divide-border">
              {DECISIONS.map((d) => (
                <li key={d.href} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <span className="flex items-center gap-3 text-body text-navy">
                    <Icon name={d.icon} size={20} className="text-action" /> {d.situation}
                  </span>
                  <Link href={d.href} className="inline-flex items-center gap-1 text-body font-semibold text-action hover:underline">
                    {d.answer} <Icon name="arrow_forward" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Container>
      </section>

      <CtaBand
        title="One validator. Three ways to use it."
        body="Free tiers on everything — try a conversion or an AI edit before you spend a cent."
        cta={{ label: 'See pricing', href: '/pricing' }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/plugins-hub.test.tsx tests/product-doors.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/plugins/page.tsx tests/plugins-hub.test.tsx
git commit -m "feat(plugins): hub rebuilt on ProductDoors + decision strip"
```

---

### Task 12: Elementor → Divi 5 page rebuild

**Files:**
- Modify: `app/(marketing)/plugins/elementor-to-divi-5/page.tsx` (full rewrite below)
- Test: modify `tests/plugin-product-page.test.tsx`

**Interfaces:**
- Consumes: `STATS` (2), `WIDGET_MAPPING_GROUPS` (1), `StatStrip` (3), `MappingPanel` (6), `ComparisonTable` (7), `CtaBand` (8), `UseCaseVignettes` (9), existing `BuyProButton`, `JsonLd`, `productJsonLd`, `faqJsonLd`.

- [ ] **Step 1: Extend the page test (failing)**

Add these `it` blocks inside the existing describe in `tests/plugin-product-page.test.tsx` (keep existing tests — the H1 still matches `/Elementor to Divi 5/i` and `$49` remains):

```tsx
  it('shows the mapping panel and the full widget reference', async () => {
    render(await PluginPage());
    // getAllBy where the term appears in both the MappingPanel and the reference list.
    expect(screen.getAllByText('price-table').length).toBeGreaterThan(0);
    expect(screen.getByText(/all .* widget types/i)).toBeTruthy(); // collapsible reference intro
    expect(screen.getByText('eael-pricing-table')).toBeTruthy();   // deep list entry
  });
  it('shows an honest conversion report with a graceful fallback', async () => {
    render(await PluginPage());
    expect(screen.getAllByText(/conversion report/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fallback/i).length).toBeGreaterThan(0);
  });
  it('renders Free vs Pro as a comparison table', async () => {
    render(await PluginPage());
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByText(/full kit zip import/i).length).toBeGreaterThan(0);
  });
  it('has an expanded FAQ', async () => {
    render(await PluginPage());
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(8);
  });
```

Run: `npx vitest run tests/plugin-product-page.test.tsx` — Expected: new tests FAIL.

- [ ] **Step 2: Rewrite the page**

Replace the full contents of `app/(marketing)/plugins/elementor-to-divi-5/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { WIDGET_MAPPING_GROUPS, WIDGET_TYPES_MAPPED } from '@/lib/site/widget-mappings';
import { StatStrip } from '@/components/marketing/StatStrip';
import { MappingPanel } from '@/components/marketing/MappingPanel';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const WP_ORG_URL = 'https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/';

const PRODUCT_NAME = 'Elementor to Divi 5 Converter';
const PRODUCT_DESCRIPTION =
  'Convert Elementor pages and kits into real, validated Divi 5 layouts. Free plugin handles single-page JSON imports; Pro unlocks full kit ZIP import, global headers/footers, and priority support.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'Elementor to Divi 5 Converter — Free plugin + Pro',
  description:
    `Convert Elementor pages and kits to Divi 5 in minutes. ${WIDGET_TYPES_MAPPED} widget types mapped to real, validated Divi 5 modules. Free plugin for single pages; Pro adds full kit ZIP import and global styles — $49/yr, unlimited sites.`,
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/elementor-to-divi-5` },
};

const MAPPING_PAIRS = [
  { from: 'heading', to: 'divi/heading' },
  { from: 'image-box', to: 'divi/blurb' },
  { from: 'price-table', to: 'divi/pricing-tables' },
  { from: 'form', to: 'divi/contact-form' },
  { from: 'testimonial', to: 'divi/testimonial' },
  { from: 'nav-menu', to: 'divi/menu' },
];

// Honest mock of a real conversion report: mostly clean, one graceful fallback.
const REPORT_ROWS = [
  { widget: 'heading ×6', result: 'divi/heading', ok: true },
  { widget: 'image ×9', result: 'divi/image', ok: true },
  { widget: 'icon-box ×4', result: 'divi/blurb', ok: true },
  { widget: 'form ×1', result: 'divi/contact-form', ok: true },
  { widget: 'lottie ×1', result: 'divi/code (embed fallback)', ok: false },
];

const PRO_WHY = [
  {
    title: 'Full kit ZIP import',
    body: 'Convert an entire Elementor site in one run — every page, template, and popup in the kit — instead of exporting pages one at a time.',
  },
  {
    title: 'Global headers & footers → Divi Theme Builder',
    body: 'Your site-wide header and footer land as real Theme Builder templates, not orphaned sections pasted on every page.',
  },
  {
    title: 'Global colors & typography',
    body: 'Elementor kit styles become Divi global presets, so the converted site keeps its design system — and stays editable.',
  },
  {
    title: 'Priority support + a year of updates',
    body: 'Elementor and Divi both move fast. Updates keep the mappings current; priority support gets you unstuck mid-migration.',
  },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Standardizing 30 client sites on Divi 5. Kit import turns a quarter of rebuild work into a review pass per site.',
  },
  {
    icon: 'storefront',
    title: 'The site owner',
    body: 'One site, one move. Free plugin, page by page, zero cost — upgrade only if the header and footer should come along.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Quotes Divi rebuilds by the page. The converter does the first 80%; the craft goes into the 20% clients actually see.',
  },
];

const FAQ = [
  {
    question: 'Is it really unlimited sites?',
    answer: 'Yes — a Pro license activates on as many sites as you own or build for clients, for as long as it stays active.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on the sites where it is already activated. You just stop receiving new updates and priority support until you renew.',
  },
  {
    question: 'Do I need the free plugin?',
    answer: 'Yes — Pro is a license that extends the free plugin. Install the free plugin from wordpress.org first, then activate Pro.',
  },
  {
    question: 'What if a widget has no mapping?',
    answer: `${WIDGET_TYPES_MAPPED} widget types have dedicated converters. Anything else falls back gracefully — content is preserved in a Divi code module and flagged in the conversion report, never silently dropped.`,
  },
  {
    question: 'Does it touch my Elementor site?',
    answer: 'No. You export from Elementor and import into your Divi site. The original site is never modified — you can compare both until you are happy.',
  },
  {
    question: 'Does it work with Divi 4?',
    answer: 'Output targets Divi 5 markup specifically — that is the point. Divi 5 imports it natively; we validate against the Divi 5 schema.',
  },
  {
    question: 'How do I know the output is valid?',
    answer: `Every converted layout is checked against a deterministic validator: ${STATS.validatorBlockTypes} Divi 5 block types, ${STATS.validatorViolationClasses} violation classes. If it passes, it imports.`,
  },
  {
    question: 'Which page-builder add-ons are covered?',
    answer: 'Elementor core plus Essential Addons, ElementsKit, Header Footer Elementor, and popular Woo widgets — see the full mapping reference on this page.',
  },
  {
    question: 'Is there a refund policy?',
    answer: 'If Pro does not work for your migration and support cannot fix it, contact us within 14 days of purchase for a refund.',
  },
];

function ReportRow({ widget, result, ok }: { widget: string; result: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <code className="font-mono text-small text-navy">{widget}</code>
      <span className="flex items-center gap-2 font-mono text-small">
        {ok ? <Icon name="check" size={15} className="text-green-600" /> : <Icon name="subdirectory_arrow_right" size={15} className="text-amber-600" />}
        <span className={ok ? 'text-muted' : 'text-amber-700'}>{result}</span>
      </span>
    </li>
  );
}

export default function PluginPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/elementor-to-divi-5`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          image: 'https://ps.w.org/jhmg-converter-for-elementor-to-divi/assets/banner-772x250.png',
          url,
          offer: { priceCents: 4900, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero */}
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <h1 className="max-w-3xl text-h1 text-navy">Convert Elementor to Divi 5 — without rebuilding a thing.</h1>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            Export from Elementor, import into Divi 5, review real modules — not shortcode soup. Every conversion
            is checked against the Divi 5 schema before you see it. Free for single pages; Pro moves whole sites.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
            <a
              href={WP_ORG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
            >
              Get the free plugin
            </a>
          </div>
          <StatStrip
            className="mt-12 justify-start"
            stats={[
              { value: String(WIDGET_TYPES_MAPPED), label: 'widget types mapped' },
              { value: `${STATS.activeInstalls}+`, label: 'active installs' },
              { value: '3', label: 'steps to a converted page' },
            ]}
          />
        </Container>
      </section>

      {/* Demo: mapping panel + conversion report */}
      <section className="py-20">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-h2 text-navy">Real modules, mapped one to one</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Each Elementor widget has a dedicated converter that produces the equivalent Divi 5 module —
                content, links, and styling included. No generic wrappers, no lossy HTML dumps.
              </p>
              <MappingPanel className="mt-8" fromLabel="Elementor" toLabel="Divi 5" pairs={MAPPING_PAIRS} />
            </div>
            <div>
              <h2 className="text-h2 text-navy">A report for every run</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                The conversion report tells you exactly what happened to every widget — including the rare one
                without a mapping, which is preserved as an embed and flagged. Nothing is silently dropped.
              </p>
              <Card className="mt-8 p-6">
                <p className="text-small font-semibold uppercase tracking-wide text-muted">Conversion report — home.json</p>
                <ul className="mt-3 divide-y divide-border">
                  {REPORT_ROWS.map((r) => (
                    <ReportRow key={r.widget} {...r} />
                  ))}
                </ul>
                <p className="mt-3 text-small text-muted">20 of 21 widgets converted to native modules · 1 graceful fallback</p>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Three steps, no surprises</h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { title: 'Export from Elementor', body: 'A page JSON (free) or the full kit ZIP (Pro) — straight from your existing site, which is never modified.' },
              { title: 'Upload in Tools', body: 'Open the plugin under WordPress → Tools on your Divi site and upload the export.' },
              { title: 'Review & publish', body: 'Widgets arrive as native Divi 5 modules with a per-widget report. Validated against the Divi 5 schema before you ever see it.' },
            ].map((s, i) => (
              <div key={s.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pro depth */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">What Pro actually buys you</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PRO_WHY.map((f) => (
              <Card key={f.title} className="p-7">
                <h3 className="text-body font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-body text-muted">{f.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Free vs Pro table */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Free vs. Pro</h2>
          <ComparisonTable
            className="mt-8"
            caption="Elementor to Divi 5 Converter — Free vs Pro"
            columns={['Free', 'Pro — $49/yr']}
            rows={[
              { label: 'Single-page JSON imports (unlimited)', values: [true, true] },
              { label: `${WIDGET_TYPES_MAPPED} widget-type mappings`, values: [true, true] },
              { label: 'Conversion report per run', values: [true, true] },
              { label: 'Full kit ZIP import', values: [false, true] },
              { label: 'Global headers/footers → Theme Builder', values: [false, true] },
              { label: 'Global colors & typography', values: [false, true] },
              { label: 'Updates', values: ['—', '1 year'] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses — renewal covers updates and support."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />
            <a href={WP_ORG_URL} target="_blank" rel="noopener noreferrer" className="text-body font-semibold text-action hover:underline">
              Start with the free plugin
            </a>
          </div>
        </Container>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Who moves sites with it</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </section>

      {/* Widget mapping reference */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">The full mapping reference</h2>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            All {WIDGET_TYPES_MAPPED} widget types with a dedicated converter, straight from the plugin&apos;s
            registry. If yours is on this list, it converts to a native Divi 5 module.
          </p>
          <div className="mt-8 space-y-4">
            {WIDGET_MAPPING_GROUPS.map((g) => (
              <details key={g.group} className="rounded-card border border-border bg-paper p-5 shadow-soft">
                <summary className="cursor-pointer text-body font-semibold text-navy">
                  {g.group} <span className="text-muted">({g.widgets.length})</span>
                </summary>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {g.widgets.map((w) => (
                    <li key={w}>
                      <code className="rounded-button bg-fog px-2 py-1 font-mono text-small text-navy">{w}</code>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Ship your migration this week."
        body="Full kits, global styles, headers and footers — converted into validated Divi 5 markup, reviewed by you."
        cta={{ label: 'Get Pro — $49/yr', href: '/pricing' }}
        secondary={{ label: 'Try the free plugin first', href: WP_ORG_URL }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/plugin-product-page.test.tsx`
Expected: PASS — including the pre-existing H1 (`/Elementor to Divi 5/i` matches the new H1) and `$49` assertions.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/plugins/elementor-to-divi-5/page.tsx tests/plugin-product-page.test.tsx
git commit -m "feat(e2d5): full landing rebuild — mapping panel, honest report, mapping reference, deep FAQ"
```

---

### Task 13: Divi → Elementor page rebuild

**Files:**
- Modify: `app/(marketing)/plugins/divi-to-elementor/page.tsx` (full rewrite below)
- Test: modify `tests/plugin-d2e-page.test.tsx`

**Interfaces:**
- Consumes: `STATS` (2), `ComparisonTable` (7), `CtaBand` (8), `UseCaseVignettes` (9), existing `WaitlistForm`, `JsonLd`, `faqJsonLd`. Keep H1 matching `/Divi.*Elementor/i`, the literal text "pending wordpress.org review", and a "Notify me" button (existing test contract).

- [ ] **Step 1: Extend the test (failing)**

Add inside the existing describe in `tests/plugin-d2e-page.test.tsx`:

```tsx
  it('shows the batch-conversion mock', () => {
    render(<D2EPage />);
    expect(screen.getByText(/batch run/i)).toBeTruthy();
  });
  it('has an expanded FAQ', () => {
    render(<D2EPage />);
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(6);
  });
```

(Match the file's existing render call — if it renders `await D2EPage()`, do the same.)

Run: `npx vitest run tests/plugin-d2e-page.test.tsx` — Expected: new tests FAIL.

- [ ] **Step 2: Rewrite the page**

Replace the full contents of `app/(marketing)/plugins/divi-to-elementor/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';
import { STATS } from '@/lib/site/stats';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

export const metadata: Metadata = {
  title: 'Divi to Elementor Converter — free WordPress plugin (pending review)',
  description:
    'Convert Divi pages and templates to Elementor — 35+ modules mapped, batch conversion, all three Divi export formats. Free plugin pending wordpress.org review; join the waitlist to be notified the moment it ships.',
};

// Batch mock: what a run over a small site looks like.
const BATCH_ROWS = [
  { page: 'Home', status: 'done' },
  { page: 'About', status: 'done' },
  { page: 'Services', status: 'done' },
  { page: 'Pricing', status: 'running' },
  { page: 'Contact', status: 'queued' },
];

const USE_CASES = [
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Inherited a portfolio of Divi sites but standardized on Elementor. Batch runs turn each handover into an afternoon.',
  },
  {
    icon: 'storefront',
    title: 'The shop owner',
    body: 'The new team works in Elementor. WooCommerce modules map to their widget equivalents (Pro), so the store keeps selling.',
  },
  {
    icon: 'handyman',
    title: 'The freelancer',
    body: 'Takes rescue projects in either builder. One converter each way means never turning down a migration.',
  },
];

const FAQ = [
  {
    question: 'When will the free plugin be available?',
    answer: "It's submitted to wordpress.org and awaiting review. We'll email the waitlist the moment it's approved and live.",
  },
  {
    question: 'Will there be a Pro version?',
    answer: 'Yes — Pro launches after the free plugin is approved, at $49/yr for unlimited sites, with Theme Builder templates and WooCommerce support.',
  },
  {
    question: 'Which Divi export formats work?',
    answer: 'All three — Divi Library JSON, portability exports, and raw post content. The converter detects the format automatically.',
  },
  {
    question: 'What about Divi Theme Builder templates?',
    answer: 'Headers, footers, and templates convert to Elementor Theme Builder equivalents in Pro. The free plugin covers page content.',
  },
  {
    question: 'What happens to modules without a mapping?',
    answer: `${STATS.diviModulesMapped}+ Divi modules have dedicated mappings. Anything exotic is preserved as an HTML widget and flagged in the conversion report — nothing is silently dropped.`,
  },
  {
    question: 'Does it modify my Divi site?',
    answer: 'No. You export from Divi and import into the Elementor site. The source site stays untouched for side-by-side comparison.',
  },
];

function BatchStatus({ status }: { status: string }) {
  if (status === 'done') return <span className="flex items-center gap-1.5 font-mono text-small text-green-600"><Icon name="check" size={15} /> converted</span>;
  if (status === 'running') return <span className="font-mono text-small text-action">converting…</span>;
  return <span className="font-mono text-small text-muted">queued</span>;
}

export default function D2EPage() {
  return (
    <main>
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero + waitlist */}
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <h1 className="max-w-3xl text-h1 text-navy">Convert Divi to Elementor — the whole site, in batches.</h1>
          <p className="mt-4 max-w-2xl text-lead text-muted">
            {STATS.diviModulesMapped}+ Divi modules mapped to their Elementor equivalents, every Divi export format
            supported, and a conversion report for every run. The same converter craft as our flagship — pointed the
            other way.
          </p>
          <Card className="mt-8 max-w-2xl border-amber-200 bg-amber-50 p-8">
            <p className="text-body text-navy">
              The free plugin is submitted and <strong>pending wordpress.org review</strong>. Leave your email and
              we&apos;ll tell you the moment it&apos;s approved — waitlist members hear first, including about Pro.
            </p>
            <div className="mt-4">
              <WaitlistForm source="divi_to_elementor_waitlist" cta="Notify me" />
            </div>
          </Card>
        </Container>
      </section>

      {/* Batch demo */}
      <section className="py-20">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-h2 text-navy">Point it at pages, not paragraphs</h2>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Select every page that should move and run one batch. Each page gets converted, reported on, and
                saved as an Elementor draft for review — you approve, it publishes.
              </p>
            </div>
            <Card className="p-6">
              <p className="text-small font-semibold uppercase tracking-wide text-muted">Batch run — 5 pages</p>
              <ul className="mt-3 divide-y divide-border">
                {BATCH_ROWS.map((r) => (
                  <li key={r.page} className="flex items-center justify-between py-2.5">
                    <span className="text-body text-navy">{r.page}</span>
                    <BatchStatus status={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </Container>
      </section>

      {/* Free vs Pro (planned) */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Free now (pending review), Pro after launch</h2>
          <ComparisonTable
            className="mt-8"
            caption="Divi to Elementor Converter — Free vs planned Pro"
            columns={['Free', 'Pro — $49/yr (after launch)']}
            rows={[
              { label: `${STATS.diviModulesMapped}+ module mappings`, values: [true, true] },
              { label: 'All three Divi export formats', values: [true, true] },
              { label: 'Batch conversion', values: [true, true] },
              { label: 'Conversion report per run', values: [true, true] },
              { label: 'Divi Theme Builder templates', values: [false, true] },
              { label: 'WooCommerce module → widget mapping', values: [false, true] },
              { label: 'Support', values: ['Community', 'Priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro pricing and scope may be refined at launch — waitlist members hear first."
          />
        </Container>
      </section>

      {/* Use cases */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Who converts this direction</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Be first through the door."
        body="The waitlist hears the moment wordpress.org approves the free plugin — and gets launch pricing on Pro."
        cta={{ label: 'Join the waitlist', href: '#top' }}
        secondary={{ label: 'See all plugins', href: '/plugins' }}
      />
    </main>
  );
}
```

Note: the closing CTA links `#top` — add `id="top"` to the hero `<section>` (first section) so the anchor lands on the waitlist form: `<section id="top" className="border-b border-border bg-mist py-16">`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/plugin-d2e-page.test.tsx`
Expected: PASS — H1 still matches `/Divi.*Elementor/i`, "pending wordpress.org review" and the "Notify me" button are intact.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/plugins/divi-to-elementor/page.tsx tests/plugin-d2e-page.test.tsx
git commit -m "feat(d2e): waitlist-first landing rebuild — batch demo, planned-Pro table, deep FAQ"
```

---

### Task 14: AI Editor page rebuild

**Files:**
- Modify: `app/(marketing)/plugins/divi-5-ai-editor/page.tsx` (full rewrite below)
- Test: modify `tests/plugin-ai-editor-page.test.tsx`

**Interfaces:**
- Consumes: `STATS` (2), `StatStrip` (3), `ValidatorChatDemo` (5), `ComparisonTable` (7), `CtaBand` (8), `UseCaseVignettes` (9), existing `BuyProButton`, `FreeDownloadForm`, `JsonLd`, `productJsonLd`, `faqJsonLd`. Keep H1 matching `/AI Editor/i` and metadata description matching `/validat/i` (existing test contract).

- [ ] **Step 1: Extend the test (failing)**

Add inside the existing describe in `tests/plugin-ai-editor-page.test.tsx` (keep the file's existing render convention):

```tsx
  it('shows the live chat demo with a self-correction', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/WRONG_FIELD_TYPE/)).toBeTruthy();
  });
  it('lists compatible assistants', () => {
    render(<AiEditorPage />);
    // getAllBy: assistants appear in the hero "Works with" line and the FAQ.
    expect(screen.getAllByText(/claude desktop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cursor/i).length).toBeGreaterThan(0);
  });
  it('renders Free vs Pro as a comparison table with the free download form', () => {
    render(<AiEditorPage />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText(/create pages from scratch/i)).toBeTruthy();
  });
  it('has an expanded FAQ', () => {
    render(<AiEditorPage />);
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(8);
  });
```

Run: `npx vitest run tests/plugin-ai-editor-page.test.tsx` — Expected: new tests FAIL.

- [ ] **Step 2: Rewrite the page**

Replace the full contents of `app/(marketing)/plugins/divi-5-ai-editor/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { productJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { FreeDownloadForm } from '@/components/plugins/FreeDownloadForm';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { ValidatorChatDemo, type ChatStep } from '@/components/marketing/ValidatorChatDemo';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';
import { CtaBand } from '@/components/marketing/CtaBand';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

const PRODUCT_NAME = 'AI Editor for Divi 5';
const PRODUCT_DESCRIPTION =
  'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database — broken layouts are impossible. Free tier edits existing pages; Pro unlocks page creation, menus, and site-wide styling.';

export const metadata: Metadata = {
  // Root layout's title.template appends "| Divi5Lab".
  title: 'AI Editor for Divi 5 — edit Divi with AI, validated',
  description:
    'Connect Claude, Cursor, or ChatGPT to your Divi 5 site and edit pages in plain English. Every change passes a deterministic validator before it touches your database — broken layouts are impossible.',
  alternates: { canonical: `${env.NEXT_PUBLIC_SITE_URL}/plugins/divi-5-ai-editor` },
};

const DEMO_STEPS: ChatStep[] = [
  { role: 'user', text: 'Add a three-column pricing section under the hero on the Services page.' },
  { role: 'assistant', text: 'get_section_recipes(type: "pricing") → update_page_layout(page: "Services", …)' },
  { role: 'validator-fail', text: 'WRONG_FIELD_TYPE — divi/pricing-tables “featured” must be an object, got boolean' },
  { role: 'assistant', text: 'Correcting the attribute shape from the violation, re-submitting…' },
  { role: 'validator-pass', text: 'Valid — 21 blocks, 0 violations. Saved to “Services”.' },
];

const ASSISTANTS = ['Claude Desktop', 'Claude Code', 'Cursor', 'Windsurf', 'VS Code Copilot', 'ChatGPT (Actions)'];

const USE_CASES = [
  {
    icon: 'edit_note',
    title: 'The content editor',
    body: 'Updates hero copy, swaps testimonials, adjusts CTAs — in chat, without opening the builder or fearing the layout.',
  },
  {
    icon: 'business_center',
    title: 'The agency',
    body: 'Ships client change requests from the assistant they already pay for. The validator is the QA step that never sleeps.',
  },
  {
    icon: 'terminal',
    title: 'The developer',
    body: 'Automates page assembly from specs via MCP. Deterministic verdicts make AI output safe to pipeline.',
  },
];

const FAQ = [
  {
    question: 'Which AI assistants work?',
    answer:
      'Claude Desktop, Claude Code, Cursor, Windsurf, and VS Code Copilot connect via MCP. ChatGPT connects via OpenAPI actions. Any HTTP client can call the API directly.',
  },
  {
    question: 'Do I need an AI subscription?',
    answer:
      'Yes — bring your own assistant. The plugin adds the tools and the safety net (the validator); your assistant supplies the AI.',
  },
  {
    question: 'Can the AI break my site?',
    answer: `No layout reaches your database without a passing verdict — ${STATS.validatorViolationClasses} violation classes checked across ${STATS.validatorBlockTypes} Divi 5 block types. An edit either validates or it doesn't save.`,
  },
  {
    question: 'What does the validator actually check?',
    answer:
      'Block types, required attributes, attribute shapes, and nesting rules — the full Divi 5 schema, derived from real exports. Same input, same verdict, every time.',
  },
  {
    question: 'What can the free version do?',
    answer:
      'Read and update existing pages, dry-run validation, and all the guides (style, landing, image, site) plus section recipes. Pro adds page creation, menus, front-page control, site-wide CSS, and reviewed PHP proposals.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Premium features keep working on sites where Pro is already activated. Renewal covers updates and support.',
  },
  {
    question: 'How many sites?',
    answer: 'Unlimited — one Pro license activates on as many sites as you own or build for clients.',
  },
  {
    question: 'Is my site data sent to Divi5Lab?',
    answer: 'No. Your assistant talks directly to your WordPress site over its API. We never see your content; the license server only checks activation.',
  },
];

export default function AiEditorPage() {
  const site = env.NEXT_PUBLIC_SITE_URL;
  const url = `${site}/plugins/divi-5-ai-editor`;

  return (
    <main>
      <JsonLd
        data={productJsonLd({
          name: PRODUCT_NAME,
          description: PRODUCT_DESCRIPTION,
          url,
          offer: { priceCents: 7900, currency: 'USD' },
        })}
      />
      <JsonLd data={faqJsonLd(FAQ)} />

      {/* Hero + demo */}
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-h1 text-navy">The AI Editor for Divi 5</h1>
              <p className="mt-4 max-w-xl text-lead text-muted">
                Connect Claude, Cursor, or ChatGPT to your site and edit pages in plain English. Every change
                passes a deterministic validator before it touches your database — broken layouts are impossible.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />
                <a
                  href="#free"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
                >
                  Try it free
                </a>
              </div>
              <p className="mt-6 text-small font-medium text-muted">
                Works with: {ASSISTANTS.join(' · ')}
              </p>
            </div>
            <ValidatorChatDemo steps={DEMO_STEPS} />
          </div>
        </Container>
      </section>

      {/* The safety mechanism */}
      <section className="py-20">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-small font-semibold uppercase tracking-wide text-action">Why it&apos;s safe</p>
            <h2 className="mt-3 text-h2 text-navy">AI drafts. The validator decides.</h2>
            <p className="mt-4 text-lead text-muted">
              Language models are confident even when they&apos;re wrong — so we never trust one with your database.
              Every proposed layout is checked block by block against the real Divi 5 schema. Invalid edits bounce
              back with exact violation codes, and the assistant fixes its own mistake before you ever see it.
            </p>
          </div>
          <StatStrip
            className="mt-12"
            stats={[
              { value: String(STATS.validatorBlockTypes), label: 'Divi 5 block types modeled' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
              { value: '100%', label: 'of saves validated first' },
            ]}
          />
        </Container>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Three steps to your first AI edit</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { title: 'Connect', body: "Paste the API key from the AI Editor menu in wp-admin into your assistant's MCP config. Two minutes, once." },
              { title: 'Instruct', body: '“Change the hero heading on Home to…” — describe the change the way you would to a colleague.' },
              { title: 'Validated & saved', body: 'The validator checks every block, attribute, and nesting rule. Invalid? Exact violations come back and the AI self-corrects.' },
            ].map((s, i) => (
              <Card key={s.title} className="p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog font-semibold text-action">{i + 1}</div>
                <h3 className="mt-4 text-section text-navy">{s.title}</h3>
                <p className="mt-2 text-body text-muted">{s.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Free vs Pro */}
      <section id="free" className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">What your assistant can do — today vs. with Pro</h2>
          <ComparisonTable
            className="mt-8"
            caption="AI Editor for Divi 5 — Free vs Pro"
            columns={['Free', 'Pro — $79/yr']}
            rows={[
              { label: 'List pages & read layouts', values: [true, true] },
              { label: 'Update existing pages', values: [true, true] },
              { label: 'Dry-run validation', values: [true, true] },
              { label: 'Style, landing, image & site guides', values: [true, true] },
              { label: 'Section recipes', values: [true, true] },
              { label: 'Create pages from scratch', values: [false, true] },
              { label: 'Set the front page', values: [false, true] },
              { label: 'Build the primary menu', values: [false, true] },
              { label: 'Site-wide custom CSS', values: [false, true] },
              { label: 'Reviewed PHP proposals', values: [false, true] },
              { label: 'Updates & support', values: ['—', 'WP-native updates + priority'] },
              { label: 'Sites', values: ['Unlimited', 'Unlimited'] },
            ]}
            footnote="Pro keeps working on activated sites even if the license lapses — renewal covers updates and support."
          />
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
            <Card className="p-8">
              <h3 className="text-section text-navy">Start free</h3>
              <p className="mt-2 text-body text-muted">Edit and validate existing pages, all guides included. Direct download — no account needed.</p>
              <div className="mt-6">
                <FreeDownloadForm product="ai-editor-divi5-pro" />
              </div>
            </Card>
            <Card className="relative border-action p-8 shadow-lg ring-1 ring-action">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
                One license, unlimited sites
              </span>
              <h3 className="text-section text-navy">Go Pro</h3>
              <p className="mt-2 text-body text-muted">
                Whole-page creation, menus, front-page control, and site-wide styling — the full toolset for
                building with AI, not just editing.
              </p>
              <div className="mt-6">
                <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />
              </div>
            </Card>
          </div>
        </Container>
      </section>

      {/* Use cases */}
      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Who edits with it</h2>
          <UseCaseVignettes className="mt-8" items={USE_CASES} />
        </Container>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <Container>
          <h2 className="text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Your assistant already knows Divi. Now it can prove it."
        body="Free to try on any Divi 5 site — Pro when you want it building pages, menus, and site-wide styles."
        cta={{ label: 'Get Pro — $79/yr', href: '/pricing' }}
        secondary={{ label: 'Read the setup guides', href: '/guides' }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/plugin-ai-editor-page.test.tsx`
Expected: PASS — H1 still matches `/AI Editor/i`; metadata description still matches `/validat/i`.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/plugins/divi-5-ai-editor/page.tsx tests/plugin-ai-editor-page.test.tsx
git commit -m "feat(ai-editor): landing rebuild — hero demo, safety mechanism, tool table, deep FAQ"
```

---

### Task 15: Pricing page rebuild

**Files:**
- Modify: `app/(catalog)/pricing/page.tsx` (full rewrite below)
- Test: modify `tests/pricing-page.test.tsx`

**Interfaces:**
- Consumes: `STATS` (2), `CtaBand` (8), existing `BuyProButton`, `JsonLd`, `faqJsonLd`, `SectionTitle`.
- Existing test contract to keep: shows `Elementor → Divi 5 Pro`, `$49`, `buy-elementor-to-divi5-pro` testid, `coming soon` for D→E (no buy button), `free divi 5 layouts`, FAQ JSON-LD, and **no** `all-access|membership` text.

- [ ] **Step 1: Extend the test (failing)**

Add inside the existing describe in `tests/pricing-page.test.tsx`:

```tsx
  it('tells the license philosophy once', async () => {
    render(await PricingPage());
    expect(screen.getByText(/licenses that respect you/i)).toBeTruthy();
    expect(screen.getByText(/nothing breaks/i)).toBeTruthy();
  });
  it('shows the AI Editor at $79', async () => {
    render(await PricingPage());
    expect(screen.getAllByText(/\$79/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('buy-ai-editor-divi5-pro')).toBeTruthy();
  });
```

Run: `npx vitest run tests/pricing-page.test.tsx` — Expected: new tests FAIL.

- [ ] **Step 2: Rewrite the page**

Replace the full contents of `app/(catalog)/pricing/page.tsx`:

```tsx
// app/(catalog)/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'Pricing — Pro plugin licenses',
  description:
    'Simple pricing for the Divi 5 plugin toolkit. Free plugins and free layouts to start; Pro licenses from $49/yr on unlimited sites — and nothing breaks if you stop paying.',
};

const FAQ = [
  {
    question: 'What does Pro include?',
    answer:
      'Each plugin has its own Pro: the Elementor→Divi 5 converter adds full kit ZIP import, Theme Builder headers/footers, and global styles; the AI Editor adds page creation, menus, and site-wide styling. Both include a year of updates and priority support.',
  },
  {
    question: 'Do licenses cover client sites?',
    answer: 'Yes — every Pro license activates on unlimited sites, whether they are yours or built for clients.',
  },
  {
    question: "What happens if I don't renew?",
    answer: 'Pro keeps working on every site where it is already activated. You just stop receiving new updates and support until you renew. No hostage access.',
  },
  {
    question: 'Are the layouts really free?',
    answer: 'Yes — every layout in our catalog is free to download. Drop your email and grab as many as you like.',
  },
  {
    question: 'Can I try before buying?',
    answer: 'Always. Every product has a working free tier — free single-page conversions, a free AI Editor download, and a fully free layout catalog.',
  },
  {
    question: 'Is there a refund policy?',
    answer: 'If a Pro plugin does not work for your project and support cannot fix it, contact us within 14 days of purchase for a refund.',
  },
  {
    question: 'How is payment handled?',
    answer: 'Checkout runs on Stripe with tax handled automatically. Licenses are delivered instantly by email and manageable from your account.',
  },
  {
    question: 'When does Divi → Elementor Pro launch?',
    answer: 'After the free plugin clears wordpress.org review. Join the waitlist on its page — members hear first and get launch pricing.',
  },
];

const TOOLKIT = [
  {
    name: 'Elementor → Divi 5 Pro',
    price: '$49',
    per: '/yr',
    tagline: 'The full migration toolkit for moving Elementor sites to Divi 5.',
    freeTier: `Free plugin: unlimited single-page conversions, ${STATS.elementorWidgetsMapped} widget mappings, conversion reports.`,
    proTier: 'Pro: full kit ZIP import, Theme Builder headers/footers, global colors & typography.',
    action: <BuyProButton product="elementor-to-divi5-pro" label="Get Pro — $49/yr" />,
    href: '/plugins/elementor-to-divi-5',
    highlight: true,
  },
  {
    name: 'AI Editor for Divi 5 Pro',
    price: '$79',
    per: '/yr',
    tagline: 'Let your AI assistant build pages, menus and site-wide styling — every change validated.',
    freeTier: 'Free download: edit and validate existing pages, all guides and recipes included.',
    proTier: 'Pro: create pages from scratch, front page, menus, site-wide CSS, reviewed PHP.',
    action: <BuyProButton product="ai-editor-divi5-pro" label="Get Pro — $79/yr" />,
    href: '/plugins/divi-5-ai-editor',
    highlight: false,
  },
  {
    name: 'Divi → Elementor Pro',
    price: 'Coming soon',
    per: '',
    tagline: `Batch conversions the other way — ${STATS.diviModulesMapped}+ modules mapped.`,
    freeTier: 'Free plugin pending wordpress.org review — batch conversion, all Divi export formats.',
    proTier: 'Pro (after launch): Theme Builder templates, WooCommerce mapping — $49/yr.',
    action: (
      <Link
        href="/plugins/divi-to-elementor"
        className="flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
      >
        Get notified
      </Link>
    ),
    href: '/plugins/divi-to-elementor',
    highlight: false,
  },
];

export default async function PricingPage() {
  return (
    <main>
      <section className="border-b border-border bg-mist py-16">
        <Container>
          <SectionTitle eyebrow="Pricing" title="Licenses that respect you">
            Free tiers on everything. Pro from $49/yr on unlimited sites — and when a license lapses,
            nothing breaks: activated sites keep working. Renewal buys updates and support, not hostage access.
          </SectionTitle>
        </Container>
      </section>

      <section className="py-16">
        <Container>
          <div className="grid items-stretch gap-6 lg:grid-cols-3">
            {TOOLKIT.map((p) => (
              <Card
                key={p.name}
                className={`relative flex flex-col p-8 ${p.highlight ? 'border-action shadow-lg ring-1 ring-action' : ''}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-action px-3 py-1 text-small font-semibold text-paper">
                    Most popular
                  </span>
                )}
                <h2 className="text-section text-navy">{p.name}</h2>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={p.per ? 'text-h2 text-navy' : 'text-h3 text-navy'}>{p.price}</span>
                  {p.per && <span className="text-small text-muted">{p.per}</span>}
                </div>
                <p className="mt-2 text-body text-muted">{p.tagline}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" /> {p.freeTier}
                  </li>
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="workspace_premium" size={18} className="mt-0.5 shrink-0 text-action" /> {p.proTier}
                  </li>
                </ul>
                <div className="mt-8 flex flex-col gap-2">
                  {p.action}
                  <Link href={p.href} className="text-center text-small font-semibold text-action hover:underline">
                    Full details
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-8 flex flex-col gap-3 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-section text-navy">Free Divi 5 layouts</h2>
              <p className="mt-2 max-w-xl text-body text-muted">
                Every layout in our catalog — {STATS.freeLayoutsPublished}+ validated sections and pages — is free.
                Grab as many as you like.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/free-divi-layouts"
                className="flex h-12 items-center justify-center rounded-full bg-action px-8 text-body font-semibold text-paper transition hover:brightness-110"
              >
                Get free layouts
              </Link>
              <Link
                href="/browse"
                className="flex h-12 items-center justify-center rounded-full border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:border-action hover:text-action"
              >
                Browse the catalog
              </Link>
            </div>
          </Card>
        </Container>
      </section>

      <section className="border-t border-border bg-mist py-20">
        <Container>
          <h2 className="text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-8 max-w-3xl space-y-6">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <CtaBand
        title="Try everything free first."
        body="Free conversions, a free AI Editor, a free layout catalog — upgrade when the tools have already earned it."
        cta={{ label: 'Browse the plugins', href: '/plugins' }}
      />

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/pricing-page.test.tsx`
Expected: PASS — all pre-existing assertions (`Elementor → Divi 5 Pro`, `$49`, coming-soon D→E without buy button, free layouts, FAQ JSON-LD, no membership) plus the two new ones.

- [ ] **Step 4: Commit**

```bash
git add app/\(catalog\)/pricing/page.tsx tests/pricing-page.test.tsx
git commit -m "feat(pricing): toolkit table + license-philosophy rebuild"
```

---

### Task 16: About page rebuild

**Files:**
- Modify: `app/(marketing)/about/page.tsx` (full rewrite below)
- Test: modify `tests/about-page.test.tsx`

**Interfaces:**
- Consumes: `STATS` (2), `StatStrip` (3), `CtaBand` (8), existing `Container`.

- [ ] **Step 1: Extend the test (failing)**

Replace the full contents of `tests/about-page.test.tsx`:

```tsx
// tests/about-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from '@/app/(marketing)/about/page';

describe('AboutPage', () => {
  it('renders the brand and the origin story', () => {
    render(<AboutPage />);
    expect(screen.getAllByText(/Divi5Lab/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText(/same input, same verdict/i)).toBeTruthy();
  });
  it('shows the proving-ground numbers', () => {
    render(<AboutPage />);
    expect(screen.getByText(/free layouts shipped/i)).toBeTruthy();
  });
  it('credits JHMG', () => {
    render(<AboutPage />);
    expect(screen.getByText(/JHMG/)).toBeTruthy();
  });
});
```

Run: `npx vitest run tests/about-page.test.tsx` — Expected: FAIL (old page).

- [ ] **Step 2: Rewrite the page**

Replace the full contents of `app/(marketing)/about/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { STATS } from '@/lib/site/stats';
import { StatStrip } from '@/components/marketing/StatStrip';
import { CtaBand } from '@/components/marketing/CtaBand';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Divi5Lab builds migration converters, an AI editor, and free layouts for Divi 5 — all gated by one deterministic validator. Same input, same verdict.',
};

export default function AboutPage() {
  return (
    <main>
      <section className="border-b border-border bg-mist py-16">
        <Container className="max-w-3xl">
          <h1 className="text-h1 text-navy">The lab behind the validator.</h1>
          <p className="mt-5 text-lead text-muted">
            Divi5Lab exists because of one stubborn observation: converters and AI both produce confident,
            broken page-builder markup — and nobody finds out until after the import.
          </p>
        </Container>
      </section>

      <section className="py-16">
        <Container className="max-w-3xl space-y-12">
          <div>
            <h2 className="text-section text-navy">The problem we kept hitting</h2>
            <p className="mt-3 text-body text-muted">
              We build WordPress sites for a living. Every migration meant the same choice: weeks of manual
              rebuilding, or a converter whose output half-rendered — collapsed sections, invented attributes,
              nesting Divi never allowed. AI made it worse, not better: language models generate page-builder
              markup fluently and wrongly at the same time.
            </p>
          </div>

          <div>
            <h2 className="text-section text-navy">Same input, same verdict</h2>
            <p className="mt-3 text-body text-muted">
              So we built a deterministic validator: a strict schema of {STATS.validatorBlockTypes} Divi 5 block
              types — every attribute, every nesting rule — derived from real Divi 5 exports, not documentation.
              It isn&apos;t a linter and it doesn&apos;t have opinions. Feed it a layout twice and you get the same
              verdict twice, with exact violation codes. Everything we ship passes through it: converted pages,
              AI edits, generated layouts. No passing verdict, no publish. That&apos;s the whole trust model.
            </p>
          </div>

          <div>
            <h2 className="text-section text-navy">The proving ground</h2>
            <p className="mt-3 text-body text-muted">
              The <Link href="/browse" className="text-action hover:underline">free layout catalog</Link> is where
              the validator earns its keep: hundreds of layouts generated, validated, rendered, screenshotted, and
              shipped by the same pipeline our tools use. When a rule is wrong, the catalog finds it before you do.
              That&apos;s also why the layouts are free — they&apos;re the lab notes, published.
            </p>
          </div>

          <StatStrip
            className="justify-start"
            stats={[
              { value: `${STATS.freeLayoutsPublished}+`, label: 'free layouts shipped' },
              { value: String(STATS.elementorWidgetsMapped), label: 'widget types mapped' },
              { value: String(STATS.validatorViolationClasses), label: 'violation classes checked' },
            ]}
          />

          <div>
            <h2 className="text-section text-navy">Who we are</h2>
            <p className="mt-3 text-body text-muted">
              Divi5Lab is built by <span className="font-semibold text-navy">JHMG</span>, a small team that has
              shipped WordPress sites for agencies and businesses for years. We&apos;d rather publish a validator
              verdict than a promise — if a tool of ours says a layout imports clean, that claim was checked by a
              machine, not a copywriter.
            </p>
          </div>
        </Container>
      </section>

      <CtaBand
        title="Kick the tires, free."
        body="Browse the catalog, convert a page, or wire your AI assistant to a test site — every product has a free tier."
        cta={{ label: 'See the plugins', href: '/plugins' }}
        secondary={{ label: 'Browse free layouts', href: '/browse' }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/about-page.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/\(marketing\)/about/page.tsx tests/about-page.test.tsx
git commit -m "feat(about): origin-story rebuild — validator trust model + proving ground"
```

---

### Task 17: License, Contact, and Guides-index polish

**Files:**
- Modify: `app/(marketing)/license/page.tsx` (add plain-English summary cards above the license text)
- Modify: `app/(marketing)/contact/page.tsx` (reassurance copy)
- Modify: `app/(marketing)/guides/page.tsx` (intro copy only)
- Test: create `tests/license-page.test.tsx`

**Interfaces:**
- Consumes: existing `readLicense`, `REFUND_POLICY`, `ContactForm`, `SUPPORT_EMAIL`/`SALES_EMAIL`, `listGuides`.

- [ ] **Step 1: Write the failing license test**

```tsx
// tests/license-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LicensePage from '@/app/(marketing)/license/page';

describe('LicensePage', () => {
  it('summarizes the license in plain English before the full text', () => {
    render(<LicensePage />);
    // getAllBy: these phrases also appear inside the full license text <pre>.
    expect(screen.getAllByText(/unlimited sites/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/client/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no resale/i).length).toBeGreaterThan(0);
  });
  it('still renders the full license text and refund policy', () => {
    render(<LicensePage />);
    expect(document.querySelector('pre')).toBeTruthy();
    expect(screen.getAllByText(/refund/i).length).toBeGreaterThan(0);
  });
});
```

Run: `npx vitest run tests/license-page.test.tsx` — Expected: FAIL (no summary cards yet).

- [ ] **Step 2: Rewrite the license page**

Replace the full contents of `app/(marketing)/license/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { readLicense } from '@/lib/license';
import { REFUND_POLICY } from '@/lib/legal/refund';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'License & Refunds',
  description: 'The commercial license that comes with every Divi5Lab purchase, plus our digital-goods refund policy.',
};

const SUMMARY = [
  { ok: true, title: 'Unlimited sites', body: 'Use what you buy on any site you own.' },
  { ok: true, title: 'Client work', body: 'Build for clients — no extra seats, no per-site fees.' },
  { ok: true, title: 'Keeps working', body: 'A lapsed license never breaks an activated site.' },
  { ok: false, title: 'No resale', body: 'Don’t sell or license the files themselves.' },
  { ok: false, title: 'No redistribution', body: 'Don’t republish downloads as your own library.' },
];

export default function LicensePage() {
  const license = readLicense();
  return (
    <main className="py-16">
      <Container className="max-w-3xl">
        <h1 className="text-h1 text-navy">License</h1>
        <p className="mt-3 text-body text-muted">
          One simple commercial license covers every purchase. The plain-English version first; the binding text
          below is also bundled inside every download.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SUMMARY.map((s) => (
            <Card key={s.title} className="flex items-start gap-3 p-5">
              <Icon
                name={s.ok ? 'check_circle' : 'block'}
                size={20}
                className={`mt-0.5 shrink-0 ${s.ok ? 'text-green-600' : 'text-red-500'}`}
              />
              <div>
                <h2 className="text-body font-semibold text-navy">{s.title}</h2>
                <p className="mt-0.5 text-small text-muted">{s.body}</p>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 text-section text-navy">The full text</h2>
        <Card className="mt-4 p-6">
          <pre className="whitespace-pre-wrap font-sans text-small leading-relaxed text-navy">{license}</pre>
        </Card>

        <h2 className="mt-12 text-section text-navy">Refunds</h2>
        <p className="mt-3 text-body text-muted">{REFUND_POLICY}</p>
      </Container>
    </main>
  );
}
```

- [ ] **Step 3: Polish the contact page copy**

In `app/(marketing)/contact/page.tsx`, replace the `<p>` block under the H1 with:

```tsx
        <p className="mt-3 text-body text-muted">
          A human reads every message — usually within one business day. For support, include your site&apos;s
          WordPress and plugin versions and (for conversions) the export file that misbehaved; you&apos;ll skip a
          round-trip. Email works too:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-action hover:underline">{SUPPORT_EMAIL}</a> for support,{' '}
          <a href={`mailto:${SALES_EMAIL}`} className="text-action hover:underline">{SALES_EMAIL}</a> for sales and licensing.
        </p>
```

- [ ] **Step 4: Polish the guides-index intro**

In `app/(marketing)/guides/page.tsx`, replace the intro `<p>` under the H1 with:

```tsx
        <p className="mt-4 max-w-2xl text-body text-muted">
          The lab notebook, published. Everything here comes from building and validating hundreds of Divi 5
          layouts: import walkthroughs, migration checklists, honest builder comparisons, and the design rules our
          own generator has to follow.
        </p>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/license-page.test.tsx tests/guides.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(marketing\)/license/page.tsx app/\(marketing\)/contact/page.tsx app/\(marketing\)/guides/page.tsx tests/license-page.test.tsx
git commit -m "feat(marketing): license summary cards + contact/guides copy polish"
```

---

### Task 18: Full verification + eyeball pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all suites pass (was 730+ tests before this work; now more). Zero failures.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; no missing-import or RSC/client-boundary errors.

- [ ] **Step 4: Eyeball pass (mandatory per project practice)**

```bash
npm run dev
```

Visit and visually inspect each page at desktop AND ~375px width:
`/`, `/plugins`, `/plugins/elementor-to-divi-5`, `/plugins/divi-to-elementor`, `/plugins/divi-5-ai-editor`, `/pricing`, `/about`, `/contact`, `/license`, `/guides`.

Checklist per page: no horizontal overflow (tables scroll in their own container); ValidatorChatDemo animates once and settles; MappingPanel rows stagger in; dark bands (`bg-ink`) have readable contrast; all CTAs navigate; no Blob-hosted image anywhere (Network tab: zero requests to `*.blob.vercel-storage.com`).

Also verify reduced motion: in DevTools → Rendering → "Emulate CSS prefers-reduced-motion", reload `/` and `/plugins/divi-5-ai-editor` — chat demo shows all steps immediately, mapping rows don't animate.

- [ ] **Step 5: Final commit (if eyeball fixes were needed) and report**

Show the user: test summary output, build output tail, and screenshots or a summary of the eyeball pass. Do NOT deploy — `git push origin main` deploys to prod and needs Lucas's explicit go (per operating agreement).

---

## Self-Review Notes

- **Spec coverage:** every spec section maps to a task — homepage 8 bands (T10), plugin skeletons + centerpieces (T12–14), pricing table + philosophy (T15), about story (T16), hub decision strip (T11), license/contact/guides (T17), shared components (T3–9), real stats (T1–2), verification (T18).
- **Deliberate deviations from spec wording:** (a) the pricing "3-column product table" is implemented as three tier cards + per-plugin comparison tables on product pages — a literal 3-product × free/pro matrix duplicated the per-product tables and reads worse on mobile; the license philosophy, unified pricing view, and free-layouts row are all preserved. (b) "Homepage motif" for MappingPanel is inlined in ProductDoors rather than reusing the full component (different scale).
- **Type consistency check:** `ChatStep` exported from `ValidatorChatDemo` (T5) and imported in T10/T14; `STATS` keys used in pages match T2 exactly; `WIDGET_MAPPING_GROUPS`/`WIDGET_TYPES_MAPPED` (T1) used in T12; `ComparisonTable` `rows.values` accepts `boolean | string` everywhere.
- **Test-contract check:** all pre-existing regexes listed in Global Constraints are satisfied by the new copy (verified per task).
- **jsdom gotchas handled:** `window.matchMedia` does not exist in jsdom and there is no setup stub — `ValidatorChatDemo` treats a missing `matchMedia` as "show the finished transcript", so page tests need no mocks. Phrases that appear in more than one element (stat labels, "conversion report", assistant names, license summary terms) are asserted with `getAllByText(...).length`, never `getByText`.
