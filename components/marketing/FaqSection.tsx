import { Container } from '@/components/ui/Container';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Icon } from '@/components/ui/Icon';

const FAQS = [
  {
    q: 'Are the sections really free?',
    a: 'Individual sections are free to download — just drop your email for the file. Curated packs and the all-access membership are the paid options.',
  },
  {
    q: 'What exactly do I download?',
    a: 'A Divi 5 layout JSON file you import straight into the Divi builder, plus a commercial license. No cleanup, no broken modules.',
  },
  {
    q: 'Which Divi version do these work with?',
    a: 'Divi 5. Every section is generated and validated against the real Divi 5 structure, so it imports clean.',
  },
  {
    q: 'Can I use these on client sites?',
    a: 'Yes. The commercial license covers unlimited sites you own or build for clients. Reselling or redistributing the files themselves is not allowed.',
  },
  {
    q: 'Do I need an account?',
    a: 'Not for free sections — just an email for the download. An account lets you sync bookmarks across devices and manage purchases.',
  },
  {
    q: 'What if a section doesn’t work for me?',
    a: 'Paid packs are digital goods, so they’re generally non-refundable — but reach out and we’ll make it right.',
  },
];

export function FaqSection() {
  return (
    <section className="py-20">
      <Container className="max-w-3xl">
        <SectionTitle eyebrow="FAQ" title="Questions, answered">
          Everything you need to know before you import.
        </SectionTitle>
        <div className="mt-10 divide-y divide-border rounded-card border border-border bg-paper">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-semibold text-navy">
                {f.q}
                <Icon name="expand_more" size={22} className="shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-body text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
