import './globals.css';
import 'material-icons/iconfont/outlined.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Poppins } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { SessionProvider } from 'next-auth/react';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd, siteNavigationJsonLd, organizationId } from '@/lib/seo';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { AnnouncementBar } from '@/components/site/AnnouncementBar';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';
import { env } from '@/lib/env';
import { SITE_TITLE, SITE_DESCRIPTION, SOCIAL_DESCRIPTION } from '@/lib/site/brand';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
// Display face for headings/eyebrows only. Body copy stays on Inter, which
// reads better at length across the guides and catalog.
const poppins = Poppins({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' });

const GA_ID = env.NEXT_PUBLIC_GA_ID ?? 'G-YCK6MN99PR';

// Site-wide title and description come from lib/site/brand.ts (converter-first);
// /browse keeps its own layouts-focused title so the two pages do not compete
// for the same SERP label.
const TITLE = SITE_TITLE;
const DESCRIPTION = SITE_DESCRIPTION;

// Site-wide brand entity + sitelinks search box (entity SEO). Add real social
// profile URLs to `sameAs` as they go live to strengthen the brand entity.
const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
const SITE_JSONLD = [
  organizationJsonLd({
    name: 'Divi5Lab',
    url: SITE_URL,
    logo: `${SITE_URL}/divi5lab-logo-dark.png`,
    description: DESCRIPTION,
    email: 'support@divi5lab.com',
    sameAs: [],
  }),
  websiteJsonLd({
    name: 'Divi5Lab',
    url: SITE_URL,
    searchUrlTemplate: `${SITE_URL}/browse?q={search_term_string}`,
    publisherId: organizationId(SITE_URL),
  }),
  // The canonical set of sections we want Google to consider for sitelinks,
  // identical to the primary nav so on-page links and structured data agree.
  siteNavigationJsonLd([
    { name: 'Converters', url: `${SITE_URL}/plugins` },
    { name: 'Browse layouts', url: `${SITE_URL}/browse` },
    { name: 'Themes & Packs', url: `${SITE_URL}/packs` },
    { name: 'Guides', url: `${SITE_URL}/guides` },
    { name: 'Pricing', url: `${SITE_URL}/pricing` },
    { name: 'About', url: `${SITE_URL}/about` },
    { name: 'Contact', url: `${SITE_URL}/contact` },
  ]),
];

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: `${TITLE} | Divi5Lab`, template: '%s | Divi5Lab' },
  description: DESCRIPTION,
  keywords: ['elementor to divi 5', 'beaver builder to divi 5', 'wpbakery to divi 5', 'divi 5 converter', 'divi 5 layouts', 'free divi layouts', 'divi sections', 'divi 5'],
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.png', shortcut: '/favicon.png', apple: '/favicon.png' },
  openGraph: { type: 'website', siteName: 'Divi5Lab', url: '/', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: SOCIAL_DESCRIPTION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans">
        <JsonLd data={SITE_JSONLD} />
        <SessionProvider>
          <BookmarksProvider>
            <AnnouncementBar />
            <Header />
            {children}
            <Footer />
          </BookmarksProvider>
        </SessionProvider>
        <Analytics />
        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
      </body>
    </html>
  );
}
