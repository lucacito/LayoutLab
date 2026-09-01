import type { ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { SectionShell, EDGE } from '@/components/ui/SectionShell';

/**
 * Standard interior-page hero: the brand canvas, an eyebrow, a display
 * headline, and a curve into whatever follows. Interior pages use `h1` at
 * `text-h1` rather than the homepage's `text-display`.
 */
export function PageHero({
  above,
  eyebrow,
  title,
  lead,
  align = 'center',
  /** Ground colour of the section below, curved up into this hero. */
  curveInto = EDGE.paper,
  children,
}: {
  /** Rendered above the eyebrow. Breadcrumbs live here. */
  above?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'center' | 'left';
  curveInto?: string;
  children?: ReactNode;
}) {
  const centered = align === 'center';
  return (
    <SectionShell tone="hero" underHeader bottom="lg" blooms curveBottom={curveInto}>
      <Container className={centered ? 'text-center' : ''}>
        {above && <div className={`mb-6 ${centered ? '[&_ol]:justify-center' : ''}`}>{above}</div>}
        {eyebrow && <Eyebrow tone="dark" className="mb-4">{eyebrow}</Eyebrow>}
        <h1 className={`text-h1 text-paper ${centered ? 'mx-auto max-w-4xl' : 'max-w-4xl'}`}>{title}</h1>
        {lead && (
          <p className={`mt-6 text-lead text-paper/80 ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>{lead}</p>
        )}
        {children && <div className="mt-10">{children}</div>}
      </Container>
    </SectionShell>
  );
}
