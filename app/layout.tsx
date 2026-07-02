import './globals.css';
import 'material-icons/iconfont/outlined.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { SessionProvider } from 'next-auth/react';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { InternalLinksBand } from '@/components/site/InternalLinksBand';
import { AnnouncementBar } from '@/components/site/AnnouncementBar';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';
import { ExitIntentPopup } from '@/components/ExitIntentPopup';
import { ScrollOffer } from '@/components/ScrollOffer';
import { env } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

const GA_ID = env.NEXT_PUBLIC_GA_ID ?? 'G-YCK6MN99PR';

const TITLE = 'Free Divi 5 Layouts & Sections — Validated & Import-Ready';
const DESCRIPTION =
  'Browse a growing library of free, validated Divi 5 layouts and sections — heroes, pricing tables, CTAs and full landing pages. Download the JSON and import into Divi 5 in seconds. Commercial license included.';

// Site-wide brand entity + sitelinks search box (entity SEO). Add real social
// profile URLs to `sameAs` as they go live to strengthen the brand entity.
const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
const SITE_JSONLD = [
  organizationJsonLd({
    name: 'Divi5Lab',
    url: SITE_URL,
    logo: `${SITE_URL}/divi5lab-logo.png`,
    description: DESCRIPTION,
    sameAs: [],
  }),
  websiteJsonLd({
    name: 'Divi5Lab',
    url: SITE_URL,
    searchUrlTemplate: `${SITE_URL}/browse?q={search_term_string}`,
  }),
];

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: `${TITLE} | Divi5Lab`, template: '%s | Divi5Lab' },
  description: DESCRIPTION,
  keywords: ['divi 5 layouts', 'free divi layouts', 'divi sections', 'divi templates', 'divi layout pack', 'divi 5'],
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  openGraph: { type: 'website', siteName: 'Divi5Lab', url: '/', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: 'Free, validated Divi 5 layouts & sections — import-ready JSON.' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <JsonLd data={SITE_JSONLD} />
        <SessionProvider>
          <BookmarksProvider>
            <AnnouncementBar />
            <Header />
            {children}
            <InternalLinksBand />
            <Footer />
          </BookmarksProvider>
        </SessionProvider>
        <ExitIntentPopup />
        <ScrollOffer />
        <Analytics />
        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
      </body>
    </html>
  );
}
