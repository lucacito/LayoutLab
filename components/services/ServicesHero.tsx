import { Icon } from '@/components/ui/Icon';

const TRUST = ['Built on Divi 5', 'Live in about a week', 'Conversion-first', 'You own everything'];

export function ServicesHero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-paper">
      <div
        className="absolute inset-0 -z-20"
        style={{
          background:
            'radial-gradient(60% 90% at 30% 0%, rgba(99,91,255,0.55), transparent), radial-gradient(55% 80% at 85% 30%, rgba(0,153,255,0.45), transparent), #07070B',
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/40 to-ink/80" />
      <div className="mx-auto max-w-3xl px-4 py-24 text-center md:py-32">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 text-small font-semibold text-paper backdrop-blur">
          <Icon name="bolt" size={16} className="text-action" /> Divi 5 websites for trades
        </span>
        <h1 className="mt-5 text-h1 text-paper">Websites that get HVAC, roofing &amp; plumbing companies more calls.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lead text-paper/85">
          We design and build fast, mobile-first Divi 5 sites engineered around one thing: turning visitors into phone calls and
          quote requests. Built in days, not months.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="/contact" className="inline-flex h-12 items-center justify-center rounded-full bg-action px-7 text-body font-semibold text-paper transition hover:brightness-110">
            Get a free quote
          </a>
          <a href="/browse" className="inline-flex h-12 items-center justify-center rounded-full border border-paper/25 bg-paper/5 px-7 text-body font-semibold text-paper backdrop-blur transition hover:bg-paper/15">
            See examples
          </a>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {TRUST.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-small text-paper/75">
              <Icon name="check_circle" size={16} className="text-action" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
