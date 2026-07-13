'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';

export type ChatStep = {
  role: 'user' | 'assistant' | 'validator-fail' | 'validator-pass';
  text: string;
};

// Stepped "AI edit → validator verdict" transcript. SSR renders step one;
// the effect either reveals the rest on a timer or, under
// prefers-reduced-motion, all at once.
export function ValidatorChatDemo({ steps, className = '' }: { steps: ChatStep[]; className?: string }) {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    // No matchMedia (jsdom/tests) or reduced motion → show the finished transcript.
    const canAnimate =
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canAnimate) {
      setVisible(steps.length);
      return;
    }
    if (visible >= steps.length) return;

    const t = setTimeout(() => {
      setVisible((v) => v + 1);
    }, 1300);
    return () => clearTimeout(t);
  }, [visible, steps.length]);

  return (
    <div className={`rounded-card border border-border bg-paper p-5 shadow-soft sm:p-6 ${className}`} aria-label="AI Editor demo">
      <ol className="space-y-3">
        {steps.slice(0, visible).map((s, i) => (
          <li key={i} className={s.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {s.role === 'user' && (
              <p className="max-w-[85%] rounded-card rounded-br-none bg-action px-4 py-2.5 text-small font-medium text-paper">{s.text}</p>
            )}
            {s.role === 'assistant' && (
              <p className="max-w-[85%] rounded-card rounded-bl-none bg-fog px-4 py-2.5 font-mono text-small text-navy">{s.text}</p>
            )}
            {s.role === 'validator-fail' && (
              <p className="flex max-w-[85%] items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-2.5 font-mono text-small text-red-700">
                <Icon name="close" size={16} className="mt-0.5 shrink-0" /> {s.text}
              </p>
            )}
            {s.role === 'validator-pass' && (
              <p className="flex max-w-[85%] items-start gap-2 rounded-card border border-green-200 bg-green-50 px-4 py-2.5 font-mono text-small text-green-700">
                <Icon name="check" size={16} className="mt-0.5 shrink-0" /> {s.text}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
