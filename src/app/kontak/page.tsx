'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import LoadingDots from '@/components/LoadingDots'

export default function KontakPage() {
  const { t } = useLang()
  const [form, setForm] = useState({
    nama: '',
    email: '',
    telepon: '',
    pesan: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed || sending) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t({ ID: 'Gagal mengirim pesan', EN: 'Failed to send message' }))
      setSubmitted(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Title & Subtitle */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[#111827] tracking-tight leading-snug max-w-2xl">
          {t({ ID: 'Ada Pertanyaan Seputar Event atau Ingin Berkolaborasi?', EN: 'Have Questions About the Event or Want to Collaborate?' })}
        </h1>
        <p className="text-gray-500 text-sm sm:text-base mt-2.5 max-w-2xl leading-relaxed">
          {t({ ID: 'Tim EncoreTix & panitia Coravfest siap membantu penonton, calon sponsor, tenant brand, hingga mitra media.', EN: 'The EncoreTix team & Coravfest committee are ready to assist attendees, prospective sponsors, brand tenants, and media partners.' })}
        </p>
      </div>

      {/* Main Grid: Form (Left) & Contact Info Cards (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-7 bg-[#0b1736] rounded-[26px] p-6 sm:p-8 text-white shadow-xl">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-6">
            {t({ ID: 'Kirimkan Pesan Anda', EN: 'Send Your Message' })}
          </h2>

          {submitted ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t({ ID: 'Pesan Anda Telah Terkirim!', EN: 'Your Message Has Been Sent!' })}</h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-sm mb-6 leading-relaxed">
                {t({ ID: 'Terima kasih telah menghubungi kami. Tim EncoreTix & Panitia Coravfest akan segera menindaklanjuti pesan Anda.', EN: 'Thank you for contacting us. The EncoreTix team & Coravfest committee will follow up on your message soon.' })}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setForm({ nama: '', email: '', telepon: '', pesan: '' })
                  setAgreed(false)
                }}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold px-6 py-2.5 rounded-full transition-colors"
              >
                {t({ ID: 'Kirim Pesan Lainnya', EN: 'Send Another Message' })}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Nama Lengkap & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t({ ID: 'Nama Lengkap', EN: 'Full Name' })} <span className="text-slate-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Raditya Pratama"
                    value={form.nama}
                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    className="w-full bg-[#1b2b54] border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t({ ID: 'Alamat Email Aktif', EN: 'Active Email Address' })} <span className="text-slate-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="raditya@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#1b2b54] border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Nomor WhatsApp */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t({ ID: 'Nomor WhatsApp / Telepon', EN: 'WhatsApp / Phone Number' })} <span className="text-slate-400">*</span>
                </label>
                <div className="flex bg-[#1b2b54] border border-slate-700/70 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                  <span className="inline-flex items-center px-3 text-xs font-medium text-slate-300 border-r border-slate-700/70 select-none">
                    +62
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="812-3456-7890"
                    value={form.telepon}
                    onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                    className="w-full bg-transparent px-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Pesan / Detail Kebutuhan */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t({ ID: 'Pesan / Detail Kebutuhan', EN: 'Message / Details' })} <span className="text-slate-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={t({ ID: 'Isi Pesan ...', EN: 'Type your message ...' })}
                  value={form.pesan}
                  onChange={(e) => setForm({ ...form, pesan: e.target.value })}
                  className="w-full bg-[#1b2b54] border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none transition-colors"
                />
              </div>

              {/* Row 4: Checkbox Consent */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    required
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#1b2b54] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 leading-relaxed">
                    {t({ ID: 'Saya menyetujui bahwa data kontak yang dimasukkan akan digunakan oleh tim EncoreTix & Panitia Coravfest untuk verifikasi dan tindak lanjut layanan sesuai Kebijakan Privasi.', EN: 'I agree that the contact data provided will be used by the EncoreTix team & Coravfest committee for verification and service follow-up in accordance with the Privacy Policy.' })}
                  </span>
                </label>
              </div>

              {/* Row 5: Submit Button */}
              <div className="pt-2">
                {error && (
                  <p className="mb-3 text-[11px] font-medium text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={!agreed || sending}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs sm:text-sm px-6 py-3 rounded-full transition-colors shadow-md"
                >
                  <span>
                    {sending
                      ? <>{t({ ID: 'Mengirim', EN: 'Sending' })}<LoadingDots /></>
                      : t({ ID: 'Kirim Pesan Sekarang', EN: 'Send Message Now' })}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: 4 Cards */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: WhatsApp Hotline Penonton */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5 flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#e6f8ef] flex items-center justify-center shrink-0 text-[#00b060]">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M20.52 3.48A11.85 11.85 0 0 0 12.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.16 1.6 5.97L0 24l6.23-1.63a11.96 11.96 0 0 0 5.83 1.5h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-1.25-6.21-3.52-8.42zM12.07 21.84h-.01c-1.8 0-3.57-.48-5.11-1.4l-.37-.22-3.79.99 1.01-3.69-.24-.38a9.92 9.92 0 0 1-1.52-5.17c0-5.5 4.48-9.97 9.98-9.97 2.66 0 5.17 1.04 7.05 2.92a9.93 9.93 0 0 1 2.92 7.05c0 5.5-4.47 9.97-9.97 9.97zm5.47-7.46c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.68-1.63-.93-2.23-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.51 0 1.48 1.08 2.91 1.23 3.11.15.2 2.13 3.25 5.15 4.56.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-words">
                {t({ ID: 'WhatsApp Hotline Penonton', EN: 'Audience WhatsApp Hotline' })}
              </p>
              <a
                href="https://wa.me/6287763743577"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm font-bold text-[#4f46e5] hover:underline block mt-0.5 break-all"
              >
                +62 877-6374-3577
              </a>
            </div>
          </div>

          {/* Card 2: Email Customer Support */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5 flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#eef2ff] flex items-center justify-center shrink-0 text-[#4f46e5]">
              <svg className="w-6 h-6 fill-none stroke-current" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-words">
                {t({ ID: 'Email Customer Support', EN: 'Customer Support Email' })}
              </p>
              <a
                href="mailto:support@encoretix.id"
                className="text-xs sm:text-sm font-bold text-[#4f46e5] hover:underline block mt-0.5 break-all"
              >
                support@encoretix.id
              </a>
              <p className="text-xs text-gray-500 mt-0.5 break-all">ticketing@coravfest.com</p>
            </div>
          </div>

          {/* Card 3: Media & Kemitraan Coravfest */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-4 sm:p-5 flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#f0effb] flex items-center justify-center shrink-0 text-[#6366f1]">
              <svg className="w-6 h-6 fill-none stroke-current" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-words">
                {t({ ID: 'Media & Kemitraan Coravfest', EN: 'Media & Coravfest Partnership' })}
              </p>
              <a
                href="mailto:partnership@coravfest.com"
                className="text-xs sm:text-sm font-bold text-[#4f46e5] hover:underline block mt-0.5 break-all"
              >
                partnership@coravfest.com
              </a>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Brand activation, press release, sponsorship proposals
              </p>
            </div>
          </div>

          {/* Card 4: Venue */}
          <div className="bg-[#eef2ff] rounded-2xl p-5 border border-blue-100/80">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0 text-[#4f46e5] mt-0.5">
                <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                  VENUE
                </span>
                <p className="text-sm sm:text-base font-bold text-gray-900 mt-0.5 leading-tight">
                  AREA SM BOOMI CARNIVAL
                </p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Jl. Ikan Tombro No.27, Mojolangu, Kec. Lowokwaru, Kota Malang, Jawa Timur 65142
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-blue-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                <svg className="w-3.5 h-3.5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span>{t({ ID: 'Pantau Instagram Kami', EN: 'Follow Our Instagram' })}</span>
              </a>

              <a
                href="https://maps.google.com/?q=Boomi+Carnival+Malang"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-semibold text-[#4f46e5] hover:underline"
              >
                <span>{t({ ID: 'Lihat Peta', EN: 'View Map' })}</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Banner Card: Butuh Solusi Mandiri Sekarang? */}
      <div className="bg-[#eef2ff] rounded-2xl p-6 sm:p-7 mt-8 border border-blue-100/80">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-6 h-6 rounded bg-blue-600/10 text-[#4f46e5] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            {t({ ID: 'Butuh Solusi Mandiri Sekarang?', EN: 'Need a DIY Solution Right Now?' })}
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
          {t({ ID: 'Anda tidak perlu menunggu balasan email jika hanya ingin mengecek e-ticket atau panduan metode pembayaran online.', EN: 'You don\'t need to wait for an email reply if you just want to check your e-ticket or the online payment method guide.' })}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/tiket-saya"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition-colors shadow-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <span>{t({ ID: 'Cek Tiket Saya', EN: 'Check My Tickets' })}</span>
          </Link>

          <Link
            href="/cara-pembelian"
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-xs font-semibold px-5 py-2.5 rounded-full transition-colors shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t({ ID: 'Panduan Pembelian', EN: 'Purchase Guide' })}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
