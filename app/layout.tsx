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

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Divi5Lab — Divi 5 Layouts',
  description: 'Conversion-ready Divi 5 layouts, validated and ready to import.',
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
