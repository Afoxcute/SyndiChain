/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    webpackBuildWorker: true,
    // Tree-shake lucide-react — eliminates all unused icon imports
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@rainbow-me/rainbowkit',
      'framer-motion',
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };

    if (!isServer) {
      // WalletConnect pulls in pino at runtime in the browser bundle.
      // Alias it to a no-op stub so it doesn't crash.
      config.resolve.alias['pino'] = require.resolve('./lib/pino-stub.js');
      config.resolve.alias['pino-pretty'] = require.resolve('./lib/pino-stub.js');
      config.resolve.alias['thread-stream'] = require.resolve('./lib/pino-stub.js');
    }

    // Keep these server-side only — they use native bindings or worker threads
    // that Next.js webpack cannot bundle.
    config.externals.push('lokijs', 'encoding', 'somnia-agent-kit', 'ioredis');

    return config;
  },
}

module.exports = nextConfig
