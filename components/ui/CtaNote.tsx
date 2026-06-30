import { Icon } from '@/components/ui/Icon';

// Reassurance microcopy under a CTA.
export function CtaNote({
  text = 'No credit card required · Cancel anytime',
  className = '',
}: {
  text?: string;
  className?: string;
}) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-small text-muted ${className}`}>
      <Icon name="lock_open" size={14} /> {text}
    </p>
  );
}
