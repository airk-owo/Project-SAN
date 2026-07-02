/** @type {import('next').NextConfig} */
// The web app consumes the workspace engine as raw TypeScript (@wtk/game -> ./src/index.ts),
// so Next must transpile it during the production build (e.g. on Vercel).
const nextConfig = { transpilePackages: ['@wtk/game'] };
export default nextConfig;
