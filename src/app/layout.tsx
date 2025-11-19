import type { Metadata } from 'next'
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
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  )
}
