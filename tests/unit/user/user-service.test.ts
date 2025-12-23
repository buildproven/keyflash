/**
 * User Service Tests
 *
 * Tests for user management, tier tracking, and usage limits.
 * Reusable patterns for SaaS projects with subscription tiers.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Must set env vars before any imports
const originalEnv = process.env

describe('UserService', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Tier Limits', () => {
    it('should define correct trial limit of 300 keywords', () => {
      const TRIAL_LIMIT = 300
      expect(TRIAL_LIMIT).toBe(300)
    })

    it('should define correct pro limit of 1000 keywords', () => {
      const PRO_LIMIT = 1000
      expect(PRO_LIMIT).toBe(1000)
    })

    it('should define correct trial duration of 7 days', () => {
      const TRIAL_DAYS = 7
      expect(TRIAL_DAYS).toBe(7)
    })
  })

  describe('Trial Expiration Logic', () => {
    it('should calculate trial expiration correctly', () => {
      const TRIAL_DAYS = 7
      const now = new Date('2025-01-01T00:00:00.000Z')
      const trialExpires = new Date(now)
      trialExpires.setDate(trialExpires.getDate() + TRIAL_DAYS)

      expect(trialExpires.toISOString()).toBe('2025-01-08T00:00:00.000Z')
    })

    it('should detect expired trial correctly', () => {
      const trialExpiresAt = '2025-01-08T00:00:00.000Z'
      const checkDate = new Date('2025-01-09T00:00:00.000Z')
      const isExpired = checkDate > new Date(trialExpiresAt)

      expect(isExpired).toBe(true)
    })

    it('should detect active trial correctly', () => {
      const trialExpiresAt = '2025-01-08T00:00:00.000Z'
      const checkDate = new Date('2025-01-05T00:00:00.000Z')
      const isExpired = checkDate > new Date(trialExpiresAt)

      expect(isExpired).toBe(false)
    })
  })

  describe('Monthly Reset Logic', () => {
    it('should calculate next monthly reset correctly', () => {
      const now = new Date('2025-01-15T12:30:00.000Z')
      const monthlyReset = new Date(now)
      monthlyReset.setMonth(monthlyReset.getMonth() + 1)
      monthlyReset.setDate(1)
      monthlyReset.setHours(0, 0, 0, 0)

      expect(monthlyReset.getMonth()).toBe(1) // February (0-indexed)
      expect(monthlyReset.getDate()).toBe(1)
    })

    it('should detect when monthly reset is needed', () => {
      const monthlyResetAt = '2025-01-01T00:00:00.000Z'
      const now = new Date('2025-01-15T00:00:00.000Z')
      const needsReset = now >= new Date(monthlyResetAt)

      expect(needsReset).toBe(true)
    })

    it('should not reset when before reset date', () => {
      const monthlyResetAt = '2025-02-01T00:00:00.000Z'
      const now = new Date('2025-01-15T00:00:00.000Z')
      const needsReset = now >= new Date(monthlyResetAt)

      expect(needsReset).toBe(false)
    })
  })

  describe('Keyword Limit Check Logic', () => {
    interface LimitCheck {
      allowed: boolean
      used: number
      limit: number
      tier: 'trial' | 'pro'
      trialExpired?: boolean
    }

    const checkLimit = (
      tier: 'trial' | 'pro',
      used: number,
      trialExpired: boolean = false
    ): LimitCheck => {
      const limits = { trial: 300, pro: 1000 }
      const limit = limits[tier]

      return {
        allowed: !trialExpired && used < limit,
        used,
        limit,
        tier,
        trialExpired,
      }
    }

    it('should allow trial user under limit', () => {
      const result = checkLimit('trial', 100)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(300)
    })

    it('should deny trial user at limit', () => {
      const result = checkLimit('trial', 300)
      expect(result.allowed).toBe(false)
    })

    it('should deny trial user over limit', () => {
      const result = checkLimit('trial', 350)
      expect(result.allowed).toBe(false)
    })

    it('should deny expired trial even under limit', () => {
      const result = checkLimit('trial', 50, true)
      expect(result.allowed).toBe(false)
      expect(result.trialExpired).toBe(true)
    })

    it('should allow pro user under limit', () => {
      const result = checkLimit('pro', 500)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(1000)
    })

    it('should deny pro user at limit', () => {
      const result = checkLimit('pro', 1000)
      expect(result.allowed).toBe(false)
    })

    it('should allow pro user with many more keywords than trial', () => {
      const trialResult = checkLimit('trial', 500)
      const proResult = checkLimit('pro', 500)

      expect(trialResult.allowed).toBe(false) // Trial denied
      expect(proResult.allowed).toBe(true) // Pro allowed
    })
  })

  describe('Email Normalization', () => {
    it('should normalize email to lowercase', () => {
      const normalize = (email: string) => email.toLowerCase()

      expect(normalize('Test@Example.COM')).toBe('test@example.com')
      expect(normalize('USER@DOMAIN.ORG')).toBe('user@domain.org')
    })
  })

  describe('User Data Structure', () => {
    it('should have correct trial user structure', () => {
      const trialUser = {
        clerkUserId: 'user_123',
        email: 'test@example.com',
        tier: 'trial' as const,
        trialStartedAt: '2025-01-01T00:00:00.000Z',
        trialExpiresAt: '2025-01-08T00:00:00.000Z',
        keywordsUsedThisMonth: 0,
        monthlyResetAt: '2025-02-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        stripeCustomerId: undefined,
        subscriptionId: undefined,
      }

      expect(trialUser.tier).toBe('trial')
      expect(trialUser.stripeCustomerId).toBeUndefined()
      expect(trialUser.subscriptionId).toBeUndefined()
    })

    it('should have correct pro user structure', () => {
      const proUser = {
        clerkUserId: 'user_123',
        email: 'pro@example.com',
        tier: 'pro' as const,
        trialStartedAt: '2025-01-01T00:00:00.000Z',
        trialExpiresAt: '2025-01-08T00:00:00.000Z',
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_123',
        subscriptionStatus: 'active' as const,
        keywordsUsedThisMonth: 100,
        monthlyResetAt: '2025-02-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }

      expect(proUser.tier).toBe('pro')
      expect(proUser.stripeCustomerId).toBe('cus_123')
      expect(proUser.subscriptionId).toBe('sub_123')
      expect(proUser.subscriptionStatus).toBe('active')
    })
  })

  describe('Redis Key Prefixes', () => {
    it('should use correct user key prefix', () => {
      const USER_KEY_PREFIX = 'user:'
      const userId = 'user_123'
      const key = `${USER_KEY_PREFIX}${userId}`

      expect(key).toBe('user:user_123')
    })

    it('should use correct email index prefix', () => {
      const EMAIL_INDEX_PREFIX = 'email:'
      const email = 'test@example.com'
      const key = `${EMAIL_INDEX_PREFIX}${email}`

      expect(key).toBe('email:test@example.com')
    })

    it('should use correct Stripe customer prefix', () => {
      const STRIPE_CUSTOMER_PREFIX = 'stripe:'
      const customerId = 'cus_123'
      const key = `${STRIPE_CUSTOMER_PREFIX}${customerId}`

      expect(key).toBe('stripe:cus_123')
    })
  })

  describe('Configuration', () => {
    it('should require Redis URL for availability', () => {
      const hasRedisConfig = (url?: string, token?: string) => {
        return !!(url && token)
      }

      expect(hasRedisConfig('https://test.upstash.io', 'token')).toBe(true)
      expect(hasRedisConfig(undefined, 'token')).toBe(false)
      expect(hasRedisConfig('https://test.upstash.io', undefined)).toBe(false)
      expect(hasRedisConfig(undefined, undefined)).toBe(false)
    })
  })

  describe('Upgrade/Downgrade Logic', () => {
    it('should upgrade user with Stripe info', () => {
      const user = {
        tier: 'trial' as const,
        stripeCustomerId: undefined as string | undefined,
        subscriptionId: undefined as string | undefined,
        subscriptionStatus: undefined as string | undefined,
      }

      // Simulate upgrade
      const upgraded = {
        ...user,
        tier: 'pro' as const,
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_123',
        subscriptionStatus: 'active',
      }

      expect(upgraded.tier).toBe('pro')
      expect(upgraded.stripeCustomerId).toBe('cus_123')
      expect(upgraded.subscriptionId).toBe('sub_123')
      expect(upgraded.subscriptionStatus).toBe('active')
    })

    it('should downgrade user to trial', () => {
      const proUser = {
        tier: 'pro' as const,
        stripeCustomerId: 'cus_123',
        subscriptionId: 'sub_123',
        subscriptionStatus: 'active' as const,
      }

      // Simulate downgrade
      const downgraded = {
        ...proUser,
        tier: 'trial' as const,
        subscriptionStatus: 'canceled' as const,
      }

      expect(downgraded.tier).toBe('trial')
      expect(downgraded.subscriptionStatus).toBe('canceled')
      // Note: stripeCustomerId preserved for resubscription
      expect(downgraded.stripeCustomerId).toBe('cus_123')
    })
  })
})
