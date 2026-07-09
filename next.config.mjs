/** @type {import('next').NextConfig} */
const nextConfig = {
  // The download routes read lib/license/commercial-license.txt at runtime via
  // readFileSync. Force it into the serverless function bundle so the read can
  // never ENOENT on Vercel (which would 500 the download).
  outputFileTracingIncludes: {
    '/api/download/**': ['./lib/license/commercial-license.txt'],
  },
  images: {
    // Screenshots are pre-optimized by the pipeline (WebP, ≤1600px, ~≤250KB), so
    // Vercel's Image Optimization adds cost (transformation quota) without value.
    // Serve every image as-is.
    unoptimized: true,
    remotePatterns: [
      // Preview screenshots are served from Vercel Blob (pipeline output).
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      // Phase 1 seed previews (placeholder image service).
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default nextConfig;
