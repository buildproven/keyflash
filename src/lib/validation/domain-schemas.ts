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
const SavedSearchIdSchema = z
  .string()
  .trim()
  .refine(id => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const legacyPattern = /^\d{13}-[a-z0-9]{7}$/
    return uuidPattern.test(id) || legacyPattern.test(id)
  })

export const SavedSearchSchema = z.object({
  id: SavedSearchIdSchema,
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

/**
 * TYPE-001 FIX: Runtime validation schemas for Stripe webhook events
 * Ensures type safety and prevents runtime errors from unexpected Stripe API changes
 */

// Stripe Customer schema (can be string ID, object, or deleted object)
const StripeCustomerSchema = z.union([
  z.string(), // Customer ID
  z.object({
    id: z.string(),
    email: z.string().nullable().optional(),
  }),
  z.object({
    id: z.string(),
    deleted: z.literal(true),
  }),
])

// Stripe Checkout Session schema
export const StripeCheckoutSessionSchema = z.object({
  id: z.string(),
  object: z.literal('checkout.session'),
  customer: StripeCustomerSchema.nullable(),
  subscription: z.union([z.string(), z.null()]), // Subscription ID or null
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  payment_status: z.string().optional(),
  status: z.string().optional(),
})

// Stripe Subscription schema
export const StripeSubscriptionSchema = z.object({
  id: z.string(),
  object: z.literal('subscription'),
  customer: StripeCustomerSchema,
  status: z.enum([
    'active',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'past_due',
    'trialing',
    'unpaid',
  ]),
  items: z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          price: z.object({
            id: z.string(),
          }),
        })
      ),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
  current_period_end: z.number().optional(),
  cancel_at_period_end: z.boolean().optional(),
})

// Stripe Invoice schema (for future use)
export const StripeInvoiceSchema = z.object({
  id: z.string(),
  object: z.literal('invoice'),
  customer: StripeCustomerSchema,
  subscription: z.union([z.string(), z.null()]),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).nullable(),
  metadata: z.record(z.string(), z.string()).nullable().optional(),
})
