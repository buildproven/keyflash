import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

/**
 * Environment Configuration Validation
 *
 * Validates all required environment variables at application startup
 * to fail fast rather than at runtime when features are accessed.
 *
 * Security benefit: Prevents partial application startup with missing
 * security-critical configuration (rate limiting, caching, etc.)
 */

// Define required environment schema
const envSchema = z.object({
  // Core application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Provider configuration (at least one must be valid)
  KEYWORD_API_PROVIDER: z
    .enum(['mock', 'google-ads', 'dataforseo'])
    .default('mock'),

  // Google Ads API (optional unless provider is google-ads)
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),

  // DataForSEO API (optional unless provider is dataforseo)
  DATAFORSEO_API_LOGIN: z.string().optional(),
  DATAFORSEO_API_PASSWORD: z.string().optional(),

  // API Rate Limits (CODE-007: Configurable rate limits)
  DATAFORSEO_RATE_LIMIT_REQUESTS: z.coerce.number().min(1).default(2000),
  DATAFORSEO_BATCH_LIMIT: z.coerce.number().min(1).default(10000),
  GOOGLE_ADS_RATE_LIMIT_REQUESTS: z.coerce.number().min(1).default(1000),
  GOOGLE_ADS_BATCH_LIMIT: z.coerce.number().min(1).default(1000),

  // Redis cache (optional but recommended for production)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Security settings
  PRIVACY_MODE: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
  RATE_LIMIT_REQUESTS_PER_HOUR: z.coerce
    .number()
    .min(1)
    .max(10000)
    .default(10)
    .refine(val => !isNaN(val), 'Must be a valid number'),
  RATE_LIMIT_HMAC_SECRET: z.string().min(32).optional(),
  RATE_LIMIT_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_FAIL_SAFE: z.enum(['open', 'closed']).default('closed'),

  // Package version for health checks
  npm_package_version: z.string().optional(),
})

// Refined validation with provider-specific requirements
function validateProviderConfig(env: z.infer<typeof envSchema>): void {
  if (env.KEYWORD_API_PROVIDER === 'google-ads') {
    const requiredFields = [
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_REFRESH_TOKEN',
      'GOOGLE_ADS_CUSTOMER_ID',
    ] as const

    // eslint-disable-next-line security/detect-object-injection -- field is from controlled requiredFields array, env is validated object
    const missing = requiredFields.filter(field => !env[field])
    if (missing.length > 0) {
      throw new Error(
        `Google Ads provider selected but missing required environment variables: ${missing.join(', ')}`
      )
    }
  }

  if (env.KEYWORD_API_PROVIDER === 'dataforseo') {
    const requiredFields = [
      'DATAFORSEO_API_LOGIN',
      'DATAFORSEO_API_PASSWORD',
    ] as const
    // eslint-disable-next-line security/detect-object-injection -- field is from controlled requiredFields array, env is validated object
    const missing = requiredFields.filter(field => !env[field])
    if (missing.length > 0) {
      throw new Error(
        `DataForSEO provider selected but missing required environment variables: ${missing.join(', ')}`
      )
    }
  }
}

// Validate Redis configuration for production
function validateRedisConfig(env: z.infer<typeof envSchema>): void {
  if (env.NODE_ENV === 'production' && env.PRIVACY_MODE !== 'true') {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      logger.warn(
        '⚠️  Production environment detected without Redis configuration. ' +
          'Caching will be disabled, which may impact performance. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for optimal performance.',
        { module: 'EnvValidation' }
      )
    }
  }
}

// Validate rate limiting configuration
function validateRateLimitConfig(env: z.infer<typeof envSchema>): void {
  if (env.RATE_LIMIT_ENABLED === 'true') {
    if (!env.RATE_LIMIT_HMAC_SECRET && env.NODE_ENV === 'production') {
      throw new Error(
        'RATE_LIMIT_HMAC_SECRET is required in production when rate limiting is enabled. ' +
          'Generate a secure random string (minimum 32 characters) to prevent bypass attacks.'
      )
    }

    if (
      env.NODE_ENV === 'production' &&
      env.RATE_LIMIT_TRUST_PROXY !== 'true'
    ) {
      throw new Error(
        'RATE_LIMIT_TRUST_PROXY must be true in production when rate limiting is enabled. ' +
          'Set RATE_LIMIT_TRUST_PROXY=true to only trust proxy-provided IP headers.'
      )
    }

    if (env.RATE_LIMIT_REQUESTS_PER_HOUR < 5) {
      logger.warn(
        `⚠️  Rate limit set very low (${env.RATE_LIMIT_REQUESTS_PER_HOUR}/hour). ` +
          'This may impact legitimate usage.',
        { module: 'EnvValidation' }
      )
    }
  }
}

/**
 * Validates and returns the application configuration
 *
 * @throws {Error} If required environment variables are missing or invalid
 * @returns Validated environment configuration
 */
export function validateEnvironment() {
  try {
    // Parse basic schema
    const env = envSchema.parse(process.env)

    // Additional provider-specific validation
    validateProviderConfig(env)

    // Production-specific validations (warnings)
    validateRedisConfig(env)
    validateRateLimitConfig(env)

    // Log configuration summary (without secrets)
    logger.info('✅ Environment configuration validated successfully', {
      module: 'EnvValidation',
    })
    logger.info(`📦 Provider: ${env.KEYWORD_API_PROVIDER}`, {
      module: 'EnvValidation',
    })
    logger.info(`🔒 Privacy mode: ${env.PRIVACY_MODE}`, {
      module: 'EnvValidation',
    })
    logger.info(
      `⚡ Rate limiting: ${env.RATE_LIMIT_ENABLED} (${env.RATE_LIMIT_REQUESTS_PER_HOUR}/hour)`,
      { module: 'EnvValidation' }
    )
    logger.info(
      `💾 Redis: ${env.UPSTASH_REDIS_REST_URL ? 'configured' : 'not configured'}`,
      { module: 'EnvValidation' }
    )

    return env
  } catch (error) {
    const shouldLogErrors =
      process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true'
    if (shouldLogErrors) {
      console.error('❌ Environment configuration validation failed:')
    }

    let errorMessage = 'Environment validation failed'

    if (error instanceof z.ZodError) {
      const issues = error.issues.map(
        issue => `${issue.path.join('.')}: ${issue.message}`
      )
      if (shouldLogErrors) {
        console.error(issues.map(issue => `   • ${issue}`).join('\n'))
      }
      errorMessage = `Environment validation failed: ${issues.join(', ')}`
    } else if (error instanceof Error) {
      const message = error.message
      if (shouldLogErrors) {
        console.error(`   • ${message}`)
      }
      errorMessage = `Environment validation failed: ${message}`
    } else {
      // Handle unknown error types
      if (shouldLogErrors) {
        console.error('   • Unknown error type:', error)
      }
      errorMessage = 'Environment validation failed: Unknown error'
    }

    if (shouldLogErrors) {
      console.error('\n📖 See .env.example for required environment variables')
    }

    // Throw error instead of process.exit to allow proper error handling
    // In development, this will be caught by startup.ts try/catch
    // In production, this will still cause the app to fail but with better logging
    throw new Error(errorMessage)
  }
}

/**
 * Type-safe environment configuration
 */
export type ValidatedEnv = ReturnType<typeof validateEnvironment>
