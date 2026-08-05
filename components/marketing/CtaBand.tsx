import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { SectionShell } from '@/components/ui/SectionShell';

export function CtaBand({
  eyebrow,
  title,
  body,
  cta,
  secondary,
  note,
  /** Colour of the section above, curved down into this band. */
  curveTop,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  note?: string;
  curveTop?: string;
}) {
  return (
    // Shares the footer's canvas, so the page closes on one continuous surface.
    <SectionShell tone="deep" pad="lg" blooms curveTop={curveTop}>
      <Container className="text-center">
        {eyebrow && <Eyebrow tone="dark" className="mb-4">{eyebrow}</Eyebrow>}
        <h2 className="mx-auto max-w-3xl text-h2 text-paper">{title}</h2>
        {body && <p className="mx-auto mt-5 max-w-xl text-lead text-paper/80">{body}</p>}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button href={cta.href} size="lg" variant="primary">{cta.label}</Button>
          {secondary && <Button href={secondary.href} size="lg" variant="onDark">{secondary.label}</Button>}
        </div>
        {note && <p className="mt-6 text-small text-paper/60">{note}</p>}
      </Container>
    </SectionShell>
  );
}
