import { Button } from '@/components/ui/Button';
import { CtaNote } from '@/components/ui/CtaNote';

// One strong closing statement instead of two competing CTA cards. Full-bleed image,
// one headline, a primary action and a low-key secondary (custom work still lives at
// /contact so we don't silently drop the lead-gen offer).
export function ClosingCta({ image }: { image: string }) {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="relative isolate flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-card px-6 py-20 text-center text-paper">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{ backgroundImage: `url(${image})` }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-tl from-ink/95 via-navy/90 to-action/55" />
        <h2 className="max-w-2xl text-h1 text-paper">Build your next Divi site in minutes, not days.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lead text-paper/85">
          Browse the library, import a validated Divi 5 layout, and drop in your brand. No blank page, no cleanup.
        </p>
        <div className="mt-9 flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button href="/browse">Browse layouts</Button>
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-button border border-paper/40 px-6 text-base font-semibold text-paper backdrop-blur transition hover:bg-paper/10"
            >
              Need a custom build?
            </a>
          </div>
          <CtaNote className="text-paper/80" />
        </div>
      </div>
    </section>
  );
}
