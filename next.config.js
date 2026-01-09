const { withSentryConfig } = require('@sentry/nextjs')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Performance: Enable experimental features
  experimental: {
    optimizePackageImports: [
      '@clerk/nextjs',
      '@upstash/redis',
      'zod',
      'stripe',
    ],
    webpackBuildWorker: true,
    // PERF: Enable optimized CSS loading
    optimizeCss: true,
  },

  // Performance: Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance: Static asset optimization
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Enforce HTTPS (HSTS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Cross-origin isolation headers
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Disable browser features that could be exploited
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // XSS protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://va.vercel-scripts.com", // Next.js + Clerk + Vercel Analytics
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: https: https://img.clerk.com",
              "font-src 'self' data:",
              "connect-src 'self' https://upstash.io https://*.upstash.io https://*.clerk.accounts.dev https://api.clerk.dev https://vitals.vercel-insights.com", // Added Vercel Analytics
              "frame-src 'self' https://*.clerk.accounts.dev", // Clerk auth modals
              "worker-src 'self' blob:", // Clerk service workers
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.clerk.accounts.dev",
            ].join('; '),
          },
        ],
      },
      // API-specific headers
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
      // Performance: Cache static assets aggressively
      {
        source:
          '/(.*).(jpg|jpeg|png|gif|ico|svg|webp|avif|woff|woff2|ttf|otf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Performance: Cache CSS and JS with revalidation
      {
        source: '/(.*).(css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // Request size limits for security
  async rewrites() {
    return []
  },
}

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
}

// Compose all config wrappers
let finalConfig = nextConfig

// Apply bundle analyzer
finalConfig = withBundleAnalyzer(finalConfig)

// Apply Sentry if configured
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  finalConfig = withSentryConfig(finalConfig, sentryWebpackPluginOptions)
}

module.exports = finalConfig
