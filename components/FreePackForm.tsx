'use client';
import { captureFreePackAction } from '@/lib/capture/actions';
import { trackEvent } from '@/lib/analytics';

export function FreePackForm({ packId }: { packId: string }) {
  return (
    <form action={captureFreePackAction.bind(null, packId)} onSubmit={() => trackEvent('free_capture_submitted', { packId })} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 w-full rounded-card border border-fog bg-paper px-3 text-body text-navy outline-none focus:border-action sm:w-64"
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
      >
        Email me this free pack
      </button>
    </form>
  );
}
