import Link from 'next/link';

export function DownloadButton({ layoutId, slug }: { layoutId: string; slug: string }) {
  return (
    <Link
      href={`/api/download/${layoutId}`}
      className="inline-flex h-10 items-center justify-center rounded-button bg-action px-4 text-small font-semibold text-paper hover:brightness-110"
      download={`${slug}.zip`}
    >
      Download
    </Link>
  );
}
