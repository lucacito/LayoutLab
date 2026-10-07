import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { PageHero } from '@/components/marketing/PageHero';
import { Icon } from '@/components/ui/Icon';
import { JsonLd } from '@/components/JsonLd';
import { faqJsonLd } from '@/lib/seo/jsonld';
import { BuyProButton } from '@/components/plugins/BuyProButton';
import { STATS } from '@/lib/site/stats';
import { CtaBand } from '@/components/marketing/CtaBand';
import { FREE_PLUGIN_LINKS, freePluginAnchorProps } from '@/lib/site/free-downloads';
import { PRICING, OFFER, formatUsd, lowestTier, isPriceEnvSet, isCouponEnvSet, siteLabel } from '@/lib/pricing/config';
import { getAvailability } from '@/lib/pricing/availability';
import { WaitlistForm } from '@/components/plugins/WaitlistForm';

export const metadata: Metadata = {
  title: 'Pricing: AI Editor for Divi 5 Pro and Converters',
  description: `AI Editor for Divi 5 Pro from ${formatUsd(lowestTier().priceCents)}/yr by number of sites, with a ${OFFER.trialDays}-day free trial. The plugin is free. Converter Pro from $25/yr.`,
  alternates: { canonical: '/pricing' },
  openGraph: { type: 'website', url: '/pricing', title: 'Pricing: AI Editor for Divi 5 Pro and Converters' },
};

// The founding and lifetime counters and the buy buttons depend on the database and on the Stripe env, so this page
// is rendered per request, never frozen at build time.
export const dynamic = 'force-dynamic';

function buildFaq(foundingOpen: boolean) {
  const unlimited = PRICING.tiers.filter((t) => t.sites === null).map((t) => t.label);
  return [
  {
    question: 'What does the AI Editor Pro add-on include?',
    answer:
      'Seventeen advanced tools: set the front page and primary menu, publish pages, add custom CSS, propose PHP, edit the live Divi header and footer, find and replace text across your site, audit for problems and broken links, create and edit your global colors, variables and presets, and build a whole Divi 5 site in one undoable step. Each edit the plugin saves can be undone from the page history. The free plugin has 17 tools for reading, editing and creating pages.',
  },
  {
    question: 'Does an AI Editor Pro licence include your other plugins?',
    answer:
      'No. Each plugin is licensed separately. An AI Editor Pro licence covers the AI Editor Pro add-on on as many WordPress sites as your plan allows.',
  },
  {
    question: 'What if my license expires?',
    answer:
      `Pro keeps working on every site where it is already activated. You just stop receiving new updates and support until you renew. No hostage access. Renewal reminders are sent ${PRICING.renewalReminderDays.join(' and ')} days before your renewal.`,
  },
  {
    question: 'How many sites does each tier cover?',
    answer: `${PRICING.tiers.map((t) => `${t.label}: ${siteLabel(t).toLowerCase()}`).join('. ')}. Upgrade between tiers any time; the difference is prorated to your remaining term.`,
  },
  {
    question: 'Can I try the Pro add-on?',
    answer:
      `Yes. The ${OFFER.trialDays}-day trial is the ${PRICING.tiers.find((t) => t.id === PRICING.trial.tier)?.label} tier${PRICING.trial.requireCard ? '' : ', no credit card required'}. The free plugin is already a complete, fully-featured editor; the Pro add-on adds whole-site and advanced tools.`,
  },
  ...(foundingOpen ? [{
    question: 'What is the founding offer?',
    answer:
      `The first ${OFFER.foundingCap} buyers get ${OFFER.foundingPercent}% off any plan, Lifetime included. On the annual plans the discounted renewal price stays locked for as long as the licence stays active.`,
  }] : []),
  {
    question: 'Is there a lifetime option?',
    answer:
      `Yes: the ${PRICING.lifetime.tier} tier (${siteLabel(PRICING.tiers.find((t) => t.id === PRICING.lifetime.tier)!).toLowerCase()}), one payment, no renewal. Limited to the first ${OFFER.lifetimeCap} sales.`,
  },
  {
    question: 'Do licenses cover client sites?',
    answer:
      `Yes. A licence covers as many sites as its tier allows, whether they are your own or your clients\'. ${unlimited.join(' and ')} (and Lifetime) cover unlimited sites.`,
  },
  {
    question: 'Are the layouts really free?',
    answer: 'Yes. Every layout in our catalog is free to download. Drop your email and grab as many as you like.',
  },
  {
    question: 'How are the converter Pro plugins priced?',
    answer:
      'Each converter is $25/yr on unlimited sites. Free versions convert one page per run; Pro adds whole-site runs and Theme Builder headers/footers. Nothing breaks when a license lapses.',
  },
];
}

