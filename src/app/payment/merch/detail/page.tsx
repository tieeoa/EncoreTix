'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'

function RedirectToMerchPaymentContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const booking = searchParams.get('booking') || ''

  useEffect(() => {
    if (booking) {
      router.replace(`/payment/merch?booking=${encodeURIComponent(booking)}`)
    } else {
      router.replace('/merchandise')
    }
  }, [booking, router])

  return <LoadingSpinner label="Mengarahkan ke pembayaran Midtrans..." />
}

export default function MerchDetailPembayaranRedirect() {
  return (
    <Suspense fallback={<LoadingSpinner label="Memuat..." />}>
      <RedirectToMerchPaymentContent />
    </Suspense>
  )
}
