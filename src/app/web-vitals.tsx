'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals(metric => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', metric)
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      // Vercel Analytics automatically captures web vitals
      // For custom analytics, you can send to your endpoint:
      // fetch('/api/analytics', {
      //   method: 'POST',
      //   body: JSON.stringify(metric),
      // })

      // Log critical metrics
      if (metric.rating === 'poor') {
        console.warn(`Poor ${metric.name}:`, metric.value)
      }
    }
  })

  return null
}
