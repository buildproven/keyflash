'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/utils/logger'

interface PerformanceMetrics {
  timeToFirstByte: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay?: number
  interactionToNextPaint?: number
}

export function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.performance) return

    const metrics: Partial<PerformanceMetrics> = {}

    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          metrics.timeToFirstByte =
            navEntry.responseStart - navEntry.requestStart
        }

        if (entry.entryType === 'paint') {
          const paintEntry = entry as PerformancePaintTiming
          if (paintEntry.name === 'first-contentful-paint') {
            metrics.firstContentfulPaint = paintEntry.startTime
          }
        }

        if (entry.entryType === 'largest-contentful-paint') {
          const lcpEntry = entry as PerformanceEntry & { startTime: number }
          metrics.largestContentfulPaint = lcpEntry.startTime
        }

        if (entry.entryType === 'layout-shift') {
          const clsEntry = entry as PerformanceEntry & {
            value: number
            hadRecentInput?: boolean
          }
          if (!clsEntry.hadRecentInput) {
            metrics.cumulativeLayoutShift =
              (metrics.cumulativeLayoutShift || 0) + clsEntry.value
          }
        }

        if (entry.entryType === 'first-input') {
          const fidEntry = entry as PerformanceEntry & {
            processingStart: number
            startTime: number
          }
          metrics.firstInputDelay =
            fidEntry.processingStart - fidEntry.startTime
        }
      }
    })

    try {
      observer.observe({
        entryTypes: [
          'navigation',
          'paint',
          'largest-contentful-paint',
          'layout-shift',
          'first-input',
        ],
      })
    } catch (error) {
      logger.error('Failed to observe performance metrics', error, {
        module: 'PerformanceMonitor',
      })
    }

    const reportMetrics = () => {
      if (Object.keys(metrics).length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.table({
            'TTFB (ms)': metrics.timeToFirstByte?.toFixed(0),
            'FCP (ms)': metrics.firstContentfulPaint?.toFixed(0),
            'LCP (ms)': metrics.largestContentfulPaint?.toFixed(0),
            CLS: metrics.cumulativeLayoutShift?.toFixed(3),
            'FID (ms)': metrics.firstInputDelay?.toFixed(0),
            'INP (ms)': metrics.interactionToNextPaint?.toFixed(0),
          })
        }

        const lcpRating =
          !metrics.largestContentfulPaint ||
          metrics.largestContentfulPaint < 2500
            ? 'good'
            : metrics.largestContentfulPaint < 4000
              ? 'needs-improvement'
              : 'poor'

        const clsRating =
          !metrics.cumulativeLayoutShift || metrics.cumulativeLayoutShift < 0.1
            ? 'good'
            : metrics.cumulativeLayoutShift < 0.25
              ? 'needs-improvement'
              : 'poor'

        const fidRating =
          !metrics.firstInputDelay || metrics.firstInputDelay < 100
            ? 'good'
            : metrics.firstInputDelay < 300
              ? 'needs-improvement'
              : 'poor'

        if (
          lcpRating === 'poor' ||
          clsRating === 'poor' ||
          fidRating === 'poor'
        ) {
          logger.warn('Poor Core Web Vitals detected', {
            module: 'PerformanceMonitor',
            metrics: {
              lcp: metrics.largestContentfulPaint,
              lcpRating,
              cls: metrics.cumulativeLayoutShift,
              clsRating,
              fid: metrics.firstInputDelay,
              fidRating,
            },
          })
        }
      }
    }

    window.addEventListener('load', () => {
      setTimeout(reportMetrics, 3000)
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return null
}
