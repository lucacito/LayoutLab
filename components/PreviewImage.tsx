import Image from 'next/image';
import { assetUrl } from '@/lib/blob/url';

// Real layout screenshots (Phase 3b) are uploaded to Vercel Blob. Until those
// exist, previews are generic placeholder URLs — rather than show a random stock
// photo, we render a clean, on-brand wireframe tile. Once a real Blob screenshot
// is present, this renders the actual image automatically.
function isRealScreenshot(src: string | null | undefined): boolean {
  if (!src) return false;
  return /blob\.vercel-storage\.com/.test(src) || /^layouts\/.+\.(png|jpe?g|webp)$/i.test(src);
}

export function PreviewImage({
  src,
  alt,
  label,
  sizes,
  className = '',
  imageClassName = '',
}: {
  src?: string | null;
  alt: string;
  label?: string | null;
  sizes?: string;
  className?: string;
  imageClassName?: string;
}) {
  const box = `relative overflow-hidden ${className}`;

  if (isRealScreenshot(src)) {
    return (
      <div className={box}>
        <Image src={assetUrl(src as string)} alt={alt} fill sizes={sizes} className={`object-cover ${imageClassName}`} />
      </div>
    );
  }

  return (
    <div className={`${box} flex items-center justify-center bg-gradient-to-br from-fog to-paper`} role="img" aria-label={alt}>
      <svg viewBox="0 0 120 90" className="h-[55%] w-[55%] text-border" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <rect x="8" y="8" width="104" height="18" rx="3" />
        <rect x="8" y="34" width="62" height="48" rx="3" />
        <rect x="78" y="34" width="34" height="10" rx="2" />
        <rect x="78" y="50" width="34" height="10" rx="2" />
        <rect x="78" y="66" width="34" height="16" rx="2" />
      </svg>
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-paper/80 px-2 py-0.5 text-[11px] font-medium capitalize text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
