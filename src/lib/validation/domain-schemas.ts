import { z } from 'zod'

/**
 * Runtime validation schema for UserData retrieved from Redis
 * Ensures data integrity and type safety for user records
 */
export const UserDataSchema = z.object({
  clerkUserId: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['trial', 'pro']),
  trialStartedAt: z.string().datetime(),
  trialExpiresAt: z.string().datetime(),
  stripeCustomerId: z.string().optional(),
  subscriptionId: z.string().optional(),
  subscriptionStatus: z
    .enum(['active', 'canceled', 'past_due', 'unpaid'])
    .optional(),
  keywordsUsedThisMonth: z.number().int().min(0),
  monthlyResetAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/**
 * Runtime validation schema for SavedSearch retrieved from Redis
 * Ensures data integrity and type safety for saved search records
 */
export const SavedSearchSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  searchParams: z.object({
    keywords: z.array(z.string()),
    location: z.string().optional(),
    language: z.string().optional(),
    matchType: z.enum(['phrase', 'exact']).optional(),
  }),
  // Results can be complex and vary by provider, so we validate the structure
  // but allow flexibility in the actual result data
  results: z.array(z.any()).optional(),
  metadata: z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lastRunAt: z.string().datetime().optional(),
    resultCount: z.number().int().min(0).optional(),
  }),
})
