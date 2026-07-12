import { Icon } from '@/components/ui/Icon';

// Widget → module mapping rows, terminal-tag styled, staggered entrance.
export function MappingPanel({
  pairs,
  fromLabel,
  toLabel,
  className = '',
}: {
  pairs: { from: string; to: string }[];
  fromLabel: string;
  toLabel: string;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-border bg-paper p-6 shadow-soft ${className}`}>
      <div className="mb-4 flex items-center justify-between text-small font-semibold uppercase tracking-wide text-muted">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
      <ul className="space-y-2.5">
        {pairs.map((p, i) => (
          <li key={p.from} className="anim-rise flex items-center justify-between gap-3" style={{ ['--rise-i' as string]: i }}>
            <code className="rounded-button bg-fog px-2.5 py-1.5 font-mono text-small text-navy">{p.from}</code>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <Icon name="arrow_forward" size={16} className="shrink-0 text-action" />
            <code className="rounded-button bg-navy px-2.5 py-1.5 font-mono text-small text-paper">{p.to}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
