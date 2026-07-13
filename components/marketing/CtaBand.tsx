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
