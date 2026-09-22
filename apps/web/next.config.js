const BUILD_ID = (process.env.GIT_SHA || '').slice(0, 12) || `local-${Date.now().toString(36)}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  reactStrictMode: true,
  transpilePackages: ['@melofy/core'],
  experimental: {
    instrumentationHook: true,
    // Don't bundle the OTel tracer / Langfuse tracing into route output — keep
    // them as runtime requires so OTel internals resolve correctly.
    serverComponentsExternalPackages: [
      '@opentelemetry/sdk-trace-node',
      '@langfuse/otel',
      '@langfuse/openai',
      '@langfuse/tracing',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  // PostHog capture requests must not be redirected on a trailing slash.
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
