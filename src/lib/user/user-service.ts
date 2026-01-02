import { Redis } from '@upstash/redis'
import { logger } from '@/lib/utils/logger'
import { UserDataSchema } from '@/lib/validation/domain-schemas'

// FIX: Custom error classes for distinguishing service failures from "not found"
export class UserServiceUnavailableError extends Error {
  constructor(message: string = 'User service temporarily unavailable') {
    super(message)
    this.name = 'UserServiceUnavailableError'
  }
}

export class UserServiceOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message)
    this.name = 'UserServiceOperationError'
  }
}

export type UserTier = 'trial' | 'pro'

export interface UserData {
  clerkUserId: string
  email: string
  tier: UserTier
  trialStartedAt: string // ISO date
  trialExpiresAt: string // ISO date
  stripeCustomerId?: string
  subscriptionId?: string
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid'
  keywordsUsedThisMonth: number
  monthlyResetAt: string // ISO date
  createdAt: string
  updatedAt: string
}

const TRIAL_DAYS = 7
const USER_KEY_PREFIX = 'user:'
const EMAIL_INDEX_PREFIX = 'email:'
const STRIPE_CUSTOMER_PREFIX = 'stripe:'

class UserService {
  private client: Redis | null = null
  private isConfigured = false

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (url && token) {
      try {
        this.client = new Redis({ url, token })
        this.isConfigured = true
      } catch (error) {
        logger.error('Failed to initialize UserService Redis client', error, {
          module: 'UserService',
        })
      }
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.client !== null
  }

  /**
   * Create a new user with trial tier
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails
   */
  async createUser(clerkUserId: string, email: string): Promise<UserData> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    const now = new Date()
    const trialExpires = new Date(now)
    trialExpires.setDate(trialExpires.getDate() + TRIAL_DAYS)

    const monthlyReset = new Date(now)
    monthlyReset.setMonth(monthlyReset.getMonth() + 1)
    monthlyReset.setDate(1)
    monthlyReset.setHours(0, 0, 0, 0)

    const userData: UserData = {
      clerkUserId,
      email,
      tier: 'trial',
      trialStartedAt: now.toISOString(),
      trialExpiresAt: trialExpires.toISOString(),
      keywordsUsedThisMonth: 0,
      monthlyResetAt: monthlyReset.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    try {
      // Store user data
      await this.client!.set(`${USER_KEY_PREFIX}${clerkUserId}`, userData)

      // Create email index for lookup
      await this.client!.set(
        `${EMAIL_INDEX_PREFIX}${email.toLowerCase()}`,
        clerkUserId
      )

      logger.info('User created', {
        module: 'UserService',
        clerkUserId,
        tier: 'trial',
        trialExpiresAt: userData.trialExpiresAt,
      })

      return userData
    } catch (error) {
      logger.error('Failed to create user', error, {
        module: 'UserService',
        clerkUserId,
      })
      throw new UserServiceOperationError('Failed to create user', 'create')
    }
  }

