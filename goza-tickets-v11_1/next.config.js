/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `next build` emits plain HTML/CSS/JS into out/.
  // Host-agnostic — deploys on Cloudflare Pages, Netlify, or any static host.
  output: 'export',
  images: { unoptimized: true },
};

module.exports = nextConfig;
