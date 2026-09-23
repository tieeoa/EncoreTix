'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/i18n'

const STEPS = [
  {
    step: '01',
    num: 1,
    label: { ID: 'Pilih Tiket', EN: 'Choose Ticket' },
    title: { ID: 'Tahap 01: Pilih Tiket', EN: 'Step 01: Choose Ticket' },
    desc: {
      ID: 'Pilih kategori konser (VIP, Festival, CAT) atau bundle official merchandise. Pastikan login akun sebelum war tiket dan cek kuota yang tersedia.',
      EN: 'Choose the concert category (VIP, Festival, CAT) or official merchandise bundle. Make sure you log in to your account before the ticket rush and check the available quota.',
    },
  },
  {
    step: '02',
    num: 2,
    label: { ID: 'Lengkapi Data', EN: 'Fill in Data' },
    title: { ID: 'Tahap 02: Lengkapi Data', EN: 'Step 02: Fill in Data' },
    desc: {
      ID: 'Isi nama lengkap, NIK/Paspor sesuai identitas resmi, alamat email aktif, nomor WhatsApp, serta opsi pengiriman atau pickup booth merchandise.',
      EN: 'Fill in your full name, NIK/Passport matching your official identity, active email address, WhatsApp number, as well as shipping options or merchandise booth pickup.',
    },
  },
  {
    step: '03',
    num: 3,
    label: { ID: 'Bayar', EN: 'Pay' },
    title: { ID: 'Tahap 03: Bayar', EN: 'Step 03: Pay' },
    desc: {
      ID: 'Selesaikan pembayaran instan via QRIS (GoPay, OVO, Dana), Virtual Account bank resmi, atau Kartu Kredit dalam batas waktu 15 menit.',
      EN: 'Complete instant payment via QRIS (GoPay, OVO, Dana), official bank Virtual Account, or Credit Card within 15 minutes.',
    },
  },
  {
    step: '04',
    num: 4,
    label: { ID: 'Sukses', EN: 'Success' },
    title: { ID: 'Tahap 04: Sukses', EN: 'Step 04: Success' },
    desc: {
      ID: 'E-tiket, invoice, & QR Code otomatis terkirim via Email resmi, serta siap diakses langsung di menu Tiket Saya atau e-wallet.',
      EN: 'The e-ticket, invoice, & QR Code are automatically sent via official Email, ready to be accessed directly in the My Tickets menu or e-wallet.',
    },
  },
]

const CEK_STEPS = [
  {
    id: '01',
    title: { ID: 'Buka Email Konfirmasi', EN: 'Open the Confirmation Email' },
    iconType: 'email',
    content: {
      ID: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Periksa kotak masuk email yang kamu gunakan saat pembelian (cek juga folder Spam atau Promosi). Cari pesan dengan subjek{' '}
          <strong className="font-semibold text-gray-900">&quot;Konfirmasi Pembelian Berhasil - [Nama Event / Merchandise]&quot;</strong>.
        </p>
      ),
      EN: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Check the inbox of the email you used during purchase (also check the Spam or Promotions folder). Look for a message with the subject{' '}
          <strong className="font-semibold text-gray-900">&quot;Purchase Confirmation Successful - [Event Name / Merchandise]&quot;</strong>.
        </p>
      ),
    },
  },
  {
    id: '02',
    title: { ID: 'Salin Booking ID / Kode Transaksi', EN: 'Copy the Booking ID / Transaction Code' },
    iconType: 'code',
    content: {
      ID: (
        <div className="bg-[#f3f6fc] rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
          <span className="font-bold text-[#4f46e5]">88219800</span> atau nomor invoice transaksi. Kode ini adalah identitas resmi kepemilikan tiketmu.
        </div>
      ),
      EN: (
        <div className="bg-[#f3f6fc] rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
          <span className="font-bold text-[#4f46e5]">88219800</span> or the transaction invoice number. This code is the official identity of your ticket ownership.
        </div>
      ),
    },
  },
  {
    id: '03',
    title: { ID: 'Akses Menu Tiket Saya & Masukkan Kode', EN: 'Access the My Tickets Menu & Enter Your Code' },
    iconType: 'ticket',
    content: {
      ID: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Buka tombol Tiket Saya di navigasi web EncoreTix atau klik tautan e-tiket langsung dari pesan konfirmasi. Cukup tempelkan Booking ID kamu untuk membuka halaman status e-tiket dan voucher merchandise secara instan.
        </p>
      ),
      EN: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Open the My Tickets button in the EncoreTix web navigation or click the e-ticket link directly from the confirmation message. Simply paste your Booking ID to instantly open your e-ticket status and merchandise voucher.
        </p>
      ),
    },
  },
  {
    id: '04',
    title: { ID: 'Unduh E-Tiket PDF & Simpan Barcode / QR', EN: 'Download E-Ticket PDF & Save Barcode / QR' },
    iconType: 'download',
    content: {
      ID: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Unduh file PDF resmi ke perangkat smartphone atau simpan QR Code ke Apple Wallet / Google Wallet. Tunjukkan QR Code ini langsung di venue saat penukaran gelang wristband atau saat klaim merchandise tanpa perlu dicetak di atas kertas.
        </p>
      ),
      EN: (
        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          Download the official PDF file to your smartphone device or save the QR Code to Apple Wallet / Google Wallet. Show this QR Code directly at the venue when exchanging wristbands or claiming merchandise without needing to print it on paper.
        </p>
      ),
    },
  },
]

