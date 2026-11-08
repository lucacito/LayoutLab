import { Container } from '@/components/ui/Container';
import { Icon } from '@/components/ui/Icon';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { SectionShell } from '@/components/ui/SectionShell';
import { FEATURE_GROUPS, featureCount, type Feature, type FeatureGroup } from '@/lib/site/features';
import { AI_EDITOR } from '@/lib/site/ai-editor-facts';

function TierPill({ tier }: { tier: Feature['tier'] }) {
  return tier === 'pro' ? (
    <span className="rounded-pill bg-action px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-paper">Pro</span>
  ) : (
    <span className="rounded-pill bg-green-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-inset ring-green-200">Free</span>
  );
}

function FeatureCard({ f }: { f: Feature }) {
  return (
    <li className="group relative flex h-full flex-col rounded-card border border-border bg-paper p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-button bg-gradient-to-br from-action/15 to-g-pink/15 text-action">
          <Icon name={f.icon} size={22} />
        </span>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {f.flag && <span className="rounded-pill bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">{f.flag}</span>}
          <TierPill tier={f.tier} />
        </span>
      </div>
      <h4 className="mt-4 text-body font-semibold text-navy">{f.title}</h4>
      <p className="mt-2 text-small leading-relaxed text-muted">{f.body}</p>
    </li>
  );
}

function Group({ g }: { g: FeatureGroup }) {
  return (
    <section id={`features-${g.id}`} aria-labelledby={`features-${g.id}-title`} className="scroll-mt-28 border-t border-border/70 py-14 first:border-t-0 first:pt-0">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2.2fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>{g.eyebrow}</Eyebrow>
          <h3 id={`features-${g.id}-title`} className="mt-3 text-h3 text-navy">{g.title}</h3>
          <p className="mt-4 text-body text-muted">{g.lead}</p>
        </div>
        <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {g.features.map((f) => (
            <FeatureCard key={f.title} f={f} />
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * The full feature list of the AI Editor for Divi 5, grouped, on one appealing band. One data source
 * (lib/site/features.ts) feeds this on the homepage, the plugin page and the Divi 5 MCP page.
 */
export function FeatureShowcase({ id = 'features', heading = true, curveTop }: { id?: string; heading?: boolean; curveTop?: string }) {
  return (
    <SectionShell tone="paper" pad="lg" id={id} className="scroll-mt-24" curveTop={curveTop}>
      <Container>
        {heading && (
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Everything it does</Eyebrow>
            <h2 className="mt-4 text-h2 text-navy">The complete AI toolkit for Divi 5</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lead text-muted">
              {featureCount()} capabilities across {AI_EDITOR.freeTools} free tools and {AI_EDITOR.proTools} Pro tools, all behind one deterministic check.
              Free on WordPress.org; Pro adds the whole-site work.
            </p>
            <nav aria-label="Feature groups" className="mt-8 flex flex-wrap justify-center gap-2">
              {FEATURE_GROUPS.map((g) => (
                <a
                  key={g.id}
                  href={`#features-${g.id}`}
                  className="rounded-pill border border-border bg-mist px-4 py-1.5 text-small font-semibold text-navy transition hover:border-action hover:text-action"
                >
                  {g.eyebrow}
                </a>
              ))}
            </nav>
          </div>
        )}
        <div className={heading ? 'mt-14' : ''}>
          {FEATURE_GROUPS.map((g) => (
            <Group key={g.id} g={g} />
          ))}
        </div>
      </Container>
    </SectionShell>
  );
}
