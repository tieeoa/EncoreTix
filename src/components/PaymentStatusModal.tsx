'use client'

interface PaymentStatusModalProps {
  open: boolean
  tone?: 'danger' | 'warning'
  title: string
  message: string
  actionLabel: string
  onAction: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

// Popup status pembayaran untuk alur web (gagal bayar / waktu habis).
export default function PaymentStatusModal({
  open,
  tone = 'danger',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: PaymentStatusModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-4 overflow-y-auto">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-4 sm:p-6 shadow-xl text-center">
        <div
          className={`w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl ${
            tone === 'danger' ? 'bg-red-100' : 'bg-amber-100'
          }`}
        >
          {tone === 'danger' ? '❌' : '⏰'}
        </div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</p>
        <button
          onClick={onAction}
          className="mt-5 w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            onClick={onSecondary}
            className="mt-2 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}