import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

const STEPS = [
  { icon: 'search', title: 'Browse & pick', body: 'Filter by type, industry, style or color and find the exact section you need.' },
  { icon: 'download', title: 'Download the JSON', body: 'One click, free for individual sections — drop your email and get the Divi 5 file.' },
  { icon: 'bolt', title: 'Import & customize', body: 'Paste it into the Divi 5 builder, swap your copy and images, and publish.' },
];

export function HowItWorks() {
  return (
    <section className="py-20">
      <Container>
        <SectionTitle eyebrow="How it works" title="Blank page to live in 3 steps">
          No rebuilding from scratch — import a validated section and make it yours.
        </SectionTitle>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-action/10 text-action">
                <Icon name={s.icon} size={28} />
              </span>
              <p className="mt-3 text-small font-bold uppercase tracking-wide text-action">Step {i + 1}</p>
              <h3 className="mt-1 text-h3 text-navy">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-body text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
