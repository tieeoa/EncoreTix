'use client'

import { useEffect, useRef, useState } from 'react'
import { useLang } from '@/lib/i18n'

export default function PhotoProofCapture({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File) => void
  onCancel: () => void
}) {
  const { t } = useLang()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)

  const [mode, setMode] = useState<'idle' | 'camera' | 'preview'>('idle')
  const [preview, setPreview] = useState('')
  const [camError, setCamError] = useState('')

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  useEffect(() => {
    return () => stopStream()
  }, [])

  const startCamera = async () => {
    setCamError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      setMode('camera')
      requestAnimationFrame(() => {
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().catch(() => {})
        }
      })
    } catch {
      setCamError(
        t({
          ID: 'Kamera tidak dapat diakses. Gunakan unggah foto sebagai pengganti.',
          EN: 'Camera unavailable. Use photo upload instead.',
        })
      )
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    const MAX = 1280
    const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    stopStream()
    setMode('preview')
    setPreview(canvas.toDataURL('image/jpeg', 0.85))
    canvas.toBlob(
      (blob) => {
        if (blob) {
          pendingFileRef.current = new File([blob], `bukti-pengambilan-${Date.now()}.jpg`, {
            type: 'image/jpeg',
          })
        }
      },
      'image/jpeg',
      0.85
    )
  }

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    pendingFileRef.current = file
    setPreview(URL.createObjectURL(file))
    setMode('preview')
    stopStream()
  }

  const confirm = () => {
    if (pendingFileRef.current) onCaptured(pendingFileRef.current)
  }

  const reset = () => {
    stopStream()
    pendingFileRef.current = null
    setPreview('')
    setMode('idle')
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold text-slate-700 mb-2">
        {t({ ID: 'Foto Bukti Pengambilan', EN: 'Pickup Proof Photo' })}
      </p>

      {mode === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold transition-colors"
          >
            📸 {t({ ID: 'Ambil Foto', EN: 'Take Photo' })}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
          >
            🖼️ {t({ ID: 'Unggah Foto', EN: 'Upload Photo' })}
          </button>
        </div>
      )}

      {mode === 'camera' && (
        <div>
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video ref={videoRef} playsInline muted className="w-full h-48 sm:h-56 md:h-64 object-cover" />
            <div className="absolute inset-0 m-auto w-28 h-28 sm:w-40 sm:h-40 rounded-lg border-2 border-dashed border-white/60 pointer-events-none" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              📷 {t({ ID: 'Jepret', EN: 'Capture' })}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              {t({ ID: 'Batal', EN: 'Cancel' })}
            </button>
          </div>
        </div>
      )}

      {camError && <p className="text-[11px] text-rose-600 mt-2">{camError}</p>}

      {mode === 'preview' && (
        <div>
          <div className="rounded-lg overflow-hidden bg-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={t({ ID: 'Pratinjau bukti', EN: 'Proof preview' })} className="w-full h-48 sm:h-52 object-cover" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              type="button"
              onClick={confirm}
              className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              ✓ {t({ ID: 'Gunakan Foto Ini', EN: 'Use This Photo' })}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              {t({ ID: 'Ulangi', EN: 'Retake' })}
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />

      {mode !== 'idle' && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 py-2 text-[11px] sm:text-xs text-slate-400 hover:text-slate-600"
        >
          {t({ ID: 'Lewati foto bukti', EN: 'Skip proof photo' })}
        </button>
      )}
    </div>
  )
}