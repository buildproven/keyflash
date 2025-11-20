import { z } from 'zod'

/**
 * Schema for validating keyword search requests
 * Implements security controls from docs/SECURITY.md
 */
export const KeywordSearchSchema = z.object({
  keywords: z
    .array(z.string().trim().min(1).max(100))
    .min(1, 'At least one keyword is required')
    .max(200, 'Maximum 200 keywords allowed'),
  matchType: z.enum(['phrase', 'exact']),
  location: z.string().trim().max(100).optional(),
  language: z.string().trim().max(10).optional(),
})

/**
 * Schema for validating keyword input text (before splitting)
 */
export const KeywordInputSchema = z.object({
  keywordsInput: z
    .string()
    .trim()
    .min(1, 'Please enter at least one keyword')
    .max(10000, 'Input too large'),
  matchType: z.enum(['phrase', 'exact']),
  location: z.string().trim().max(100).default('United States'),
})

export type KeywordSearchInput = z.infer<typeof KeywordSearchSchema>
export type KeywordFormInput = z.infer<typeof KeywordInputSchema>
