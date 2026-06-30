'use client';
import { useState } from 'react';
import { PreviewImage } from '@/components/PreviewImage';
import { Icon } from '@/components/ui/Icon';

// Desktop / mobile preview toggle with device frames + click-to-zoom. Uses the
// desktop + mobile screenshots we capture per layout.
export function ResponsivePreview({
  keys,
  title,
  type,
  color,
  layoutStyle,
}: {
  keys: string[];
  title: string;
  type?: string | null;
  color?: string | null;
  layoutStyle?: string | null;
}) {
  const desktop = keys.find((k) => !/-mobile\./.test(k)) ?? keys[0] ?? null;
  const mobile = keys.find((k) => /-mobile\./.test(k)) ?? null;
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState(false);
  if (!desktop) return null;
  const onMobile = view === 'mobile' && !!mobile;

  return (
    <div>
      {mobile && (
        <div className="mb-4 inline-flex rounded-full border border-border bg-paper p-1 text-small font-medium">
          {(['desktop', 'mobile'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 capitalize transition ${
                view === v ? 'bg-navy text-paper' : 'text-muted hover:text-navy'
              }`}
            >
              <Icon name={v === 'desktop' ? 'desktop_windows' : 'smartphone'} size={16} /> {v}
            </button>
          ))}
        </div>
      )}

      {onMobile ? (
        <div className="mx-auto w-full max-w-[360px]">
          <div className="overflow-hidden rounded-[2rem] border-[7px] border-navy bg-navy shadow-soft">
            <button type="button" onClick={() => setZoom(true)} className="block w-full">
              <PreviewImage src={mobile!} alt={`${title} — mobile preview`} type={type} color={color} layoutStyle={layoutStyle} sizes="360px" className="aspect-[9/16]" />
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-paper shadow-soft">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <button type="button" onClick={() => setZoom(true)} className="block max-h-[640px] w-full overflow-hidden">
            <PreviewImage src={desktop} alt={`${title} — desktop preview`} type={type} color={color} layoutStyle={layoutStyle} natural />
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-small text-muted">Click to zoom</p>

      {zoom && (
        <div role="dialog" aria-modal className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/85 p-4" onClick={() => setZoom(false)}>
          <PreviewImage
            src={onMobile ? mobile! : desktop}
            alt={`${title} — full preview`}
            type={type}
            color={color}
            layoutStyle={layoutStyle}
            sizes="100vw"
            className={onMobile ? 'h-[85vh] w-[min(420px,90vw)] rounded-card' : 'max-h-[85vh] w-full max-w-6xl rounded-card'}
            imageClassName="!object-contain"
          />
        </div>
      )}
    </div>
  );
}
