import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

const MOTIF_SHELL = 'mt-6 rounded-card border border-fog bg-mist p-5';

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
    chip: { label: 'Free on wordpress.org · Pro $25/yr', tone: 'green' },
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
    chip: { label: 'Free download · Pro $30/yr', tone: 'green' },
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
        <Card key={d.href} className="flex flex-col p-8 transition duration-300 hover:-translate-y-1.5 hover:shadow-lift">
          {/* Fixed-height slot: chip labels differ in length, and without this
              the three headlines land at different heights. */}
          <div className="flex min-h-[3.25rem] items-start">
            <span className={`inline-flex w-fit items-center rounded-pill border px-3.5 py-1.5 text-small font-semibold ${CHIP[d.chip.tone]}`}>
              {d.chip.label}
            </span>
          </div>
          <p className="eyebrow mt-4 text-action">{d.name}</p>
          <h3 className="mt-2.5 text-section leading-snug text-navy">{d.headline}</h3>
          <div className={MOTIF_SHELL}>{d.motif}</div>
          <p className="mt-5 flex-1 text-body text-muted">{d.body}</p>
          <p className="mt-4 text-small font-medium text-muted">{d.stats}</p>
          <Button href={d.href} size="sm" className="mt-7 w-fit">
            {d.cta} <Icon name="arrow_forward" size={15} />
          </Button>
        </Card>
      ))}
    </div>
  );
}
