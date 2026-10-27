import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { SectionShell } from '@/components/ui/SectionShell';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { PackCard } from '@/components/PackCard';
import { formatPriceCents } from '@/lib/format/price';
import type { PackRow } from '@/lib/catalog/queries';

const MAX_PACKS = 4;

/**
 * Homepage section for the paid theme packs: complete multi-page Divi 5 websites. The cards come from the
 * database (the page passes them in); with none (database down) the heading and the browse button still render.
 */
export function ThemePacksBand({ packs }: { packs: PackRow[] }) {
  const shown = packs.filter((p) => p.kind === 'paid' && p.status === 'published').slice(0, MAX_PACKS);
  const prices = shown.map((p) => p.priceCents).filter((c): c is number => typeof c === 'number' && c > 0);
  const from = prices.length ? `From ${formatPriceCents(Math.min(...prices))}. ` : '';

  return (
    <SectionShell tone="paper" pad="lg">
      <Container>
        <SectionTitle eyebrow="Theme packs" title="Complete Divi 5 websites, one price.">
          {from}Six matching pages per theme, one brand and one design system across all of them, real copy, and a
          commercial license for unlimited sites. Import, swap in your details, publish.
        </SectionTitle>
        {shown.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((p) => <PackCard key={p.id} pack={p} />)}
          </div>
        )}
        <div className="mt-10 text-center">
          <Button href="/packs" size="lg" variant="primary">Browse theme packs</Button>
        </div>
      </Container>
    </SectionShell>
  );
}
