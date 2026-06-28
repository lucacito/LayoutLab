/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Preview screenshots are served from Vercel Blob.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
