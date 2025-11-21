import { z } from 'zod'

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
  location: z
    .string()
    .trim()
    .regex(
      /^([A-Z]{2}|GL)$/,
      'Location must be a 2-letter country code (e.g., US, GB) or GL for Global'
    )
    .optional()
    .or(z.literal('').transform(() => undefined)), // Allow empty string to be undefined
  language: z
    .string()
    .trim()
    // eslint-disable-next-line security/detect-unsafe-regex -- Language code regex is safe: bounded length, no nested quantifiers
    .regex(
      /^[a-z]{2}(-[A-Z]{2})?$/,
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
  location: z
    .string()
    .trim()
    .regex(
      /^([A-Z]{2}|GL|)$/,
      'Location must be a 2-letter country code, GL for Global, or empty'
    )
    .transform(val => val || 'US') // Default to US if empty
    .default('US'),
})

export type KeywordSearchInput = z.infer<typeof KeywordSearchSchema>
export type KeywordFormInput = z.infer<typeof KeywordInputSchema>
