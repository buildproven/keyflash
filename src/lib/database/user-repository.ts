/**
 * User Repository
 * ARCH-003: Database-backed user persistence
 *
 * Provides database operations for user management
 * Replaces/augments Redis-based user-service.ts
 */

import { prisma } from './prisma'
import { User, UserTier } from '@prisma/client'
import { logger } from '@/lib/utils/logger'
import { logDatabaseOperation } from '@/lib/observability/telemetry'

export interface CreateUserInput {
  id: string // Clerk user ID
  email: string
  tier?: UserTier
}

export interface UpdateUserInput {
  email?: string
  tier?: UserTier
  keywordSearchesThisMonth?: number
  monthlyResetAt?: Date
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  subscriptionStatus?: string
  subscriptionPlan?: string
  subscriptionEndsAt?: Date
  trialEndsAt?: Date
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    const start = Date.now()

    try {
      const user = await prisma.user.create({
        data: {
          id: input.id,
          email: input.email,
          tier: input.tier || UserTier.FREE,
          monthlyResetAt: new Date(),
        },
      })

      logDatabaseOperation('createUser', Date.now() - start, true, {
        userId: user.id,
      })

      logger.info('User created in database', {
        module: 'UserRepository',
        userId: user.id,
        tier: user.tier,
      })

      return user
    } catch (error) {
      logDatabaseOperation('createUser', Date.now() - start, false, {
        userId: input.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Find user by ID (Clerk user ID)
   */
  async findById(id: string): Promise<User | null> {
    const start = Date.now()

    try {
      const user = await prisma.user.findUnique({
        where: { id },
      })

      logDatabaseOperation('findUserById', Date.now() - start, true, {
        userId: id,
        found: !!user,
      })

      return user
    } catch (error) {
      logDatabaseOperation('findUserById', Date.now() - start, false, {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const start = Date.now()

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      })

      logDatabaseOperation('findUserByEmail', Date.now() - start, true, {
        email,
        found: !!user,
      })

      return user
    } catch (error) {
      logDatabaseOperation('findUserByEmail', Date.now() - start, false, {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Find or create user (upsert)
   */
  async findOrCreate(input: CreateUserInput): Promise<User> {
    const existing = await this.findById(input.id)
    if (existing) return existing

    return await this.create(input)
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    const start = Date.now()

    try {
      const user = await prisma.user.update({
        where: { id },
        data: input,
      })

      logDatabaseOperation('updateUser', Date.now() - start, true, {
        userId: id,
      })

      return user
    } catch (error) {
      logDatabaseOperation('updateUser', Date.now() - start, false, {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Increment keyword search count
   */
  async incrementKeywordSearches(id: string, count: number = 1): Promise<User> {
    const start = Date.now()

    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          keywordSearchesThisMonth: {
            increment: count,
          },
          keywordSearchesTotal: {
            increment: count,
          },
        },
      })

      logDatabaseOperation('incrementKeywordSearches', Date.now() - start, true, {
        userId: id,
        count,
      })

      return user
    } catch (error) {
      logDatabaseOperation('incrementKeywordSearches', Date.now() - start, false, {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Reset monthly usage (called on first day of month)
   */
  async resetMonthlyUsage(id: string): Promise<User> {
    const start = Date.now()

    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          keywordSearchesThisMonth: 0,
          monthlyResetAt: new Date(),
        },
      })

      logDatabaseOperation('resetMonthlyUsage', Date.now() - start, true, {
        userId: id,
      })

      logger.info('Monthly usage reset', {
        module: 'UserRepository',
        userId: id,
      })

      return user
    } catch (error) {
      logDatabaseOperation('resetMonthlyUsage', Date.now() - start, false, {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Delete user (GDPR compliance)
   */
  async delete(id: string): Promise<void> {
    const start = Date.now()

    try {
      await prisma.user.delete({
        where: { id },
      })

      logDatabaseOperation('deleteUser', Date.now() - start, true, {
        userId: id,
      })

      logger.info('User deleted from database', {
        module: 'UserRepository',
        userId: id,
      })
    } catch (error) {
      logDatabaseOperation('deleteUser', Date.now() - start, false, {
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Get users with expired trials (for cleanup jobs)
   */
  async findExpiredTrials(): Promise<User[]> {
    const start = Date.now()

    try {
      const users = await prisma.user.findMany({
        where: {
          trialEndsAt: {
            lt: new Date(),
          },
          tier: UserTier.FREE,
        },
      })

      logDatabaseOperation('findExpiredTrials', Date.now() - start, true, {
        count: users.length,
      })

      return users
    } catch (error) {
      logDatabaseOperation('findExpiredTrials', Date.now() - start, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }

  /**
   * Get subscription metrics for monitoring
   */
  async getSubscriptionMetrics(): Promise<{
    totalUsers: number
    freeUsers: number
    proUsers: number
    enterpriseUsers: number
    activeSubscriptions: number
  }> {
    const start = Date.now()

    try {
      const [totalUsers, freeUsers, proUsers, enterpriseUsers, activeSubscriptions] =
        await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { tier: UserTier.FREE } }),
          prisma.user.count({ where: { tier: UserTier.PRO } }),
          prisma.user.count({ where: { tier: UserTier.ENTERPRISE } }),
          prisma.user.count({ where: { subscriptionStatus: 'active' } }),
        ])

      logDatabaseOperation('getSubscriptionMetrics', Date.now() - start, true)

      return {
        totalUsers,
        freeUsers,
        proUsers,
        enterpriseUsers,
        activeSubscriptions,
      }
    } catch (error) {
      logDatabaseOperation('getSubscriptionMetrics', Date.now() - start, false, {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw error
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository()