const CONVERTERS = [
  {
    name: 'Elementor to Divi 5 Pro',
    price: '$25',
    per: '/yr',
    tagline: 'The full migration toolkit for moving Elementor sites to Divi 5.',
    freeTier: `Free plugin: unlimited single-page conversions, ${STATS.elementorWidgetsMapped} widget mappings, conversion reports.`,
    proTier: 'Pro: full kit ZIP import, Theme Builder headers/footers, global colors & typography.',
    action: <BuyProButton product="elementor-to-divi5-pro" label="Get Pro · $25/yr" />,
    href: '/plugins/elementor-to-divi-5',
    free: FREE_PLUGIN_LINKS['elementor-to-divi5'],
    highlight: true,
  },
  {
    name: 'WPBakery to Divi 5 Pro',
    price: '$25',
    per: '/yr',
    tagline: 'Move a whole WPBakery site to Divi 5, templates and all.',
    freeTier: `Free plugin on wordpress.org: any number of pages per run, ${STATS.wpbakeryElementsMapped} element mappings, check-before-convert report, one-click undo.`,
    proTier: 'Pro: WPBakery templates into the Divi Library, a year of updates, priority support.',
    action: <BuyProButton product="wpbakery-to-divi5-pro" label="Get Pro · $25/yr" />,
    href: '/plugins/wpbakery-to-divi-5',
    free: FREE_PLUGIN_LINKS['wpbakery-to-divi5'],
    highlight: false,
  },
  {
    name: 'Divi to Elementor Pro',
    price: '$25',
    per: '/yr',
    tagline: `Batch conversions the other way, with ${STATS.diviModulesMapped}+ modules mapped.`,
    freeTier: 'Free plugin on wordpress.org: batch conversion, all three Divi export formats, conversion reports.',
    proTier: 'Pro: Divi Theme Builder templates and WooCommerce module to widget mapping.',
    action: <BuyProButton product="divi-to-elementor-pro" label="Get Pro · $25/yr" />,
    href: '/plugins/divi-to-elementor',
    free: FREE_PLUGIN_LINKS['divi-to-elementor'],
    highlight: false,
  },
  {
    name: 'Beaver Builder to Divi 5 Pro',
    price: '$25',
    per: '/yr',
    tagline: 'Move whole Beaver Builder sites to Divi 5, Themer headers and footers included.',
    freeTier: `Free plugin on wordpress.org: one page per run, ${STATS.beaverModulesMapped} module mappings, check-before-convert report, one-click undo.`,
    proTier: 'Pro: unlimited pages per run, Beaver Themer headers/footers into the Divi Theme Builder.',
    action: <BuyProButton product="beaver-to-divi5-pro" label="Get Pro · $25/yr" />,
    href: '/plugins/beaver-builder-to-divi-5',
    free: FREE_PLUGIN_LINKS['beaver-to-divi5'],
    highlight: false,
  },
];

