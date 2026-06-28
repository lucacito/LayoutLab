import type { Metadata } from 'next';

interface EntityMetaInput {
  title: string;
  description?: string | null;
  slug: string;
  ogImage?: string;
  keywords?: string[];
  siteUrl: string;
}

function baseMetadata(i: EntityMetaInput, canonical: string): Metadata {
  const description = i.description?.trim() || `Divi 5 layout: ${i.title}. Download-ready, validated, and ready to import.`;
  const images = i.ogImage ? [{ url: i.ogImage }] : [];
  return {
    title: i.title,
    description,
    keywords: i.keywords,
    alternates: { canonical },
    openGraph: { title: i.title, description, url: canonical, type: 'website', images },
    twitter: { card: 'summary_large_image', title: i.title, description, images: i.ogImage ? [i.ogImage] : [] },
  };
}

export function buildLayoutMetadata(i: EntityMetaInput): Metadata {
  return baseMetadata(i, `${i.siteUrl}/layouts/${i.slug}`);
}

export function buildPackMetadata(i: EntityMetaInput): Metadata {
  return baseMetadata(i, `${i.siteUrl}/packs/${i.slug}`);
}
