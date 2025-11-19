import Link from 'next/link'

export default function SearchPage() {
  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-4xl font-bold">Keyword Research</h1>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-4 text-lg text-gray-600 dark:text-gray-400">
            The keyword research form will be implemented in Phase 2: Core UI
            Components.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Coming soon: Enter keywords, select match type, and get instant
            results with search volume, difficulty, CPC, and more!
          </p>
        </div>
      </div>
    </div>
  )
}