export default async function PricingPage() {
  const availability = await getAvailability();
  const foundingRemaining = availability?.founding.remaining ?? 0;
  const foundingCap = PRICING.founding.cap;
  // The offer is only promised while checkout can really apply it: the coupon is configured and not used up.
  const foundingOpen = isCouponEnvSet(PRICING.founding.couponEnv) && availability !== null && availability.founding.available;
  const FAQ = buildFaq(foundingOpen);

  const trialTier = PRICING.tiers.find((t) => t.id === PRICING.trial.tier) ?? PRICING.tiers[0];
  const trialTierLabel = trialTier.label;
  const hasLifetimePrice = isPriceEnvSet(PRICING.lifetime.priceEnv) && (availability?.lifetime.available ?? true);

  const tiersWithPrices = PRICING.tiers.filter((t) => isPriceEnvSet(t.priceEnv));
  const hasAnyTierPrice = tiersWithPrices.length > 0;
  const lifetimeTier = PRICING.tiers.find((t) => t.id === PRICING.lifetime.tier);

  return (
    <main>
      <PageHero
        eyebrow="Pricing"
        title="AI Editor Pro and converters"
        lead="Free AI Editor plugin, or upgrade to Pro for advanced tools that work across your whole WordPress site. Converter Pro licenses from $25/yr on unlimited sites. Nothing breaks when licenses expire."
      />

      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-h2 text-navy">AI Editor for Divi 5 Pro</h2>
            <p className="mt-3 text-lead text-muted">
              Annual subscription per site count.
              {foundingOpen && ` Founding offer: ${OFFER.foundingPercent}% off for the first ${OFFER.foundingCap} buyers, price locked while the licence stays active.`}
            </p>
          </div>

          {foundingOpen && foundingRemaining > 0 && (
            <Card className="mb-8 border-action bg-blue-50 p-6 text-center">
              <p className="text-body font-semibold text-action">
                Founding offer: {foundingRemaining} of {foundingCap} left, {OFFER.foundingPercent}% off
              </p>
            </Card>
          )}

          <div className="grid items-stretch gap-6 md:grid-cols-3">
            {tiersWithPrices.map((tier) => (
              <Card
                key={tier.id}
                className="relative flex flex-col p-8 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <h3 className="text-section text-navy">{tier.label}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-h2 text-navy">{formatUsd(tier.priceCents)}</span>
                  <span className="text-small text-muted">/year</span>
                </div>
                <p className="mt-1 text-small text-muted">
                  {tier.sites === null ? 'Unlimited sites' : `${tier.sites} site${tier.sites !== 1 ? 's' : ''}`}
                </p>
                <p className="mt-4 text-body text-muted">
                  All 17 Pro tools, 17 free tools, theme builder editing, whole-site builds, undo every change.
                </p>
                <div className="mt-6 flex-1">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      <span>{tier.sites === null ? 'Unlimited' : tier.sites} site{tier.sites !== 1 ? 's' : ''}</span>
                    </li>
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      Updates and support
                    </li>
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      All Pro tools
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <BuyProButton
                    product={PRICING.product}
                    tier={tier.id as 'personal' | 'freelancer' | 'agency'}
                    label={`Get ${tier.label}`}
                  />
                </div>
              </Card>
            ))}

            {hasLifetimePrice && (
              <Card className="relative flex flex-col border-amber-400 p-8 ring-1 ring-amber-400">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-amber-400 px-4 py-1.5 text-small font-semibold text-navy shadow-glow">
                  Limited edition
                </span>
                <h3 className="text-section text-navy">Lifetime</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-h2 text-navy">{formatUsd(PRICING.lifetime.priceCents)}</span>
                  <span className="text-small text-muted">one-time</span>
                </div>
                <p className="mt-1 text-small text-muted">{lifetimeTier ? `${lifetimeTier.label} tier, ${siteLabel(lifetimeTier).toLowerCase()}` : ''}</p>
                <p className="mt-4 text-body text-muted">
                  One payment, no renewal. Limited to the first {OFFER.lifetimeCap} sales.
                  {availability && availability.lifetime.remaining !== null && (
                    <>
                      {' '}
                      {availability.lifetime.remaining} of {OFFER.lifetimeCap} left.
                    </>
                  )}
                </p>
                {foundingOpen && (
                  <p className="mt-2 text-body font-semibold text-action">
                    Founding offer: {OFFER.foundingPercent}% off, applied at checkout.
                  </p>
                )}
                <div className="mt-6 flex-1">
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      All 17 Pro tools
                    </li>
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      {lifetimeTier ? siteLabel(lifetimeTier) : ''}
                    </li>
                    <li className="flex items-start gap-2 text-body text-navy">
                      <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                      One payment, no renewal
                    </li>
                  </ul>
                </div>
                <div className="mt-8">
                  <BuyProButton product={PRICING.product} lifetime label="Get Lifetime" />
                </div>
              </Card>
            )}

            {!hasAnyTierPrice && (
              <Card className="p-8 text-center">
                <h3 className="text-section text-navy">Coming soon</h3>
                <p className="mt-3 text-body text-muted">
                  AI Editor Pro is launching soon. Drop your email to be notified.
                </p>
                <div className="mt-6">
                  <WaitlistForm source="ai_editor_pro_launch" cta="Notify me" />
                </div>
              </Card>
            )}
          </div>
        </Container>
      </SectionShell>

      <SectionShell tone="mist" pad="lg">
        <Container>
          <div className="mx-auto max-w-2xl rounded-lg border border-action/30 bg-blue-50 p-8 text-center">
            <h3 className="text-section text-navy">Try the Pro add-on free for {OFFER.trialDays} days</h3>
            <p className="mt-2 text-body text-muted">
              {PRICING.trial.requireCard ? '' : 'No credit card required. '}
              The trial is the {trialTierLabel} tier and unlocks all 17 Pro tools.
            </p>
            {isPriceEnvSet(trialTier.priceEnv) && (
              <div className="mt-6 flex justify-center">
                <BuyProButton product={PRICING.product} tier={trialTier.id} trial label={`Start the ${OFFER.trialDays}-day trial`} />
              </div>
            )}
          </div>
        </Container>
      </SectionShell>

      <SectionShell tone="paper" pad="lg">
        <Container>
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2 className="text-h2 text-navy">Converter Pro plugins</h2>
            <p className="mt-3 text-lead text-muted">
              Convert from Elementor, WPBakery, Beaver Builder and more. Free versions included.
            </p>
          </div>

          <div className="grid items-stretch gap-6 md:grid-cols-2">
            {CONVERTERS.map((p) => (
              <Card
                key={p.name}
                className={`relative flex flex-col p-8 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift ${p.highlight ? 'border-action shadow-lift ring-1 ring-action' : ''}`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill bg-action px-4 py-1.5 text-small font-semibold text-paper shadow-glow">
                    Popular migration
                  </span>
                )}
                <h3 className="text-section text-navy">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-h2 text-navy">{p.price}</span>
                  <span className="text-small text-muted">{p.per}</span>
                </div>
                <p className="mt-2 text-body text-muted">{p.tagline}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="check_circle" size={18} className="mt-0.5 shrink-0 text-action" />
                    {p.freeTier}
                  </li>
                  <li className="flex items-start gap-2 text-body text-navy">
                    <Icon name="workspace_premium" size={18} className="mt-0.5 shrink-0 text-action" />
                    {p.proTier}
                  </li>
                </ul>
                <div className="mt-8 flex flex-col gap-2">
                  {p.action}
                  {p.free && (
                    <a href={p.free.href} {...freePluginAnchorProps(p.free)} className="text-center text-small font-semibold text-action hover:underline">
                      {p.free.label}
                    </a>
                  )}
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
                Every layout in our catalog ({STATS.freeLayoutsPublished}+ validated sections and pages) is free to download and use.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/free-divi-layouts"
                className="flex h-12 items-center justify-center rounded-pill bg-action px-8 text-body font-semibold text-paper shadow-glow transition hover:-translate-y-0.5 hover:shadow-glow-lg hover:brightness-110"
              >
                Get free layouts
              </Link>
              <Link
                href="/browse"
                className="flex h-12 items-center justify-center rounded-pill border border-border bg-paper px-8 text-body font-semibold text-navy transition hover:-translate-y-0.5 hover:border-action hover:text-action hover:shadow-lift"
              >
                Browse catalog
              </Link>
            </div>
          </Card>
        </Container>
      </SectionShell>

      <SectionShell tone="mist" pad="lg">
        <Container>
          <Eyebrow>Answers</Eyebrow>
          <h2 className="mt-3 text-h2 text-navy">Frequently asked questions</h2>
          <dl className="mt-10 max-w-3xl space-y-7">
            {FAQ.map((f) => (
              <div key={f.question}>
                <dt className="text-body font-semibold text-navy">{f.question}</dt>
                <dd className="mt-1 text-body text-muted">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </SectionShell>

      <CtaBand
        eyebrow={PRICING.trial.requireCard ? undefined : 'No card required'}
        title={`Try Pro free for ${OFFER.trialDays} days, or buy a converter.`}
        body={`The ${trialTierLabel} tier of the Pro add-on, the free AI Editor plugin, and the free layout catalog.`}
        cta={{ label: 'See the AI Editor', href: '/plugins/divi-5-ai-editor' }}
        curveTop={EDGE.mist}
      />

      <JsonLd data={faqJsonLd(FAQ)} />
    </main>
  );
}
