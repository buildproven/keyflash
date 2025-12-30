import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

// Lazy load auth header to reduce initial bundle size
const AuthHeader = dynamic(
  () => import('@/components/layout/auth-header').then(mod => mod.AuthHeader),
  {
    ssr: false,
    loading: () => (
      <header className="fixed top-0 right-0 p-4 z-50">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      </header>
    ),
  }
)

const baseUrl = 'https://keyflash.vibebuildlab.com'

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
          <link
            rel="preconnect"
            href="https://clean-feline-0.clerk.accounts.dev"
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="font-sans antialiased">
          <AuthHeader />
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}
