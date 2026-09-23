'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '@/lib/i18n'

interface AutoScrollTrackProps {
  children: ReactNode
  className?: string
  speed?: number
}

export default function AutoScrollTrack({
  children,
  className = '',
  speed = 2600,
}: AutoScrollTrackProps) {
  const { t } = useLang()
  const ref = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)
  const [paused, setPaused] = useState(false)
  const pauseTimer = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 24)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !canScroll || paused) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + 16 : 220
    const id = window.setInterval(() => {
      const max = el.scrollWidth - el.clientWidth
      const next = el.scrollLeft + step
      el.scrollTo({ left: next >= max ? 0 : next, behavior: 'smooth' })
    }, speed)
    return () => window.clearInterval(id)
  }, [canScroll, paused, speed])

  const pause = () => {
    setPaused(true)
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    pauseTimer.current = window.setTimeout(() => setPaused(false), 450)
  }

  const resume = () => {
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    pauseTimer.current = null
    setPaused(false)
  }

  useEffect(
    () => () => {
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current)
    },
    []
  )

  const scrollByStep = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    pause()
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + 16 : 220
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      {canScroll && (
        <>
          <button
            onClick={() => scrollByStep(-1)}
            aria-label={t({ ID: 'Geser ke kiri', EN: 'Scroll left' })}
            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 backdrop-blur border border-gray-200 text-gray-700 text-lg font-bold shadow items-center justify-center hover:bg-white transition-colors cursor-pointer"
          >
            ‹
          </button>
          <button
            onClick={() => scrollByStep(1)}
            aria-label={t({ ID: 'Geser ke kanan', EN: 'Scroll right' })}
            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/85 backdrop-blur border border-gray-200 text-gray-700 text-lg font-bold shadow items-center justify-center hover:bg-white transition-colors cursor-pointer"
          >
            ›
          </button>
        </>
      )}
      <div
        ref={ref}
        onMouseEnter={pause}
        onMouseLeave={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
        className={`overflow-x-auto scroll-smooth no-scrollbar flex ${className}`}
      >
        {children}
      </div>
    </div>
  )
}