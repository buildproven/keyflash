'use client'

import { memo, useEffect, useRef, useState } from 'react'

interface VirtualTableRowProps {
  index: number
  isVisible: boolean
  onVisible: (index: number) => void
  children: React.ReactNode
}

export const VirtualTableRow = memo(function VirtualTableRow({
  index,
  isVisible,
  onVisible,
  children,
}: VirtualTableRowProps) {
  const ref = useRef<HTMLTableRowElement>(null)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || hasBeenVisible) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !hasBeenVisible) {
            setHasBeenVisible(true)
            onVisible(index)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [hasBeenVisible, index, onVisible])

  return (
    <tr
      ref={ref}
      className="hover:bg-gray-50 dark:hover:bg-gray-800"
      style={{ minHeight: '57px' }}
    >
      {hasBeenVisible || isVisible ? (
        children
      ) : (
        <td colSpan={8} className="px-6 py-4">
          <div className="h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </td>
      )}
    </tr>
  )
})
