import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: 'chat', title: 'Tell us about your business', body: 'Share your trade, service area, and what you want the site to do.' },
  { icon: 'draw', title: 'We design a mockup', body: 'You see a real preview built for your business — fast, thanks to our layout pipeline.' },
  { icon: 'build', title: 'We build it in Divi 5', body: 'Validated, import-ready, and fully yours — no lock-in.' },
  { icon: 'call', title: 'Launch & get calls', body: 'We help you go live, wired for click-to-call and quote requests.' },
];

export function ServicesSteps() {
  return (
    <section className="border-y border-border bg-mist py-16">
      <Container>
        <SectionTitle eyebrow="How it works" title="From first call to live site in about a week">
          A simple, fast process — no agency runaround.
        </SectionTitle>
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col rounded-card border border-border bg-paper p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-action text-small font-bold text-paper">{i + 1}</span>
                <Icon name={s.icon} size={22} className="text-action" />
              </div>
              <h3 className="mt-4 text-body font-semibold text-navy">{s.title}</h3>
              <p className="mt-2 text-small text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
