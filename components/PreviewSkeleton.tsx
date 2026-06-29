import { skeletonForType, skinForLayout, type PreviewArchetype, type PreviewSkin } from '@/lib/preview/skin';

// Style A: a faux-browser tile whose inner skeleton varies by layout type and
// whose tint comes from the color axis (dark style overrides). Renders nothing
// real — a deterministic on-brand stand-in until Phase 3b screenshots land.

function Bar({ w, h = 8, skin, r = 3 }: { w: string; h?: number; skin: PreviewSkin; r?: number }) {
  return <div style={{ width: w, height: h, background: skin.block, borderRadius: r }} />;
}

function Skeleton({ archetype, skin }: { archetype: PreviewArchetype; skin: PreviewSkin }) {
  const blk = (style: React.CSSProperties) => <div style={{ background: skin.block, borderRadius: 5, ...style }} />;

  switch (archetype) {
    case 'hero':
      return (
        <div className="flex h-full flex-col gap-2">
          <Bar w="78%" h={12} skin={skin} />
          <Bar w="55%" h={7} skin={skin} />
          <div className="mt-1 flex flex-1 gap-3">
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Bar w="100%" h={6} skin={skin} />
              <Bar w="85%" h={6} skin={skin} />
              <Bar w="60%" h={6} skin={skin} />
              <div className="mt-1 flex gap-2"><Bar w="34%" h={12} skin={skin} r={4} /><Bar w="26%" h={12} skin={skin} r={4} /></div>
            </div>
            {blk({ width: '40%', borderRadius: 8 })}
          </div>
        </div>
      );
    case 'columns':
      return (
        <div className="flex h-full gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-2 rounded-md p-2" style={{ background: skin.block, opacity: i === 1 ? 1 : 0.78 }}>
              <Bar w="60%" h={14} skin={skin} />
              <Bar w="90%" h={6} skin={skin} />
              <Bar w="80%" h={6} skin={skin} />
              <Bar w="85%" h={6} skin={skin} />
            </div>
          ))}
        </div>
      );
    case 'features':
      return (
        <div className="grid h-full grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2">
              {blk({ width: 16, height: 16, borderRadius: 4, flexShrink: 0 })}
              <div className="flex flex-1 flex-col gap-1.5 pt-0.5"><Bar w="80%" h={6} skin={skin} /><Bar w="55%" h={6} skin={skin} /></div>
            </div>
          ))}
        </div>
      );
    case 'quotes':
      return (
        <div className="flex h-full gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-2 rounded-md p-2.5" style={{ background: skin.block, opacity: 0.85 }}>
              <Bar w="90%" h={6} skin={skin} />
              <Bar w="75%" h={6} skin={skin} />
              <div className="mt-auto flex items-center gap-2">{blk({ width: 16, height: 16, borderRadius: 999 })}<Bar w="40%" h={6} skin={skin} /></div>
            </div>
          ))}
        </div>
      );
    case 'stack':
      return (
        <div className="flex h-full flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded p-2" style={{ background: skin.block, opacity: 0.7 }}>
              <Bar w="55%" h={6} skin={skin} />{blk({ width: 10, height: 10, borderRadius: 2 })}
            </div>
          ))}
        </div>
      );
    case 'footer':
      return (
        <div className="flex h-full flex-col justify-end gap-3">
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-1 flex-col gap-1.5"><Bar w="50%" h={7} skin={skin} /><Bar w="80%" h={5} skin={skin} /><Bar w="70%" h={5} skin={skin} /></div>
            ))}
          </div>
          <Bar w="100%" h={6} skin={skin} />
        </div>
      );
    case 'header':
      return (
        <div className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between"><Bar w="22%" h={10} skin={skin} /><div className="flex gap-2"><Bar w="34" h={6} skin={skin} /><Bar w="34" h={6} skin={skin} /><Bar w="34" h={6} skin={skin} /></div></div>
          <div className="flex flex-1 flex-col justify-center gap-2"><Bar w="60%" h={12} skin={skin} /><Bar w="40%" h={7} skin={skin} /></div>
        </div>
      );
    case 'form':
      return (
        <div className="flex h-full gap-3">
          <div className="flex flex-1 flex-col justify-center gap-2"><Bar w="70%" h={10} skin={skin} /><Bar w="90%" h={6} skin={skin} /><Bar w="80%" h={6} skin={skin} /></div>
          <div className="flex flex-1 flex-col gap-2 rounded-md p-2" style={{ background: skin.block, opacity: 0.8 }}>
            <Bar w="100%" h={12} skin={skin} /><Bar w="100%" h={12} skin={skin} /><Bar w="50%" h={12} skin={skin} r={4} />
          </div>
        </div>
      );
    case 'grid':
      return (
        <div className="grid h-full grid-cols-3 grid-rows-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: skin.block, borderRadius: 6 }} />
          ))}
        </div>
      );
    case 'page':
      return (
        <div className="flex h-full flex-col gap-2">
          <Bar w="65%" h={12} skin={skin} />
          <Bar w="45%" h={6} skin={skin} />
          <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="flex-1" style={{ height: 26, background: skin.block, borderRadius: 5 }} />)}</div>
          <div className="grid flex-1 grid-cols-2 gap-2">{[0, 1].map((i) => <div key={i} style={{ background: skin.block, borderRadius: 5 }} />)}</div>
        </div>
      );
    case 'pack': {
      // a deck of layout cards: two offset cards behind + a front card with a
      // mini thumbnail + lines, so it reads as "a bundle of layouts".
      const ink = skin.onDark ? 'rgba(255,255,255,0.22)' : 'rgba(11,53,88,0.13)';
      return (
        <div className="relative h-full">
          <div className="absolute rounded-md" style={{ inset: 0, background: skin.block, opacity: 0.45, transform: 'translate(16px, 16px)' }} />
          <div className="absolute rounded-md" style={{ inset: 0, background: skin.block, opacity: 0.7, transform: 'translate(8px, 8px)' }} />
          <div className="absolute flex flex-col gap-2 rounded-md p-3" style={{ inset: 0, background: skin.block }}>
            <div style={{ height: '46%', borderRadius: 4, background: ink }} />
            <div style={{ height: 7, width: '70%', borderRadius: 3, background: ink }} />
            <div style={{ height: 7, width: '48%', borderRadius: 3, background: ink }} />
          </div>
        </div>
      );
    }
  }
}

export function PreviewSkeleton({
  type,
  color,
  layoutStyle,
  label,
}: {
  type?: string | null;
  color?: string | null;
  layoutStyle?: string | null;
  label?: string | null;
}) {
  const archetype = skeletonForType(type);
  const skin = skinForLayout({ color, style: layoutStyle });
  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: skin.bg }}>
      <div className="flex h-[14px] shrink-0 items-center gap-1 px-2" style={{ background: skin.bar }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: skin.onDark ? 'rgba(255,255,255,0.3)' : 'rgba(11,53,88,0.25)' }} />
        ))}
      </div>
      <div className="flex-1 p-[7%]">
        <Skeleton archetype={archetype} skin={skin} />
      </div>
      {label && (
        <span
          className="absolute bottom-2 left-2 rounded px-2 py-0.5 text-[11px] font-medium capitalize"
          style={skin.onDark ? { background: 'rgba(0,0,0,0.4)', color: '#cbd5e1' } : { background: 'rgba(255,255,255,0.82)', color: '#476788' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
