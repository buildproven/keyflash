import { z } from 'zod'

const SUPPORTED_LOCATION_CODES = [
  'US',
  'GB',
  'CA',
  'AU',
  'DE',
  'FR',
  'IN',
  'GL',
] as const

const LOCATION_ERROR_MESSAGE =
  'Location must be one of US, GB, CA, AU, DE, FR, IN, or GL for Global'

const LocationCodeSchema = z.preprocess(
  value => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    }
    return value
  },
  z
    .enum(SUPPORTED_LOCATION_CODES, {
      message: LOCATION_ERROR_MESSAGE,
    })
    .optional()
)

/**
 * Schema for validating keyword search requests
 * Implements strict security controls from docs/SECURITY.md
 */
export const KeywordSearchSchema = z.object({
  keywords: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Keyword cannot be empty')
        .max(100, 'Keyword too long (max 100 chars)')
        .regex(
          /^[a-zA-Z0-9\s\-_]+$/,
          'Keywords must contain only letters, numbers, spaces, hyphens, and underscores'
        )
    )
    .min(1, 'At least one keyword is required')
    .max(200, 'Maximum 200 keywords allowed'),
  matchType: z.enum(['phrase', 'exact']),
  location: LocationCodeSchema,
  language: z
    .string()
    .trim()
    .regex(
      /^[a-z]{2}(-[A-Z]{2})?$/, // eslint-disable-line security/detect-unsafe-regex -- Language code regex is safe: bounded length, no nested quantifiers
      'Language must be valid language code (e.g., en, en-US)'
    )
    .optional()
    .or(z.literal('').transform(() => undefined)), // Allow empty string to be undefined
})

/**
 * Schema for validating keyword input text (before splitting)
 * Note: Individual keyword validation happens after splitting
 */
export const KeywordInputSchema = z.object({
  keywordsInput: z
    .string()
    .trim()
    .min(1, 'Please enter at least one keyword')
    .max(10000, 'Input too large'),
  matchType: z.enum(['phrase', 'exact']),
  location: LocationCodeSchema.default('US'),
})

/**
 * Schema for validating related keywords request
 */
export const RelatedKeywordsSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(1, 'Keyword cannot be empty')
    .max(100, 'Keyword too long (max 100 chars)')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Keyword must contain only letters, numbers, spaces, hyphens, and underscores'
    ),
  location: LocationCodeSchema,
  language: z
    .string()
    .trim()
    .regex(
      /^[a-z]{2}(-[A-Z]{2})?$/, // eslint-disable-line security/detect-unsafe-regex -- Language code regex is safe
      'Language must be valid language code (e.g., en, en-US)'
    )
    .optional()
    .or(z.literal('').transform(() => undefined)),
  limit: z.number().int().min(1).max(50).optional(),
})

const MonthlyTrendSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  volume: z.number().min(0),
})

const KeywordDataSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  searchVolume: z.number().min(0),
  difficulty: z.number().min(0).max(100),
  cpc: z.number().min(0),
  competition: z.enum(['low', 'medium', 'high']),
  intent: z.enum([
    'informational',
    'commercial',
    'transactional',
    'navigational',
  ]),
  trends: z.array(MonthlyTrendSchema).optional(),
})

/**
 * Schema for creating a saved search
 */
export const CreateSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name too long (max 100 chars)'),
  description: z.string().trim().max(500, 'Description too long').optional(),
  searchParams: z.object({
    keywords: z
      .array(z.string().trim().min(1).max(100))
      .min(1, 'At least one keyword required')
      .max(200, 'Maximum 200 keywords'),
    matchType: z.enum(['phrase', 'exact']),
    location: z.string().min(2).max(5),
    language: z.string().optional(),
  }),
  results: z.array(KeywordDataSchema).optional(),
})

/**
 * Schema for updating a saved search
 */
export const UpdateSavedSearchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .optional(),
  description: z.string().trim().max(500).optional(),
})

export type KeywordSearchInput = z.infer<typeof KeywordSearchSchema>
export type KeywordFormInput = z.infer<typeof KeywordInputSchema>
export type RelatedKeywordsInput = z.infer<typeof RelatedKeywordsSchema>
export type CreateSavedSearchInput = z.infer<typeof CreateSavedSearchSchema>
export type UpdateSavedSearchInput = z.infer<typeof UpdateSavedSearchSchema>
