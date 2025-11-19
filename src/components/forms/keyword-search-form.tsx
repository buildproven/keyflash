'use client';

import { useState } from 'react';
import { ZodError } from 'zod';
import type { KeywordSearchFormData } from '@/types/keyword';
import { KeywordInputSchema } from '@/lib/validation/schemas';

interface KeywordSearchFormProps {
  onSubmit: (data: KeywordSearchFormData) => void;
  isLoading?: boolean;
}

export function KeywordSearchForm({
  onSubmit,
  isLoading = false,
}: KeywordSearchFormProps) {
  const [formData, setFormData] = useState<KeywordSearchFormData>({
    keywordsInput: '',
    matchType: 'phrase',
    location: 'United States',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form input
      const validated = KeywordInputSchema.parse(formData);

      // Call the parent's onSubmit handler
      onSubmit(validated);
    } catch (error) {
      // Handle validation errors
      if (error instanceof ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0].toString()] = issue.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

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
          onChange={(e) =>
            setFormData({ ...formData, keywordsInput: e.target.value })
          }
          disabled={isLoading}
        />
        {errors.keywordsInput && (
          <p className="mt-1 text-sm text-red-600">{errors.keywordsInput}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Enter up to 200 keywords, separated by commas or new lines
        </p>
      </div>

      {/* Match Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Match Type
        </label>
        <div className="mt-2 space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="matchType"
              value="phrase"
              checked={formData.matchType === 'phrase'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  matchType: e.target.value as 'phrase' | 'exact',
                })
              }
              disabled={isLoading}
              className="mr-2 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Phrase Match
              <span className="ml-2 text-gray-500">
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
              onChange={(e) =>
                setFormData({
                  ...formData,
                  matchType: e.target.value as 'phrase' | 'exact',
                })
              }
              disabled={isLoading}
              className="mr-2 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Exact Match
              <span className="ml-2 text-gray-500">
                (exact keyword only)
              </span>
            </span>
          </label>
        </div>
        {errors.matchType && (
          <p className="mt-1 text-sm text-red-600">{errors.matchType}</p>
        )}
      </div>

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
          onChange={(e) =>
            setFormData({ ...formData, location: e.target.value })
          }
          disabled={isLoading}
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
          <p className="mt-1 text-sm text-red-600">{errors.location}</p>
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
  );
}
