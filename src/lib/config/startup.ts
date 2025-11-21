/**
 * Application Startup Configuration
 *
 * Validates environment and initializes application state
 * before serving any requests.
 */

import { validateEnvironment } from './env-validation'

/**
 * Initialize application configuration and dependencies
 *
 * This runs once at startup to ensure the application
 * is properly configured before accepting requests.
 *
 * In development, only performs basic checks to avoid blocking dev workflow.
 * In production, performs full validation and fails fast on missing config.
 */
export function initializeApp(): void {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) {
    // Skip validation in test environment
    return
  }

  /* eslint-disable no-console -- Intentional operational logging during application startup */
  if (isDevelopment) {
    // Development: skip environment validation entirely to avoid noise
    console.info('🔧 Development mode: environment validation skipped')
    console.info('💡 Set NODE_ENV=production for strict validation')
  } else {
    // Production: strict validation with fast failure
    console.info('🏭 Production mode: performing strict environment validation')
    validateEnvironment() // This will exit on failure
  }

  // Mark initialization as complete
  console.info('🚀 KeyFlash application initialized successfully')
  /* eslint-enable no-console */
}

// Auto-initialize when this module is imported
// This ensures validation happens at startup time
if (process.env.NODE_ENV !== 'test') {
  initializeApp()
}
