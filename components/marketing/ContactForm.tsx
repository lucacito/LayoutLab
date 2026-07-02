'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

type State = 'idle' | 'sending' | 'sent' | 'error';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-fog bg-paper p-6 text-body text-navy">
        <Icon name="mark_email_read" size={22} className="text-action" />
        Thanks — your message is on its way. We&apos;ll reply by email shortly.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-navy">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className="h-11 rounded-full border border-fog bg-paper px-4 text-body text-navy outline-none focus:border-action"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-small font-medium text-navy">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 rounded-full border border-fog bg-paper px-4 text-body text-navy outline-none focus:border-action"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-small font-medium text-navy">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={5000}
          rows={6}
          className="rounded-2xl border border-fog bg-paper px-4 py-3 text-body text-navy outline-none focus:border-action"
        />
      </label>
      {state === 'error' && (
        <p className="text-small text-red-600">Something went wrong sending your message. Please try again.</p>
      )}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-action px-6 text-small font-semibold text-paper transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
      >
        <Icon name="send" size={18} /> {state === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
