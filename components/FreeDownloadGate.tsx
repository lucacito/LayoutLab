import { captureAndDownloadAction } from '@/lib/capture/download-actions';
import { Icon } from '@/components/ui/Icon';

export function FreeDownloadGate({ layoutId, slug, captured }: { layoutId: string; slug: string; captured: boolean }) {
  if (captured) {
    return (
      <a
        href={`/api/download/${layoutId}`}
        download={`${slug}.zip`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110"
      >
        <Icon name="download" size={20} /> Download free
      </a>
    );
  }
  return (
    <form action={captureAndDownloadAction.bind(null, layoutId, slug)} className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-center">
      <input
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email"
        className="h-11 w-full rounded-full border border-fog bg-paper px-4 text-body text-navy outline-none focus:border-action sm:w-64"
      />
      <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-action px-5 text-small font-semibold text-paper transition hover:brightness-110">
        <Icon name="download" size={20} /> Get it free
      </button>
    </form>
  );
}
