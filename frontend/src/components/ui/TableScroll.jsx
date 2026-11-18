import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoveHorizontal } from 'lucide-react'

/**
 * Horizontal scroll container for wide data tables.
 *
 * The table keeps its natural minimum width (passed by the caller based on its
 * column count) and the wrapper scrolls on the X axis, so no column or row
 * action is ever clipped on narrow screens. Edge fades and a small hint appear
 * only while there is more content in that direction; the hint floats at the
 * bottom of the viewport while the table is on screen so it stays visible even
 * for tables taller than the screen.
 */
const TableScroll = ({ children, minWidth = 760, className = '', label }) => {
  const { t } = useTranslation()
  const scroller = useRef(null)
  const wrapper = useRef(null)
  const [edges, setEdges] = useState({ scrollable: false, atStart: true, atEnd: true })
  const [inView, setInView] = useState(true)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const scrollable = max > 2
    const atStart = !scrollable || el.scrollLeft <= 2
    const atEnd = !scrollable || el.scrollLeft >= max - 2
    setEdges((prev) => (
      prev.scrollable === scrollable && prev.atStart === atStart && prev.atEnd === atEnd
        ? prev
        : { scrollable, atStart, atEnd }
    ))
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return undefined
    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }
    schedule()
    const observer = new ResizeObserver(schedule)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    window.addEventListener('resize', schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [measure])

  // The floating hint is only useful while this table is actually on screen.
  useEffect(() => {
    const el = wrapper.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={wrapper} className={`relative w-full max-w-full min-w-0 ${className}`}>
      <div
        ref={scroller}
        onScroll={measure}
        tabIndex={0}
        role="region"
        aria-label={label || t('common.scrollHint')}
        className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[inherit] [-webkit-overflow-scrolling:touch] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
      >
        <div style={{ minWidth: `${minWidth}px` }}>{children}</div>
      </div>

      {/* Edge fades: they signal the direction in which more columns live. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-2 left-0 top-0 w-8 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 dark:from-gray-950 ${
          edges.scrollable && !edges.atStart ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-2 right-0 top-0 w-8 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 dark:from-gray-950 ${
          edges.scrollable && !edges.atEnd ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Compact scroll affordance, pinned to the viewport corner while the
          table is visible; it fades out once the last column is reached. */}
      {edges.scrollable && inView && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed bottom-4 right-4 z-30 flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-md transition-opacity duration-200 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-300 ${
            edges.atEnd ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <MoveHorizontal size={11} />
          {t('common.scroll')}
        </div>
      )}
    </div>
  )
}

export default TableScroll
