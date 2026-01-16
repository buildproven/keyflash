/**
 * Application Startup Configuration
 *
 * Validates environment and initializes application state
 * before serving any requests.
 */

import { validateEnvironment } from './env-validation'
import { validateHealthChecks } from './health-checks'
import { logger } from '@/lib/utils/logger'

/**
 * Initialize application configuration and dependencies
 *
 * This runs once at startup to ensure the application
 * is properly configured before accepting requests.
 *
 * In development, only performs basic checks to avoid blocking dev workflow.
 * In production, performs full validation and fails fast on missing config.
 */
export async function initializeApp(): Promise<void> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isTest = process.env.NODE_ENV === 'test'

  if (isTest) {
    // Skip validation in test environment
    return
  }

  if (isDevelopment) {
    // Development: skip environment validation entirely to avoid noise
    logger.info('🔧 Development mode: environment validation skipped', {
      module: 'Startup',
    })
    logger.info('💡 Set NODE_ENV=production for strict validation', {
      module: 'Startup',
    })
  } else {
    // Production: strict validation with fast failure
    logger.info(
      '🏭 Production mode: performing strict environment validation',
      {
        module: 'Startup',
      }
    )
    validateEnvironment() // This will exit on failure

    // CODE-010: Validate critical services are available
    logger.info('🔍 Validating service health...', {
      module: 'Startup',
    })
    await validateHealthChecks() // This will throw on failure
  }

  // Mark initialization as complete
  logger.info('🚀 KeyFlash application initialized successfully', {
    module: 'Startup',
  })
}

// Auto-initialize when this module is imported
// This ensures validation happens at startup time
async function safeInit() {
  try {
    await initializeApp()
  } catch (error) {
    logger.error('Application initialization failed', error, {
      module: 'Startup',
    })
    process.exit(1)
  }
}

if (process.env.NODE_ENV !== 'test') {
  safeInit()
}
