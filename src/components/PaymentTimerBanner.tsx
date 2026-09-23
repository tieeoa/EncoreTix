'use client'

import { formatRemaining } from '@/app/lib/paymentTimer'

interface Props {
  remaining: number
  label: string
}

export default function PaymentTimerBanner({ remaining, label }: Props) {
  return (
    <div className="bg-[#ccff00] px-4 py-2 text-center text-xs sm:text-sm font-medium text-gray-800 break-words">
      {formatRemaining(remaining)} | {label}
    </div>
  )
}