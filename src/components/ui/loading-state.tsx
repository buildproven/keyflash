export function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center space-y-4 py-12"
      role="status"
      aria-live="polite"
      aria-labelledby="loading-title"
      aria-describedby="loading-description"
    >
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600 dark:border-gray-700 dark:border-t-primary-500"
        aria-hidden="true"
      />
      <p
        id="loading-title"
        className="text-lg text-gray-600 dark:text-gray-600"
      >
        Fetching keyword data...
      </p>
      <p id="loading-description" className="text-sm text-gray-500">
        This should take less than 3 seconds
      </p>
      {/* Screen reader only announcement */}
      <span className="sr-only">
        Loading keyword research data. Please wait, this usually takes less than
        3 seconds.
      </span>
    </div>
  )
}
