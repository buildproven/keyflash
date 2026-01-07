'use client'

import dynamic from 'next/dynamic'

// Lazy load auth header to reduce initial bundle size
const AuthHeader = dynamic(
  () =>
    import('./auth-header')
      .then(mod => mod.AuthHeader)
      .catch(err => {
        console.error('CRITICAL: Failed to load AuthHeader component:', err)
        // Return error component instead of null to inform user
        return function AuthHeaderError() {
          return (
            <header className="fixed top-0 right-0 p-4 z-50">
              <div
                className="rounded-lg bg-red-50 p-2 dark:bg-red-900/20"
                role="alert"
              >
                <p className="text-xs font-medium text-red-800 dark:text-red-200">
                  Auth failed to load
                </p>
              </div>
            </header>
          )
        }
      }),
  {
    ssr: false,
    loading: () => (
      <header className="fixed top-0 right-0 p-4 z-50">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      </header>
    ),
  }
)

export function AuthHeaderWrapper() {
  return <AuthHeader />
}
