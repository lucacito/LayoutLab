/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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
