import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Hero */}
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          KeyFlash
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          Fast, simple keyword research. Get search volume, difficulty, and CPC
          data in seconds.
        </p>
        <div className="mt-8">
          <Link
            href="/search"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Start Researching
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-600">&lt;3s</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Results
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-600">200</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Keywords/batch
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-blue-600">10x</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Cheaper
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-6 text-center text-xl font-semibold text-slate-900 dark:text-white">
          What you get
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            'Search volume & trends',
            'Keyword difficulty scores',
            'CPC & competition data',
            'Related keyword suggestions',
            'Content brief generator',
            'CSV export',
          ].map(feature => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                ✓
              </span>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mx-auto max-w-3xl px-6 pb-12 text-center text-sm text-slate-500 dark:text-slate-400">
        <p>Privacy-focused • No searches stored • Open source</p>
        <p className="mt-2">
          <a
            href="https://github.com/brettstark73/keyflash"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            View on GitHub
          </a>
        </p>
      </div>
    </div>
  )
}
