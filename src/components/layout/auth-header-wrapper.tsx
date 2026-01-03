'use client'

import dynamic from 'next/dynamic'

// Lazy load auth header to reduce initial bundle size
const AuthHeader = dynamic(
  () =>
    import('./auth-header')
      .then(mod => mod.AuthHeader)
      .catch(err => {
        console.error('Failed to load AuthHeader component:', err)
        // Return a fallback component
        return () => null
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