  /**
   * Get user by Clerk user ID with runtime validation
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails or data validation fails
   * @returns UserData if found, null if not found
   */
  async getUser(clerkUserId: string): Promise<UserData | null> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    try {
      const raw = await this.client!.get<UserData>(
        `${USER_KEY_PREFIX}${clerkUserId}`
      )
      if (!raw) {
        return null
      }

      // Runtime validation to ensure data integrity
      return UserDataSchema.parse(raw)
    } catch (error) {
      logger.error('Failed to get user', error, {
        module: 'UserService',
        clerkUserId,
      })
      throw new UserServiceOperationError('Failed to get user', 'get')
    }
  }

  /**
   * Get user by email
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails
   * @returns UserData if found, null if not found
   */
  async getUserByEmail(email: string): Promise<UserData | null> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    try {
      const clerkUserId = await this.client!.get<string>(
        `${EMAIL_INDEX_PREFIX}${email.toLowerCase()}`
      )
      if (!clerkUserId) {
        return null
      }
      return this.getUser(clerkUserId)
    } catch (error) {
      logger.error('Failed to get user by email', error, {
        module: 'UserService',
        email,
      })
      throw new UserServiceOperationError('Failed to get user by email', 'get')
    }
  }

  /**
   * Get user by Stripe customer ID
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails
   * @returns UserData if found, null if not found
   */
  async getUserByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<UserData | null> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    try {
      const clerkUserId = await this.client!.get<string>(
        `${STRIPE_CUSTOMER_PREFIX}${stripeCustomerId}`
      )
      if (!clerkUserId) {
        return null
      }
      return this.getUser(clerkUserId)
    } catch (error) {
      logger.error('Failed to get user by Stripe customer ID', error, {
        module: 'UserService',
        stripeCustomerId,
      })
      throw new UserServiceOperationError(
        'Failed to get user by Stripe customer ID',
        'get'
      )
    }
  }

  /**
   * Update user data
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails
   * @returns Updated UserData if found, null if user not found
   */
  async updateUser(
    clerkUserId: string,
    updates: Partial<UserData>
  ): Promise<UserData | null> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    try {
      const existing = await this.getUser(clerkUserId)
      if (!existing) {
        logger.warn('User not found for update', {
          module: 'UserService',
          clerkUserId,
        })
        return null
      }

      const updated: UserData = {
        ...existing,
        ...updates,
        clerkUserId, // Never overwrite ID
        updatedAt: new Date().toISOString(),
      }

      await this.client!.set(`${USER_KEY_PREFIX}${clerkUserId}`, updated)

      // Update Stripe customer index if provided
      if (
        updates.stripeCustomerId &&
        updates.stripeCustomerId !== existing.stripeCustomerId
      ) {
        await this.client!.set(
          `${STRIPE_CUSTOMER_PREFIX}${updates.stripeCustomerId}`,
          clerkUserId
        )
      }

      return updated
    } catch (error) {
      // Re-throw service errors
      if (
        error instanceof UserServiceUnavailableError ||
        error instanceof UserServiceOperationError
      ) {
        throw error
      }
      logger.error('Failed to update user', error, {
        module: 'UserService',
        clerkUserId,
      })
      throw new UserServiceOperationError('Failed to update user', 'update')
    }
  }

  /**
   * Upgrade user to Pro tier
   */
  async upgradeToProTier(
    clerkUserId: string,
    stripeCustomerId: string,
    subscriptionId: string
  ): Promise<UserData | null> {
    return this.updateUser(clerkUserId, {
      tier: 'pro',
      stripeCustomerId,
      subscriptionId,
      subscriptionStatus: 'active',
    })
  }

  /**
   * Downgrade user to trial tier (subscription canceled)
   */
  async downgradeToTrialTier(clerkUserId: string): Promise<UserData | null> {
    return this.updateUser(clerkUserId, {
      tier: 'trial',
      subscriptionStatus: 'canceled',
    })
  }

  /**
   * Increment keyword usage for the month using atomic Redis operations
   * @throws UserServiceUnavailableError if service is not available
   * @throws UserServiceOperationError if Redis operation fails
   * @returns New count if successful, null if user not found
   */
  async incrementKeywordUsage(
    clerkUserId: string,
    count: number = 1
  ): Promise<number | null> {
    if (!this.isAvailable()) {
      throw new UserServiceUnavailableError('UserService not available')
    }

    try {
      // Verify user exists
      const user = await this.getUser(clerkUserId)
      if (!user) {
        return null
      }

      const { usageKey, ttl } = this.getUsageKeyForUser(user)

      // Atomic increment + set expiry (no race condition)
      const newCount = await this.client!.incrby(usageKey, count)
      await this.client!.expire(usageKey, ttl)

      logger.debug('Incremented keyword usage', {
        module: 'UserService',
        clerkUserId,
        count,
        newCount,
        usageKey,
      })

      return newCount
    } catch (error) {
      // Re-throw service errors
      if (
        error instanceof UserServiceUnavailableError ||
        error instanceof UserServiceOperationError
      ) {
        throw error
      }
      logger.error('Failed to increment keyword usage', error, {
        module: 'UserService',
        clerkUserId,
      })
      throw new UserServiceOperationError(
        'Failed to increment keyword usage',
        'increment'
      )
    }
  }

  /**
   * Check if user has exceeded their monthly keyword limit
   * Uses TTL-based usage keys - no manual reset needed
   */
  async checkKeywordLimit(clerkUserId: string): Promise<{
    allowed: boolean
    used: number
    limit: number
    tier: UserTier
    trialExpired?: boolean
  } | null> {
    const user = await this.getUser(clerkUserId)
    if (!user) {
      return null
    }

    // Check trial expiration (only for trial tier users)
    const now = new Date()
    const trialExpires = new Date(user.trialExpiresAt)
    const trialExpired = user.tier === 'trial' && now > trialExpires

    if (trialExpired) {
      return {
        allowed: false,
        used: 0,
        limit: 0,
        tier: user.tier,
        trialExpired: true,
      }
    }

    // Get usage from tier-specific TTL key (auto-resets via expiry)
    const usageKey =
      user.tier === 'trial'
        ? this.getUsageKeyForTrial(user)
        : this.getUsageKeyForMonth(clerkUserId)
    const used = (await this.client!.get(usageKey)) || 0

    // Trial users: 300 keywords during 7-day trial
    // Pro users: 1,000 keywords/month
    const limits = {
      trial: 300,
      pro: 1000,
    }

    const limit = limits[user.tier]

    return {
      allowed: Number(used) < limit,
      used: Number(used),
      limit,
      tier: user.tier,
      trialExpired: false,
    }
  }

  /**
   * Get the current month's usage key for atomic tracking
   * Format: usage:{userId}:{YYYY-MM}
   */
  private getUsageKeyForMonth(clerkUserId: string): string {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return `usage:${clerkUserId}:${yearMonth}`
  }

  /**
   * Get TTL for usage key (seconds until end of current month)
   */
  private getUsageKeyTTL(): number {
    const now = new Date()
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const secondsUntilEnd = Math.floor(
      (endOfMonth.getTime() - now.getTime()) / 1000
    )
    return Math.max(secondsUntilEnd, 3600) // Minimum 1 hour
  }

  private getUsageKeyForTrial(user: UserData): string {
    const trialStart = new Date(user.trialStartedAt).toISOString().slice(0, 10)
    return `trial-usage:${user.clerkUserId}:${trialStart}`
  }

  private getTrialUsageTTL(user: UserData): number {
    const now = new Date()
    const trialExpires = new Date(user.trialExpiresAt)
    const secondsUntilEnd = Math.floor(
      (trialExpires.getTime() - now.getTime()) / 1000
    )
    return Math.max(secondsUntilEnd, 3600)
  }

  private getUsageKeyForUser(user: UserData): {
    usageKey: string
    ttl: number
  } {
    if (user.tier === 'trial') {
      return {
        usageKey: this.getUsageKeyForTrial(user),
        ttl: this.getTrialUsageTTL(user),
      }
    }

    return {
      usageKey: this.getUsageKeyForMonth(user.clerkUserId),
      ttl: this.getUsageKeyTTL(),
    }
  }

  /**
   * Get or create user (for webhook handling)
   */
  async getOrCreateUser(
    clerkUserId: string,
    email: string
  ): Promise<UserData | null> {
    const existing = await this.getUser(clerkUserId)
    if (existing) {
      return existing
    }
    return this.createUser(clerkUserId, email)
  }
}

// Export singleton
export const userService = new UserService()

// Export class for testing
export { UserService }
