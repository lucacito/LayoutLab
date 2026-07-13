// Row of hard numbers. dt = the number (visual lead), dd = what it counts.
export function StatStrip({ stats, className = '' }: { stats: { value: string; label: string }[]; className?: string }) {
  return (
    <dl className={`flex flex-wrap items-start justify-center gap-x-10 gap-y-6 ${className}`}>
      {stats.map((s) => (
        <div key={s.label} className="min-w-[120px] text-center">
          <dt className="text-h3 tabular-nums text-navy">{s.value}</dt>
          <dd className="mt-1 text-small font-medium text-muted">{s.label}</dd>
        </div>
      ))}
    </dl>
  );
}
