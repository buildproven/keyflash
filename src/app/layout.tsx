import type { Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import './globals.css'

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
          {/* Auth header - shown on all pages */}
          <header className="fixed top-0 right-0 p-4 z-50">
            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    Start Free Trial
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  },
                }}
              />
            </SignedIn>
          </header>
          <main className="min-h-screen">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  )
}
