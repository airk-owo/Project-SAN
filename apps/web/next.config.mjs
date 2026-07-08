/** @type {import('next').NextConfig} */
// The web app consumes the workspace engine as raw TypeScript (@wtk/game -> ./src/index.ts),
// so Next must transpile it during the production build (e.g. on Vercel).

// Security headers ทุก route — ยังไม่ใส่ CSP เพราะแอปพึ่ง inline <style> + websocket + Supabase
// (draft policy อยู่ใน docs/security-checklist.md)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  transpilePackages: ['@wtk/game'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
