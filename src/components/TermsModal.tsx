'use client'

import { useLang } from '@/lib/i18n'

export default function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, t } = useLang()
  if (!open) return null
  const terms = lang === 'EN'
    ? [
        'Tickets/merchandise that have been purchased cannot be returned or exchanged unless the event is cancelled by the organizer.',
        'Entry/pickup requires showing your booking proof/pickup code and valid ID.',
        'Purchases are first come, first served while stock/tickets are available.',
        'Transactions outside the official website are not our responsibility.',
        'By making a purchase, you are deemed to have read and agreed to these terms & conditions.',
      ]
    : [
        'Tiket/merchandise yang sudah dibeli tidak dapat dikembalikan/ditukar kecuali event dibatalkan oleh penyelenggara.',
        'Pengambilan/masuk venue wajib menunjukkan bukti pemesanan/kode pengambilan beserta identitas yang valid.',
        'Pembelian bersifat first come, first served selama stok/tiket tersedia.',
        'Transaksi di luar website resmi bukan tanggung jawab kami.',
        'Dengan melakukan pembelian, kamu dianggap telah membaca dan menyetujui seluruh syarat & ketentuan ini.',
      ]

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{t({ ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' })}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-600 dark:text-gray-300">
            {terms.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
          <p className="mt-4 text-xs text-gray-400">{t({ ID: 'Ketentuan spesifik dapat mengikuti informasi pada halaman event terkait.', EN: 'Specific terms may follow the information on the related event page.' })}</p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" onClick={onClose} className="w-full sm:w-auto sm:min-w-[120px] px-4 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium">{t({ ID: 'Tutup', EN: 'Close' })}</button>
        </div>
      </div>
    </div>
  )
}
