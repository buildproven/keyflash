'use client'

import { useState } from 'react'
import { ZodError } from 'zod'
import type { KeywordSearchFormData } from '@/types/keyword'
import { KeywordInputSchema } from '@/lib/validation/schemas'

// Map display names to ISO country codes for validation
const LOCATION_MAPPING: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  Canada: 'CA',
  Australia: 'AU',
  Germany: 'DE',
  France: 'FR',
  India: 'IN',
  Global: 'GL', // Special case - we'll handle this in validation
}

interface KeywordSearchFormProps {
  onSubmit: (data: KeywordSearchFormData) => void
  isLoading?: boolean
}

export function KeywordSearchForm({
  onSubmit,
  isLoading = false,
}: KeywordSearchFormProps) {
  const [formData, setFormData] = useState<KeywordSearchFormData>({
    keywordsInput: '',
    matchType: 'phrase',
    location: 'United States',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    try {
      // Map location display name to ISO code for validation
      const locationCode = formData.location
        ? LOCATION_MAPPING[formData.location] || formData.location
        : formData.location

      // Create validation payload with mapped location
      const validationPayload = {
        ...formData,
        location: locationCode,
      }

      // Validate form input
      const validated = KeywordInputSchema.parse(validationPayload)

      // Call the parent's onSubmit handler
      onSubmit(validated)
    } catch (error) {
      // Handle validation errors
      if (error instanceof ZodError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach(issue => {
          if (issue.path[0]) {
            newErrors[issue.path[0].toString()] = issue.message
          }
        })
        setErrors(newErrors)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Keywords Input */}
      <div>
        <label
          htmlFor="keywords"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Keywords
        </label>
        <textarea
          id="keywords"
          name="keywords"
          rows={5}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Enter keywords (one per line or comma-separated)&#10;Example:&#10;keyword research tool&#10;seo software, content marketing"
          value={formData.keywordsInput}
          onChange={e =>
            setFormData({ ...formData, keywordsInput: e.target.value })
          }
          disabled={isLoading}
          aria-describedby={`keywords-help ${errors.keywordsInput ? 'keywords-error' : ''}`}
          aria-invalid={errors.keywordsInput ? 'true' : 'false'}
          required
        />
        {errors.keywordsInput && (
          <p
            id="keywords-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {errors.keywordsInput}
          </p>
        )}
        <p id="keywords-help" className="mt-1 text-sm text-gray-600">
          Enter up to 200 keywords, separated by commas or new lines
        </p>
      </div>

      {/* Match Type */}
      <fieldset>
        <legend
          id="match-type-legend"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Match Type
        </legend>
        <div
          className="mt-2 space-y-2"
          role="radiogroup"
          aria-labelledby="match-type-legend"
        >
          <label className="flex items-center">
            <input
              type="radio"
              name="matchType"
              value="phrase"
              checked={formData.matchType === 'phrase'}
              onChange={e =>
                setFormData({
                  ...formData,
                  matchType: e.target.value as 'phrase' | 'exact',
                })
              }
              disabled={isLoading}
              className="mr-2 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              aria-describedby="phrase-description"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Phrase Match
              <span id="phrase-description" className="ml-2 text-gray-600">
                (includes variations and related terms)
              </span>
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="matchType"
              value="exact"
              checked={formData.matchType === 'exact'}
              onChange={e =>
                setFormData({
                  ...formData,
                  matchType: e.target.value as 'phrase' | 'exact',
                })
              }
              disabled={isLoading}
              className="mr-2 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              aria-describedby="exact-description"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Exact Match
              <span id="exact-description" className="ml-2 text-gray-600">
                (exact keyword only)
              </span>
            </span>
          </label>
        </div>
        {errors.matchType && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.matchType}
          </p>
        )}
      </fieldset>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Location
        </label>
        <select
          id="location"
          name="location"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          value={formData.location}
          onChange={e => setFormData({ ...formData, location: e.target.value })}
          disabled={isLoading}
          aria-invalid={errors.location ? 'true' : 'false'}
          aria-describedby={errors.location ? 'location-error' : undefined}
        >
          <option value="United States">United States</option>
          <option value="United Kingdom">United Kingdom</option>
          <option value="Canada">Canada</option>
          <option value="Australia">Australia</option>
          <option value="Germany">Germany</option>
          <option value="France">France</option>
          <option value="India">India</option>
          <option value="Global">Global</option>
        </select>
        {errors.location && (
          <p
            id="location-error"
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {errors.location}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-primary-600 px-4 py-3 text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Searching...' : 'Get Keyword Data'}
      </button>
    </form>
  )
}
