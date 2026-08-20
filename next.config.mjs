/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root — a stray package-lock.json in a parent dir otherwise
  // makes Next guess wrong.
  outputFileTracingRoot: import.meta.dirname,
  // Service worker + manifest are served from /public and registered manually
  // (see src/app/register-sw.tsx). We keep the config minimal and framework-portable.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