const FAQS = [
  {
    q: { ID: 'Apakah tiket bisa di-refund atau dipindahtangankan?', EN: 'Can tickets be refunded or transferred?' },
    a: {
      ID: 'Tiket yang sudah dibeli tidak dapat di-refund, ditukar, maupun dipindahtangankan ke orang lain. Pastikan data pemilik tiket (nama dan nomor identitas) sudah benar sebelum membayar.',
      EN: 'Purchased tickets cannot be refunded, exchanged, or transferred to another person. Make sure the ticket owner data (name and ID number) is correct before paying.',
    },
  },
  {
    q: { ID: 'Berapa batas maksimal pembelian tiket?', EN: 'What is the maximum ticket purchase limit?' },
    a: { ID: 'Tidak ada batas maksimal per transaksi — selama sisa kuota kategori tiket tersebut masih mencukupi. Setiap tiket wajib dilengkapi data pemiliknya masing-masing saat checkout.', EN: 'There is no maximum limit per transaction — as long as the remaining quota for that ticket category is sufficient. Each ticket must include its owner data at checkout.' },
  },
  {
    q: { ID: 'Apakah bisa membeli tiket dengan pembayaran tunai?', EN: 'Can I buy tickets with cash payment?' },
    a: {
      ID: 'Bisa. Selain pembelian online (QRIS, Virtual Account, dan Kartu Kredit/Debit), tiket juga dapat dibeli langsung secara tunai melalui panitia. Pantau media sosial kami untuk info jadwal penjualan offline dan temui kami di booth resmi.',
      EN: 'Yes. Besides online purchase (QRIS, Virtual Account, and Credit/Debit Card), tickets can also be bought directly in cash through our committee. Follow our social media for offline sale schedules and meet us at the official booth.',
    },
  },
  {
    q: { ID: 'Bagaimana jika saya tidak menerima email konfirmasi?', EN: 'What if I don\'t receive a confirmation email?' },
    a: {
      ID: 'Cek folder Spam/Junk email kamu. Jika belum ada, tiket tetap dapat diakses di halaman Tiket Saya. Hubungi CS kami jika masalah berlanjut.',
      EN: 'Check your Spam/Junk email folder. If it\'s still not there, your ticket can still be accessed on the My Tickets page. Contact our CS if the issue persists.',
    },
  },
  {
    q: { ID: 'Apakah data tiket bisa dipindahtangankan?', EN: 'Can ticket data be transferred?' },
    a: {
      ID: 'Tidak bisa. Nama pada tiket bersifat final dan harus sesuai dengan identitas orang yang akan hadir. Periksa kembali data pemilik tiket sebelum membayar.',
      EN: 'No. The name on the ticket is final and must match the attending person\'s identity. Double-check the ticket owner data before paying.',
    },
  },
  {
    q: { ID: 'Apakah anak-anak boleh masuk ke area festival?', EN: 'Are children allowed into the festival area?' },
    a: {
      ID: 'Boleh, selama memiliki kartu identitas yang valid (KTP, SIM, Kartu Pelajar, atau Paspor). Identitas akan diperiksa saat check-in dan harus sesuai dengan nama pada tiket.',
      EN: 'Yes, as long as they hold a valid ID card (ID card, driver\'s license, student card, or passport). Identity is verified at check-in and must match the name on the ticket.',
    },
  },
]

