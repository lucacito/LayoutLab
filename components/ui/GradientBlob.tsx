export function GradientBlob({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute -z-10 rounded-full blur-3xl opacity-40 ${className}`}
      style={{ background: 'conic-gradient(from 180deg, #E55CFF, #8247F5, #0099FF, #FFA600, #E55CFF)' }}
    />
  );
}
