import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

// Private areas that no crawler — search or AI — should index.
const PRIVATE = ['/admin', '/account', '/api'];

// Explicitly welcome the major AI answer engines and training crawlers. Being
// crawlable by these means being *citable* inside ChatGPT, Perplexity, Claude
// and Google AI Overviews, which increasingly drive product discovery (GEO).
// The actual product (layout JSON) is never exposed — downloads live under
// /api and require an entitlement — so only public marketing pages and
// screenshots are ever seen.
const AI_BOTS = [
  // OpenAI
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  // Anthropic
  'ClaudeBot', 'Claude-User', 'anthropic-ai',
  // Perplexity
  'PerplexityBot', 'Perplexity-User',
  // Google / Apple AI training
  'Google-Extended', 'Applebot-Extended',
  // Common Crawl + other AI crawlers
  'CCBot', 'Amazonbot', 'Meta-ExternalAgent', 'Bytespider',
];

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/', disallow: PRIVATE })),
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
