// A validator transcript: caught violations, the retry, the clean verdict.
// Deliberately monospace and terminal-flavored — this is the product talking.
export function VerdictCard({
  title,
  failures,
  passSummary,
  className = '',
}: {
  title: string;
  failures: { code: string; detail: string }[];
  passSummary: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-card border border-border bg-ink text-paper shadow-soft ${className}`}>
      <div className="flex items-center gap-2 border-b border-paper/10 px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="h-2.5 w-2.5 rounded-full bg-paper/25" />
        <span className="ml-2 font-mono text-small text-paper/60">{title}</span>
      </div>
      <div className="space-y-2.5 px-5 py-5 font-mono text-small leading-relaxed">
        {failures.map((f) => (
          <p key={f.code + f.detail} className="text-paper/90">
            <span className="text-red-400">✗ </span>
            <span className="font-semibold text-red-300">{f.code}</span>
            <span className="text-paper/70">  {f.detail}</span>
          </p>
        ))}
        <p className="text-paper/50">→ {failures.length} violation{failures.length === 1 ? '' : 's'} returned · re-validating…</p>
        <p>
          <span className="text-green-400">✓ </span>
          <span className="text-green-300">{passSummary}</span>
        </p>
      </div>
    </div>
  );
}