export default function CaraPembelianPage() {
  const { t, lang } = useLang()
  // Item 03 is expanded by default as in the mockup
  const [openCek, setOpenCek] = useState<Record<string, boolean>>({
    '01': true,
    '02': true,
    '03': true,
    '04': true,
  })

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleCek = (id: string) => {
    setOpenCek((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index))
  }

  // Stepper hidup: status aktif berjalan 1 → 4 berulang otomatis
  const [activeStep, setActiveStep] = useState(1)

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((prev) => (prev % STEPS.length) + 1)
    }, 2500)
    return () => clearInterval(id)
  }, [])

  const goToStep = (num: number) => {
    setActiveStep(num)
    document.getElementById(`step-desc-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* ========================================================= */}
      {/* SECTION 1: CARA PEMBELIAN TIKET & MERCHANDISE */}
      {/* ========================================================= */}
      <div className="text-center mb-10 sm:mb-12 animate-fade-up">
        <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-extrabold text-[#111827] tracking-tight">
          {t({ ID: 'Cara Pembelian Tiket & Merchandise', EN: 'How to Buy Tickets & Merchandise' })}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-2 max-w-xl mx-auto leading-relaxed">
          {t({ ID: 'Alur transaksi resmi yang aman, transparan, dan terverifikasi otomatis dalam tahapan terintegrasi.', EN: 'An official transaction flow that is secure, transparent, and automatically verified in integrated stages.' })}
        </p>

        {/* Stepper tracker */}
        <div className="mt-10 max-w-2xl mx-auto relative px-4 sm:px-8">
          {/* Background horizontal line */}
          <div className="absolute top-5 left-10 right-10 h-[1.5px] bg-gray-200 -z-0" />
          {/* Garis progres yang terisi mengikuti langkah aktif */}
          <div
            aria-hidden="true"
            className="absolute top-5 left-10 h-[1.5px] bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-700 -z-0"
            style={{ width: `calc((100% - 5rem) * ${(activeStep - 1) / (STEPS.length - 1)})` }}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 relative z-10">
            {STEPS.map((s) => {
              const isActive = s.num === activeStep
              const isDone = s.num < activeStep
              return (
                <div key={s.num} className="flex flex-col items-center animate-fade-up" style={{ animationDelay: `${s.num * 90}ms` }}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.num)}
                    aria-label={t(s.label)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ring-4 ring-white cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/30 scale-110'
                        : isDone
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-[#e2e8f0] text-gray-500 shadow-xs hover:bg-indigo-100 hover:text-indigo-700'
                    }`}
                  >
                    {isDone ? '✓' : s.num}
                  </button>
                  <span
                    className={`mt-2 text-xs font-semibold transition-colors ${
                      isActive ? 'text-indigo-700' : 'text-gray-500'
                    }`}
                  >
                    {t(s.label)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4 Columns Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-10 border-t border-gray-100 text-left">
          {STEPS.map((s) => (
            <div
              key={s.step}
              id={`step-desc-${s.num}`}
              className={`space-y-1.5 rounded-xl p-3 transition-all duration-500 scroll-mt-24 animate-fade-up ${
                s.num === activeStep ? 'bg-indigo-50/70 ring-1 ring-indigo-100 shadow-sm' : ''
              }`}
              style={{ animationDelay: `${s.num * 90 + 120}ms` }}
            >
              <h3 className="text-xs sm:text-sm font-bold text-[#111827]">
                {t(s.title)}
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                {t(s.desc)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: CARA CEK & SIMPAN TIKET / MERCHANDISE */}
      {/* ========================================================= */}
      <div className="mt-16 sm:mt-20">
        <div className="text-center mb-8 sm:mb-10 animate-fade-up">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            {t({ ID: 'Cara Cek & Simpan Tiket / Merchandise', EN: 'How to Check & Save Tickets / Merchandise' })}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {t({ ID: 'Cek Keaslian E-Ticket dan E-Merch yang kamu beli!', EN: 'Check the authenticity of the E-Ticket and E-Merch you bought!' })}
          </p>
        </div>

        {/* Accordion Cards */}
        <div className="space-y-3.5 max-w-3xl mx-auto">
          {CEK_STEPS.map((item, ci) => {
            const isOpen = !!openCek[item.id]
            const isHighlight = item.id === '03'

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${ci * 80}ms` }}
                className={`bg-white rounded-2xl border transition-all animate-fade-up ${
                  isHighlight && isOpen
                    ? 'border-blue-200 shadow-sm ring-1 ring-blue-100'
                    : 'border-gray-100 shadow-2xs hover:border-gray-200'
                } overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => toggleCek(item.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left gap-4"
                >
                  <div className="flex items-center gap-3.5 sm:gap-4">
                    {/* Icon container */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isHighlight
                          ? 'bg-[#4f46e5] text-white shadow-xs'
                          : 'bg-[#eef2ff] text-[#4f46e5]'
                      }`}
                    >
                      {item.iconType === 'email' && (
                        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      )}
                      {item.iconType === 'code' && (
                        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      {item.iconType === 'ticket' && (
                        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                        </svg>
                      )}
                      {item.iconType === 'download' && (
                        <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-gray-400 block mb-0.5">
                        {item.id}
                      </span>
                      <h4
                        className={`text-sm sm:text-base font-bold ${
                          isHighlight && isOpen ? 'text-[#4f46e5]' : 'text-gray-900'
                        }`}
                      >
                        {t(item.title)}
                      </h4>
                    </div>
                  </div>

                  {/* Chevron Arrow */}
                  <div className="shrink-0 text-gray-400">
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-0 ml-0 sm:ml-14 border-t border-transparent animate-fade-fast">
                    {item.content[lang]}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: FAQ (PERTANYAAN UMUM) - DILENGKAPI SESUAI REQUEST */}
      {/* ========================================================= */}
      <div className="mt-16 sm:mt-20 max-w-3xl mx-auto">
        <div className="text-center mb-8 animate-fade-up">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            {t({ ID: 'Pertanyaan Umum (FAQ)', EN: 'Frequently Asked Questions (FAQ)' })}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            {t({ ID: 'Jawaban lengkap seputar pemesanan tiket, metode pembayaran, dan penukaran e-tiket.', EN: 'Complete answers about ticket orders, payment methods, and e-ticket redemption.' })}
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isExpanded = openFaq === i

            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 70}ms` }}
                className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden transition-all animate-fade-up"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(i)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left gap-4"
                >
                  <span className="text-xs sm:text-sm font-bold text-gray-900">
                    {t(faq.q)}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 text-gray-400 ${
                      isExpanded ? 'rotate-180 text-blue-600' : ''
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3 animate-fade-fast">
                    {t(faq.a)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: BANNER MASIH ADA KENDALA? */}
      {/* ========================================================= */}
      <div className="mt-14 sm:mt-16 bg-[#eef2ff] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-blue-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 max-w-3xl mx-auto animate-fade-up">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight">
            {t({ ID: 'Masih ada kendala?', EN: 'Still having issues?' })}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {t({ ID: 'Tim customer service kami siap bantu soal kendala apapun yang kamu alami!', EN: 'Our customer service team is ready to help with any issues you experience!' })}
          </p>
        </div>

        <a
          href="https://wa.me/6287763743577"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-xs"
        >
          {t({ ID: 'Customer Service', EN: 'Customer Service' })}
        </a>
      </div>
    </div>
  )
}
