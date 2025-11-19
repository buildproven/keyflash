import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="max-w-4xl text-center">
        {/* Hero Section */}
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-6xl">
          KeyFlash
        </h1>
        <p className="mb-8 text-xl text-gray-600 dark:text-gray-300">
          Fast, Simple, Affordable Keyword Research
        </p>

        {/* Value Propositions */}
        <div className="mb-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-3xl font-bold text-primary-600">
              &lt;3s
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Lightning Fast
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get keyword research results in under 3 seconds
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-3xl font-bold text-primary-600">3</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Maximum Clicks
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              From landing page to results in 3 clicks or less
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 text-3xl font-bold text-primary-600">10x</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              More Affordable
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              10x cheaper than Ahrefs, SEMrush, and Moz
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="mb-8">
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-colors hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-300"
          >
            Start Researching Keywords
          </Link>
        </div>

        {/* Features List */}
        <div className="mx-auto max-w-2xl text-left">
          <h2 className="mb-4 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
            Everything You Need
          </h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <svg
                className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Search volume, keyword difficulty, and CPC data</span>
            </li>
            <li className="flex items-start">
              <svg
                className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Bulk keyword research (up to 200 keywords at once)</span>
            </li>
            <li className="flex items-start">
              <svg
                className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Export results to CSV for easy analysis</span>
            </li>
            <li className="flex items-start">
              <svg
                className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Privacy-focused: we don&apos;t store your searches</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-12 text-sm text-gray-500">
          <p>
            Open source and proudly built for entrepreneurs, content creators,
            and small marketing teams.
          </p>
          <p className="mt-2">
            <a
              href="https://github.com/brettstark73/keyflash"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 hover:underline"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
