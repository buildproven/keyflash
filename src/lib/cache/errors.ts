/**
 * Redis Cache Error Classes
 * Provides structured error handling for cache operations
 */

/**
 * Base cache error class
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly operation?: string
  ) {
    super(message)
    this.name = 'CacheError'
    Object.setPrototypeOf(this, CacheError.prototype)
  }
}

/**
 * Redis connection/initialization failure
 * Indicates Redis is unreachable or misconfigured
 */
export class RedisConnectionError extends CacheError {
  constructor(message: string) {
    super(message)
    this.name = 'RedisConnectionError'
    Object.setPrototypeOf(this, RedisConnectionError.prototype)
  }
}

/**
 * Redis operation failure (transient)
 * Indicates a temporary failure that may succeed on retry
 */
export class RedisOperationError extends CacheError {
  constructor(message: string, operation: string) {
    super(message, operation)
    this.name = 'RedisOperationError'
    Object.setPrototypeOf(this, RedisOperationError.prototype)
  }
}

/**
 * Redis configuration error
 * Indicates missing or invalid configuration
 */
export class RedisConfigurationError extends CacheError {
  constructor(message: string) {
    super(message)
    this.name = 'RedisConfigurationError'
    Object.setPrototypeOf(this, RedisConfigurationError.prototype)
  }
}
