import type { ReactNode } from 'react';

export function IconFeature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex h-10 w-10 items-center justify-center rounded-button bg-fog text-action">{icon}</div>
      <h3 className="mt-4 text-section text-navy">{title}</h3>
      <p className="mt-2 text-body text-muted">{body}</p>
    </div>
  );
}
