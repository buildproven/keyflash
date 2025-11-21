interface ErrorStateProps {
  error: string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-900/20"
      role="alert"
      aria-live="assertive"
      aria-labelledby="error-title"
      aria-describedby="error-message"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3
            id="error-title"
            className="text-sm font-medium text-red-800 dark:text-red-200"
          >
            Error
          </h3>
          <p
            id="error-message"
            className="mt-1 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600"
              aria-describedby="retry-help"
            >
              Try Again
            </button>
          )}
          {onRetry && (
            <p id="retry-help" className="sr-only">
              Click to retry the keyword search operation
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
