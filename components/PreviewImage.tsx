import Image from 'next/image';
import { assetUrl } from '@/lib/blob/url';
import { PreviewSkeleton } from '@/components/PreviewSkeleton';

// Real layout screenshots (Phase 3b) are uploaded to Vercel Blob. Until those
// exist, previews render a deterministic, on-brand Style-A skeleton tile that
// varies by the layout's type (structure) + color axis (tint). Once a real Blob
// screenshot is present, this renders the actual image automatically.
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
  type,
  color,
  layoutStyle,
}: {
  src?: string | null;
  alt: string;
  label?: string | null;
  sizes?: string;
  className?: string;
  imageClassName?: string;
  /** Layout type (or 'pack') → selects the skeleton archetype for the placeholder. */
  type?: string | null;
  /** Color axis value → tints the placeholder. */
  color?: string | null;
  /** Layout style; 'dark' switches the placeholder to the dark treatment. */
  layoutStyle?: string | null;
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
    <div className={box} role="img" aria-label={alt}>
      <PreviewSkeleton type={type} color={color} layoutStyle={layoutStyle} label={label} />
    </div>
  );
}
