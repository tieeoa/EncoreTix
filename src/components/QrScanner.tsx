'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n'
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode'

interface CameraDevice {
  id: string
  label?: string
}

export default function QrScanner({
  onScan,
}: {
  onScan: (code: string) => void
}) {
  const { t } = useLang()
  const reactId = useId()
  const containerId = `qr-reader-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const scannerRef = useRef<Html5QrcodeType | null>(null)
  const onScanRef = useRef(onScan)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastScannedRef = useRef('')
  const lastScannedAtRef = useRef(0)

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [camIndex, setCamIndex] = useState(0)
  const [status, setStatus] = useState<'starting' | 'running' | 'error'>('starting')
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const handleDetect = (text: string) => {
    const now = Date.now()
    if (text !== lastScannedRef.current || now - lastScannedAtRef.current > 3000) {
      lastScannedRef.current = text
      lastScannedAtRef.current = now
      onScanRef.current(text)
    }
  }

  const handleScanError = () => {
    // frame gagal dipindai - abaikan, menunggu frame berikutnya
  }

  useEffect(() => {
    if (!document.getElementById(containerId)) return
    let cancelled = false

    const startScanner = async () => {
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const html5QrCode = new mod.Html5Qrcode(containerId)
        scannerRef.current = html5QrCode

        const camList: CameraDevice[] = await mod.Html5Qrcode.getCameras()
        if (cancelled) return
        if (!camList || camList.length === 0) {
          setStatus('error')
          setStatusText(
            t({
              ID: 'Kamera tidak ditemukan. Gunakan unggah gambar QR atau masukkan kode manual.',
              EN: 'No camera found. Use QR image upload or manual entry.',
            })
          )
          return
        }

        setCameras(camList)
        const envIdx = camList.findIndex((c) => /back|environment/i.test(c.label || ''))
        const startIdx = envIdx >= 0 ? envIdx : 0
        setCamIndex(startIdx)

        await html5QrCode.start(
          { deviceId: { exact: camList[startIdx].id } },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          handleDetect,
          handleScanError
        )
        if (!cancelled) setStatus('running')
      } catch {
        if (cancelled) return
        setStatus('error')
        setStatusText(
          t({
            ID: 'Akses kamera ditolak atau gagal. Gunakan unggah gambar QR atau kode manual.',
            EN: 'Camera access denied or failed. Use QR image upload or manual entry.',
          })
        )
      }
    }

    startScanner()

    return () => {
      cancelled = true
      const sc = scannerRef.current
      scannerRef.current = null
      if (sc) {
        sc.stop()
          .catch(() => {})
          .finally(() => {
            try {
              sc.clear()
            } catch {
              // ignore
            }
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId])

  const switchCamera = async () => {
    const sc = scannerRef.current
    if (!sc || cameras.length < 2) return
    try {
      await sc.stop()
      const next = (camIndex + 1) % cameras.length
      setCamIndex(next)
      await sc.start(
        { deviceId: { exact: cameras[next].id } },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        handleDetect,
        handleScanError
      )
    } catch {
      // kamera gagal diganti
    }
  }

  const scanFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatusText('')
    const tmpId = `${containerId}-filescan`
    let tmpEl = document.getElementById(tmpId)
    if (!tmpEl) {
      tmpEl = document.createElement('div')
      tmpEl.id = tmpId
      tmpEl.style.display = 'none'
      document.body.appendChild(tmpEl)
    }
    try {
      const mod = await import('html5-qrcode')
      const temp = new mod.Html5Qrcode(tmpId)
      const text = await temp.scanFile(file, false)
      try {
        temp.clear()
      } catch {
        // ignore
      }
      handleDetect(text)
    } catch {
      setStatusText(
        t({
          ID: 'QR tidak terbaca pada gambar. Coba gambar lain.',
          EN: 'QR not detected in the image. Try another image.',
        })
      )
    } finally {
      tmpEl.remove()
    }
  }

  return (
    <div>
      <div className="bg-[#4a5568] rounded-xl relative flex items-center justify-center overflow-hidden shadow-inner">
        <div id={containerId} className="w-full h-48 sm:h-64 [&_video]:w-full [&_video]:h-auto [&_video]:max-w-full [&_img]:max-w-full" />
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs bg-[#4a5568]">
            {t({ ID: 'Mengaktifkan kamera...', EN: 'Starting camera...' })}
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 sm:px-6 text-center bg-[#4a5568]">
            <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed break-words">{statusText}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-400 transition-colors"
            >
              {t({ ID: 'Unggah Gambar QR', EN: 'Upload QR Image' })}
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={scanFromFile} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cameras.length > 1 && (
          <button
            type="button"
            onClick={switchCamera}
            className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            ⟳ {t({ ID: 'Ganti Kamera', EN: 'Switch Camera' })}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          📁 {t({ ID: 'Scan dari Gambar', EN: 'Scan from Image' })}
        </button>
        <span className="text-[11px] sm:text-xs text-slate-400 break-words">
          {status === 'running'
            ? t({ ID: 'Kamera aktif · arahkan QR ke dalam kotak', EN: 'Camera active · align QR inside the frame' })
            : statusText}
        </span>
      </div>
    </div>
  )
}