export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600 dark:border-gray-700 dark:border-t-primary-500" />
      <p className="text-lg text-gray-600 dark:text-gray-400">
        Fetching keyword data...
      </p>
      <p className="text-sm text-gray-500">This should take less than 3 seconds</p>
    </div>
  );
}
