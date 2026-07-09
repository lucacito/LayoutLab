import { Markdown } from '@/components/Markdown';
import { Icon } from '@/components/ui/Icon';

// Long-form SEO body for a layout page: overview, features, audience,
// customization tips, a shared install walkthrough, and FAQ. Rendered only
// when the pipeline/backfill has generated `seo.article` for the layout —
// pages without one keep their compact form.
export interface LayoutArticleContent {
  overview: string;
  features: string[];
  whoItsFor: string;
  customization: string;
  faq: { q: string; a: string }[];
}

// Always-true answers shared by every layout page; merged after the
// layout-specific FAQ (also emitted as FAQPage JSON-LD by the page).
export const SHARED_LAYOUT_FAQ: { q: string; a: string }[] = [
  {
    q: 'Which Divi version does this layout need?',
    a: 'Divi 5. The layout is generated natively for Divi 5 and validated against its real module structure before publication, so it imports clean into the current builder.',
  },
  {
    q: 'Can I use this layout on client websites?',
    a: 'Yes. Every download includes a commercial license covering unlimited sites you own or build for clients. Only reselling or redistributing the layout file itself is prohibited.',
  },
];

const INSTALL_STEPS = [
  'Download the layout JSON file from this page.',
  'Open the target page in the Divi 5 builder.',
  'Open the portability panel (up/down arrows icon) and choose the Import tab.',
  'Upload the JSON. Tick “replace existing content” only for full-page imports.',
  'Check the page at desktop and mobile widths, then swap in your copy and images.',
];

export function LayoutArticle({ title, article }: { title: string; article: LayoutArticleContent | undefined }) {
  if (!article) return null;
  return (
    <div className="mt-12 max-w-3xl">
      <section>
        <h2 className="text-section text-navy">Overview</h2>
        <Markdown content={article.overview} className="mt-3" />
      </section>

      {article.features.length > 0 && (
        <section className="mt-10">
          <h2 className="text-section text-navy">What&rsquo;s inside</h2>
          <ul className="mt-4 space-y-2">
            {article.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-body text-ink">
                <Icon name="check_circle" size={20} className="mt-1 shrink-0 text-action" /> {f}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-section text-navy">Who it&rsquo;s for</h2>
        <Markdown content={article.whoItsFor} className="mt-3" />
      </section>

      <section className="mt-10">
        <h2 className="text-section text-navy">Customization tips</h2>
        <Markdown content={article.customization} className="mt-3" />
      </section>

      <section className="mt-10">
        <h2 className="text-section text-navy">How to install this layout</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-body text-ink">
          {INSTALL_STEPS.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p className="mt-3 text-small text-muted">
          Full walkthrough with troubleshooting: <a href="/guides/how-to-import-a-divi-5-layout" className="text-action hover:underline">How to Import a Divi 5 Layout</a>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-section text-navy">Questions about {title}</h2>
        <div className="mt-4 divide-y divide-border rounded-card border border-border bg-paper">
          {[...article.faq, ...SHARED_LAYOUT_FAQ].map((f) => (
            <details key={f.q} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-semibold text-navy">
                {f.q}
                <Icon name="expand_more" size={22} className="shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-body text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
