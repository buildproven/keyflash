import Link from 'next/link'
import { Footer } from '@/components/layout/footer'

// Force static generation for optimal performance
export const dynamic = 'force-static'

export default function Home() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900" itemScope itemType="https://schema.org/WebPage">
      {/* Skip Link for Keyboard Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-blue-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
      >
        Skip to main content
      </a>
      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Keyword Research,
          <br />
          <span className="text-blue-700 dark:text-blue-400">
            Without the Bloat
          </span>
        </h1>
        <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
          Get search volume, difficulty, CPC, and trends for up to 200 keywords
          at once. Free and open source.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/search"
            className="inline-block rounded-lg bg-blue-600 px-8 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Start Searching
          </Link>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Bring your own DataForSEO API key
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              200
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-400">
              Keywords per search
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              Real
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-400">
              Google data
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              100%
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-400">
              Open source
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-6 text-center text-xl font-semibold text-slate-900 dark:text-white">
          Everything you need for keyword research
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: 'Search volume & trends',
              desc: '12-month historical data',
            },
            { title: 'Keyword difficulty', desc: 'See how hard to rank' },
            { title: 'CPC & competition', desc: 'Paid search insights' },
            { title: 'Related keywords', desc: 'Discover new opportunities' },
            { title: 'Content briefs', desc: 'AI-generated outlines' },
            { title: 'CSV export', desc: 'Take your data anywhere' },
          ].map(feature => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white dark:bg-blue-700 dark:text-white" aria-hidden="true">
                ✓
              </span>
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">
                  {feature.title}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-400">
                  {feature.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust signals */}
      <div className="mx-auto max-w-3xl px-6 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          Privacy-first: Your searches are never stored
        </div>
      </div>

      {/* Spacer to push footer down */}
      <div className="grow" />

      <Footer />
    </main>
  )
}
