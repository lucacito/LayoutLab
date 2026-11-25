// Magic links must not consume their single-use token on a plain GET: mail
// security scanners (and link previewers) open every URL in an email, so a
// token-consuming link is dead before the person clicks it. The emailed link
// therefore goes to /auth/confirm, a page that only shows a button; the button
// POSTs to /api/magic-link/continue, which redirects to the real Auth.js
// callback. Scanners GET/HEAD links; they do not submit forms.

export interface MagicLinkParams {
  token: string;
  email: string;
  callbackUrl?: string | null;
}

/** Turn an Auth.js email-callback URL into the scanner-safe confirm-page URL. */
export function toConfirmUrl(authJsUrl: string): string {
  const u = new URL(authJsUrl);
  return `${u.origin}/auth/confirm${u.search}`;
}

/** Rebuild the Auth.js callback URL on our own origin from confirm-form fields. */
export function callbackUrlFor(origin: string, { token, email, callbackUrl }: MagicLinkParams): string {
  const params = new URLSearchParams({ callbackUrl: safeCallback(origin, callbackUrl), token, email });
  return `${origin}/api/auth/callback/email?${params.toString()}`;
}

function safeCallback(origin: string, callbackUrl?: string | null): string {
  const fallback = `${origin}/account`;
  if (!callbackUrl) return fallback;
  try {
    const u = new URL(callbackUrl, origin);
    return u.origin === origin ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}
