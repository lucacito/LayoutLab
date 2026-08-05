// Row of hard numbers. dt = the number (visual lead), dd = what it counts.
export function StatStrip({
  stats,
  tone = 'light',
  className = '',
}: {
  stats: { value: string; label: string }[];
  /** `dark` = sitting on the immersive canvas. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <dl
      className={`mx-auto flex max-w-3xl flex-wrap items-start justify-center gap-x-4 gap-y-6 rounded-panel px-6 py-7 ${
        dark ? 'border border-paper/15 bg-paper/[0.07] backdrop-blur-md' : ''
      } ${className}`}
    >
      {stats.map((s) => (
        <div key={s.label} className="min-w-[130px] flex-1 text-center">
          <dt className={`font-display text-[38px] font-extrabold leading-none tabular-nums ${dark ? 'text-paper' : 'text-navy'}`}>
            {s.value}
          </dt>
          <dd className={`mt-2 text-small font-medium ${dark ? 'text-paper/70' : 'text-muted'}`}>{s.label}</dd>
        </div>
      ))}
    </dl>
  );
}
