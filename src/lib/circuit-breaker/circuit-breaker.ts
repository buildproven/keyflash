/**
 * Circuit Breaker Pattern Implementation
 * ARCH-002: DataForSEO failover/circuit breaker strategy
 *
 * Prevents cascading failures by monitoring service health and failing fast
 * when a dependency is unavailable.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unhealthy, requests fail fast without calling service
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * Configuration:
 * - Failure threshold: 5 failures within window → OPEN
 * - Timeout: 60 seconds in OPEN state before trying HALF_OPEN
 * - Success threshold: 2 successes in HALF_OPEN → CLOSED
 */

import { logger } from '@/lib/utils/logger'

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time window for counting failures (ms) */
  failureWindow: number
  /** How long to wait before attempting recovery (ms) */
  resetTimeout: number
  /** Number of successes needed to close circuit from half-open */
  successThreshold: number
  /** Name for logging */
  name: string
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime: number | null
  lastSuccessTime: number | null
  nextAttemptTime: number | null
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message)
    this.name = 'CircuitBreakerError'
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private successes = 0
  private lastFailureTime: number | null = null
  private lastSuccessTime: number | null = null
  private nextAttemptTime: number | null = null
  private failureTimestamps: number[] = []
  private totalRequests = 0
  private totalFailures = 0
  private totalSuccesses = 0

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection
   * @param fn - Async function to execute
   * @returns Result of function execution
   * @throws CircuitBreakerError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++

    // Check if circuit is open
    if (this.state === 'OPEN') {
      // Check if we should attempt recovery
      if (
        this.nextAttemptTime &&
        Date.now() >= this.nextAttemptTime
      ) {
        logger.info('Circuit breaker attempting recovery', {
          module: 'CircuitBreaker',
          name: this.config.name,
          previousState: 'OPEN',
          newState: 'HALF_OPEN',
        })
        this.state = 'HALF_OPEN'
        this.successes = 0
      } else {
        // Circuit still open, fail fast
        const error = new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.config.name}. Service is unavailable.`,
          this.state,
          this.getStats()
        )

        logger.warn('Circuit breaker rejected request (OPEN)', {
          module: 'CircuitBreaker',
          name: this.config.name,
          nextAttemptTime: this.nextAttemptTime,
        })

        throw error
      }
    }

    try {
      // Execute function
      const result = await fn()

      // Record success
      this.onSuccess()

      return result
    } catch (error) {
      // Record failure
      this.onFailure(error)

      // Re-throw original error
      throw error
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now()
    this.totalSuccesses++

    if (this.state === 'HALF_OPEN') {
      this.successes++

      logger.info('Circuit breaker recovery attempt succeeded', {
        module: 'CircuitBreaker',
        name: this.config.name,
        successes: this.successes,
        threshold: this.config.successThreshold,
      })

      // Check if we've had enough successes to close circuit
      if (this.successes >= this.config.successThreshold) {
        logger.info('Circuit breaker closing (service recovered)', {
          module: 'CircuitBreaker',
          name: this.config.name,
          previousState: 'HALF_OPEN',
          newState: 'CLOSED',
        })

        this.state = 'CLOSED'
        this.failures = 0
        this.successes = 0
        this.failureTimestamps = []
        this.nextAttemptTime = null
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failures = 0
      this.failureTimestamps = []
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(error: unknown): void {
    const now = Date.now()
    this.lastFailureTime = now
    this.totalFailures++

    // Add failure timestamp
    this.failureTimestamps.push(now)

    // Remove old failures outside the window
    const cutoff = now - this.config.failureWindow
    this.failureTimestamps = this.failureTimestamps.filter((t) => t > cutoff)

    // Count recent failures
    this.failures = this.failureTimestamps.length

    logger.warn('Circuit breaker recorded failure', {
      module: 'CircuitBreaker',
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    // Check if we should open circuit
    if (
      this.state !== 'OPEN' &&
      this.failures >= this.config.failureThreshold
    ) {
      this.state = 'OPEN'
      this.nextAttemptTime = now + this.config.resetTimeout

      logger.error('Circuit breaker opened (service unhealthy)', {
        module: 'CircuitBreaker',
        name: this.config.name,
        failures: this.failures,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      })
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    }
  }

  /**
   * Manually reset circuit to CLOSED state
   * Use with caution - typically circuit should recover automatically
   */
  reset(): void {
    logger.info('Circuit breaker manually reset', {
      module: 'CircuitBreaker',
      name: this.config.name,
      previousState: this.state,
    })

    this.state = 'CLOSED'
    this.failures = 0
    this.successes = 0
    this.failureTimestamps = []
    this.lastFailureTime = null
    this.nextAttemptTime = null
  }

  /**
   * Check if circuit is healthy (CLOSED or HALF_OPEN)
   */
  isHealthy(): boolean {
    return this.state !== 'OPEN'
  }
}

/**
 * Create a circuit breaker with standard configuration for external APIs
 */
export function createAPICircuitBreaker(name: string): CircuitBreaker {
  return new CircuitBreaker({
    name,
    failureThreshold: 5, // Open after 5 failures
    failureWindow: 60_000, // Within 60 seconds
    resetTimeout: 60_000, // Wait 60 seconds before trying again
    successThreshold: 2, // Close after 2 successes in half-open state
  })
}
