import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthHeaderWrapper } from '@/components/layout/auth-header-wrapper'
import { WebVitals } from './web-vitals'
import { PerformanceMonitor } from './performance-monitor'
import { getAppUrl } from '@/lib/utils/app-url'
import './globals.css'

const baseUrl = getAppUrl()

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'KeyFlash - Fast & Affordable Keyword Research',
    template: '%s | KeyFlash',
  },
  description:
    'Get keyword research results in under 3 seconds. 10x cheaper than Ahrefs, SEMrush, and Moz. Open-source keyword research tool for entrepreneurs and marketers.',
  keywords: ['keyword research', 'SEO', 'search volume', 'keyword difficulty'],
  authors: [{ name: 'KeyFlash Contributors' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'KeyFlash - Fast & Affordable Keyword Research',
    description:
      'Get keyword research results in under 3 seconds. 10x cheaper than competitors.',
    type: 'website',
    url: baseUrl,
    siteName: 'KeyFlash',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KeyFlash - Fast & Affordable Keyword Research',
    description:
      'Get keyword research results in under 3 seconds. 10x cheaper than competitors.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'KeyFlash',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Fast and affordable keyword research tool for SEO professionals and marketers.',
  url: baseUrl,
  offers: {
    '@type': 'Offer',
    price: '29',
    priceCurrency: 'USD',
    priceValidUntil: '2025-12-31',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '50',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* Preconnect only to critical origins used on initial page load */}
          <link
            rel="preconnect"
            href="https://clean-feline-0.clerk.accounts.dev"
            crossOrigin="anonymous"
          />
          {/* DNS prefetch for non-critical origins */}
          <link rel="dns-prefetch" href="https://api.stripe.com" />
          <link rel="dns-prefetch" href="https://api.dataforseo.com" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="font-sans antialiased">
          <WebVitals />
          <PerformanceMonitor />
          <AuthHeaderWrapper />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
