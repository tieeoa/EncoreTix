'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface RealQRProps {
  value: string
  size?: number
  className?: string
}

export default function RealQR({ value, size = 224, className }: RealQRProps) {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [value, size])

  if (!src) {
    return (
      <div
        className={`${className ?? ''} bg-gray-100 rounded-xl animate-pulse max-w-full`}
        style={{ width: size, height: size, maxWidth: '100%' }}
      />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR Code" className={className} style={{ maxWidth: '100%', height: 'auto' }} />
}