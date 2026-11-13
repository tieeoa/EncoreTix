'use client'

import { useState, useEffect } from 'react'
import { formatRemaining } from '@/app/lib/paymentTimer'

interface Props {
  remaining: number
  label: string
}

export default function PaymentTimerBanner({ remaining, label }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      suppressHydrationWarning
      className="sticky top-16 z-40 bg-[#ccff00] px-4 py-2 text-center text-xs sm:text-sm font-medium text-gray-800 break-words"
    >
      <span suppressHydrationWarning>
        {mounted ? formatRemaining(remaining) : '10:00'}
      </span>{' '}
      | {label}
    </div>
  )
}