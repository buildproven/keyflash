'use client'

import { memo, useMemo } from 'react'
import type { MonthlyTrend } from '@/types/keyword'

interface TrendSparklineProps {
  trends?: MonthlyTrend[]
  width?: number
  height?: number
  className?: string
}

/**
 * Lightweight SVG sparkline for displaying search volume trends
 * Shows last 12 months of data with visual indication of trend direction
 */
type TrendDirection = 'up' | 'down' | 'flat'
interface TrendSparklineState {
  path: string
  color: string
  trendDirection: TrendDirection
}

export const TrendSparkline = memo(function TrendSparkline({
  trends,
  width = 100,
  height = 24,
  className = '',
}: TrendSparklineProps) {
  const { path, color, trendDirection } = useMemo<TrendSparklineState>(() => {
    if (!trends || trends.length < 2) {
      return { path: '', color: 'text-gray-300', trendDirection: 'flat' }
    }

    const volumes = trends.map(t => t.volume)
    const minVol = Math.min(...volumes)
    const maxVol = Math.max(...volumes)
    const range = maxVol - minVol || 1

    // Calculate padding for the chart
    const paddingX = 2
    const paddingY = 4
    const chartWidth = width - paddingX * 2
    const chartHeight = height - paddingY * 2

    // Generate path points
    const points = volumes.map((vol, i) => {
      const x = paddingX + (i / (volumes.length - 1)) * chartWidth
      const y = paddingY + chartHeight - ((vol - minVol) / range) * chartHeight
      return `${x},${y}`
    })

    const pathString = `M ${points.join(' L ')}`

    // Determine trend direction (compare first 3 months average to last 3 months average)
    const firstAvg =
      volumes.slice(0, 3).reduce((a, b) => a + b, 0) /
      Math.min(3, volumes.length)
    const lastAvg =
      volumes.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, volumes.length)
    const changePercent = ((lastAvg - firstAvg) / (firstAvg || 1)) * 100

    let trendColor: string
    let direction: TrendDirection

    if (changePercent > 10) {
      trendColor = 'text-green-500'
      direction = 'up'
    } else if (changePercent < -10) {
      trendColor = 'text-red-500'
      direction = 'down'
    } else {
      trendColor = 'text-gray-400'
      direction = 'flat'
    }

    return { path: pathString, color: trendColor, trendDirection: direction }
  }, [trends, width, height])

  if (!trends || trends.length < 2) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-gray-400">—</span>
      </div>
    )
  }

  const trendIconMap: Record<TrendDirection, string> = {
    up: '↑',
    down: '↓',
    flat: '→',
  }
  // trendDirection is constrained to the TrendDirection union
  // eslint-disable-next-line security/detect-object-injection
  const trendIcon = trendIconMap[trendDirection]

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <svg
        width={width}
        height={height}
        className={color}
        aria-label={`Search volume trend: ${trendDirection}`}
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-xs font-medium ${color}`}>{trendIcon}</span>
    </div>
  )
})

/**
 * Expanded trend chart with more detail
 * Used when a row is expanded in the results table
 */
interface TrendChartExpandedProps {
  trends: MonthlyTrend[]
  className?: string
}

export const TrendChartExpanded = memo(function TrendChartExpanded({
  trends,
  className = '',
}: TrendChartExpandedProps) {
  const chartData = useMemo(() => {
    if (!trends || trends.length === 0) return null

    const volumes = trends.map(t => t.volume)
    const minVol = Math.min(...volumes)
    const maxVol = Math.max(...volumes)
    const range = maxVol - minVol || 1

    return {
      trends,
      volumes,
      minVol,
      maxVol,
      range,
    }
  }, [trends])

  if (!chartData) {
    return (
      <div className={`text-center text-sm text-gray-500 ${className}`}>
        No trend data available
      </div>
    )
  }

  const { minVol, maxVol, range } = chartData
  const width = 300
  const height = 100
  const paddingX = 30
  const paddingY = 20
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  // Generate path points
  const points = chartData.volumes.map((vol, i) => {
    const x = paddingX + (i / (chartData.volumes.length - 1)) * chartWidth
    const y = paddingY + chartHeight - ((vol - minVol) / range) * chartHeight
    // Index access is safe because trends and volumes are parallel arrays
    // eslint-disable-next-line security/detect-object-injection
    return { x, y, vol, trend: chartData.trends[i] }
  })

  const pathString = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`

  // Area fill path
  const areaPath = `${pathString} L ${points[points.length - 1].x},${paddingY + chartHeight} L ${points[0].x},${paddingY + chartHeight} Z`

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        12-Month Search Volume Trend
      </h4>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        role="img"
        aria-label="Search volume trend chart"
      >
        {/* Area fill */}
        <path d={areaPath} fill="url(#gradient)" opacity={0.2} />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Line */}
        <path
          d={pathString}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={3}
              fill="#3B82F6"
              className="cursor-pointer"
            />
            {/* Tooltip on hover - simplified for now */}
            <title>
              {monthNames[point.trend.month - 1]} {point.trend.year}:{' '}
              {point.vol.toLocaleString()}
            </title>
          </g>
        ))}
        {/* Y-axis labels */}
        <text
          x={paddingX - 5}
          y={paddingY}
          textAnchor="end"
          className="fill-gray-500 text-[10px] dark:fill-gray-400"
        >
          {maxVol >= 1000 ? `${Math.round(maxVol / 1000)}k` : maxVol}
        </text>
        <text
          x={paddingX - 5}
          y={paddingY + chartHeight}
          textAnchor="end"
          className="fill-gray-500 text-[10px] dark:fill-gray-400"
        >
          {minVol >= 1000 ? `${Math.round(minVol / 1000)}k` : minVol}
        </text>
        {/* X-axis labels (first and last month) */}
        {chartData.trends.length > 0 && (
          <>
            <text
              x={paddingX}
              y={height - 5}
              textAnchor="middle"
              className="fill-gray-500 text-[10px] dark:fill-gray-400"
            >
              {monthNames[chartData.trends[0].month - 1]}
            </text>
            <text
              x={paddingX + chartWidth}
              y={height - 5}
              textAnchor="middle"
              className="fill-gray-500 text-[10px] dark:fill-gray-400"
            >
              {
                monthNames[
                  chartData.trends[chartData.trends.length - 1].month - 1
                ]
              }
            </text>
          </>
        )}
      </svg>
      {/* Stats summary */}
      <div className="mt-2 flex justify-between text-xs text-gray-600 dark:text-gray-400">
        <span>Min: {minVol.toLocaleString()}</span>
        <span>Max: {maxVol.toLocaleString()}</span>
        <span>
          Avg:{' '}
          {Math.round(
            chartData.volumes.reduce((a, b) => a + b, 0) /
              chartData.volumes.length
          ).toLocaleString()}
        </span>
      </div>
    </div>
  )
})
