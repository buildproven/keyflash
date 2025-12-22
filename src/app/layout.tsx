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

export const metadata: Metadata = {
  title: 'KeyFlash - Fast & Affordable Keyword Research',
  description:
    'Get keyword research results in under 3 seconds. 10x cheaper than Ahrefs, SEMrush, and Moz. Open-source keyword research tool for entrepreneurs and marketers.',
  keywords: ['keyword research', 'SEO', 'search volume', 'keyword difficulty'],
  authors: [{ name: 'KeyFlash Contributors' }],
  openGraph: {
    title: 'KeyFlash - Fast & Affordable Keyword Research',
    description:
      'Get keyword research results in under 3 seconds. 10x cheaper than competitors.',
    type: 'website',
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
