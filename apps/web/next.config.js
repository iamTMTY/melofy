/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @melofy/core is shipped as TypeScript source (no build step), so Next must
  // transpile it like app code.
  transpilePackages: ['@melofy/core'],
  experimental: {
    // Enable src/instrumentation.ts (Langfuse OTel tracing startup). Required on
    // Next 14; stable/default from Next 15 onward.
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
  // Reverse-proxy PostHog's ingestion through our own origin (/ingest) so
  // ad-blockers that block the PostHog domain don't drop analytics. US cloud;
  // swap `us` → `eu` in these three destinations for the EU region.
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
