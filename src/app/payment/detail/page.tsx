'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

function RedirectToPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const booking = searchParams.get('booking') || ''

  useEffect(() => {
    if (booking) {
      router.replace(`/payment?booking=${encodeURIComponent(booking)}`)
    } else {
      router.replace('/tiket')
    }
  }, [booking, router])

  return <LoadingSpinner label="Mengarahkan ke pembayaran Midtrans..." />
}

export default function DetailPembayaranRedirect() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat..." />}>
      <RedirectToPaymentContent />
    </Suspense>
  )
}
