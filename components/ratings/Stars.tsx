import { Icon } from '@/components/ui/Icon';

// Read-only star display for social proof on cards and listings.
export function Stars({ average, count, size = 15, className = '' }: { average: number; count: number; size?: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-label={`${average} out of 5 from ${count} ratings`}>
      <span className="inline-flex text-g-amber">
        {[1, 2, 3, 4, 5].map((i) => {
          const name = average >= i ? 'star' : average >= i - 0.5 ? 'star_half' : 'star_border';
          return <Icon key={i} name={name} size={size} />;
        })}
      </span>
      <span className="text-small font-medium text-muted">
        {average.toFixed(1)} <span className="font-normal">({count})</span>
      </span>
    </span>
  );
}
