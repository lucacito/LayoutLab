import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { SectionShell } from '@/components/ui/SectionShell';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { NextConverterForm } from './NextConverterForm';

// Demand capture for the next converter. Anchored so the hero and the plugins
// hub can deep-link to it.
export function NextConverterBand() {
  return (
    <div id="next-converter">
      <SectionShell tone="paper" pad="lg">
        <Container>
          <SectionTitle eyebrow="You decide what ships next" title="Which builder should we convert next?">
            Elementor and Beaver Builder are done. WPBakery, Bricks, Oxygen, Breakdance and block builders are on the
            bench. Your vote picks the order, and you hear the day yours ships.
          </SectionTitle>
          <Card className="mx-auto mt-12 max-w-3xl p-8">
            <NextConverterForm />
          </Card>
        </Container>
      </SectionShell>
    </div>
  );
}
