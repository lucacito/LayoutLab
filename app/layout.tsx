import './globals.css';
import 'material-icons/iconfont/outlined.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { AnnouncementBar } from '@/components/site/AnnouncementBar';
import { BookmarksProvider } from '@/components/bookmarks/BookmarksProvider';
import { ExitIntentPopup } from '@/components/ExitIntentPopup';
import { ScrollOffer } from '@/components/ScrollOffer';
import { env } from '@/lib/env';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

const TITLE = 'Free Divi 5 Layouts & Sections — Validated & Import-Ready';
const DESCRIPTION =
  'Browse a growing library of free, validated Divi 5 layouts and sections — heroes, pricing tables, CTAs and full landing pages. Download the JSON and import into Divi 5 in seconds. Commercial license included.';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: `${TITLE} | Divi5Lab`, template: '%s | Divi5Lab' },
  description: DESCRIPTION,
  keywords: ['divi 5 layouts', 'free divi layouts', 'divi sections', 'divi templates', 'divi layout pack', 'divi 5'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'Divi5Lab', url: '/', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: 'Free, validated Divi 5 layouts & sections — import-ready JSON.' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <BookmarksProvider>
          <AnnouncementBar />
          <Header />
          {children}
          <Footer />
        </BookmarksProvider>
        <ExitIntentPopup />
        <ScrollOffer />
        <Analytics />
      </body>
    </html>
  );
}
