/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    webpackBuildWorker: true
  },
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    // somnia-agent-kit uses pino + thread-stream which spawn worker threads
    // that Next.js webpack cannot bundle — mark the whole SDK as external
    config.externals.push(
      'pino-pretty', 'lokijs', 'encoding',
      'somnia-agent-kit', 'pino', 'thread-stream'
    );
    return config;
  },
}

module.exports = nextConfig
