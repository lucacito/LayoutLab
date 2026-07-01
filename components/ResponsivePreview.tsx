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

      <p className="mt-2 text-center text-small text-muted">Click to view the full page</p>

      {zoom && (
        <div role="dialog" aria-modal className="fixed inset-0 z-[60] overflow-auto bg-navy/90 p-4 sm:p-8" onClick={() => setZoom(false)}>
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label="Close"
            className="fixed right-4 top-4 z-[61] flex h-10 w-10 items-center justify-center rounded-full bg-paper text-navy shadow-soft transition hover:bg-fog"
          >
            <Icon name="close" size={20} />
          </button>
          {/* Full page at natural aspect inside a scrollable overlay — the whole layout
              is visible top-to-bottom by scrolling. Clicking the image doesn't close. */}
          <div className={`mx-auto ${onMobile ? 'max-w-[420px]' : 'max-w-5xl'}`} onClick={(e) => e.stopPropagation()}>
            <PreviewImage
              src={onMobile ? mobile! : desktop}
              alt={`${title} — full preview`}
              type={type}
              color={color}
              layoutStyle={layoutStyle}
              natural
              className="rounded-card"
            />
          </div>
          <p className="mt-3 text-center text-small text-paper/70">Scroll to see the full page · click outside or ✕ to close</p>
        </div>
      )}
    </div>
  );
}
