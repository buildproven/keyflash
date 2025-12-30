import { Redis } from '@upstash/redis'
import { logger } from '@/lib/utils/logger'

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
   */
  async createUser(
    clerkUserId: string,
    email: string
  ): Promise<UserData | null> {
    if (!this.isAvailable()) {
      logger.warn('UserService not available - Redis not configured', {
        module: 'UserService',
      })
      return null
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
      return null
    }
  }

  /**
   * Get user by Clerk user ID
   */
  async getUser(clerkUserId: string): Promise<UserData | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      return await this.client!.get<UserData>(
        `${USER_KEY_PREFIX}${clerkUserId}`
      )
    } catch (error) {
      logger.error('Failed to get user', error, {
        module: 'UserService',
        clerkUserId,
      })
      return null
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserData | null> {
    if (!this.isAvailable()) {
      return null
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
      return null
    }
  }

  /**
   * Get user by Stripe customer ID
   */
  async getUserByStripeCustomerId(
    stripeCustomerId: string
  ): Promise<UserData | null> {
    if (!this.isAvailable()) {
      return null
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
      return null
    }
  }

  /**
   * Update user data
   */
  async updateUser(
    clerkUserId: string,
    updates: Partial<UserData>
  ): Promise<UserData | null> {
    if (!this.isAvailable()) {
      return null
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
      logger.error('Failed to update user', error, {
        module: 'UserService',
        clerkUserId,
      })
      return null
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
   * Increment keyword usage for the month
   */
  async incrementKeywordUsage(
    clerkUserId: string,
    count: number = 1
  ): Promise<number | null> {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const user = await this.getUser(clerkUserId)
      if (!user) {
        return null
      }

      // Check if monthly reset is needed
      const now = new Date()
      const resetDate = new Date(user.monthlyResetAt)

      let newCount = user.keywordsUsedThisMonth + count
      let monthlyResetAt = user.monthlyResetAt

      if (now >= resetDate) {
        // Reset the counter
        newCount = count
        const nextReset = this.getNextMonthlyResetDate(now)
        monthlyResetAt = nextReset.toISOString()
      }

      await this.updateUser(clerkUserId, {
        keywordsUsedThisMonth: newCount,
        monthlyResetAt,
      })

      return newCount
    } catch (error) {
      logger.error('Failed to increment keyword usage', error, {
        module: 'UserService',
        clerkUserId,
      })
      return null
    }
  }

  /**
   * Check if user has exceeded their monthly keyword limit
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

    const now = new Date()
    const resetDate = new Date(user.monthlyResetAt)
    let effectiveUsed = user.keywordsUsedThisMonth

    if (now >= resetDate) {
      effectiveUsed = 0
      const nextReset = this.getNextMonthlyResetDate(now)
      await this.updateUser(clerkUserId, {
        keywordsUsedThisMonth: effectiveUsed,
        monthlyResetAt: nextReset.toISOString(),
      })
    }

    // Trial users: 300 keywords during 7-day trial
    // Pro users: 1,000 keywords/month
    const limits = {
      trial: 300,
      pro: 1000,
    }

    const limit = limits[user.tier]
    const trialExpired =
      user.tier === 'trial' && now > new Date(user.trialExpiresAt)

    return {
      allowed: !trialExpired && effectiveUsed < limit,
      used: effectiveUsed,
      limit,
      tier: user.tier,
      trialExpired,
    }
  }

  private getNextMonthlyResetDate(now: Date): Date {
    const nextReset = new Date(now)
    nextReset.setMonth(nextReset.getMonth() + 1)
    nextReset.setDate(1)
    nextReset.setHours(0, 0, 0, 0)
    return nextReset
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
