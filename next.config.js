/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable server-side rendering for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Preserve existing Vite structure
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    return config
  },
}

module.exports = nextConfig

