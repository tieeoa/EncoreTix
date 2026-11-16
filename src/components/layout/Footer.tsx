'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useLang } from '@/lib/i18n'

export default function Footer() {
  const { t } = useLang()

  const TAUTAN = [
    { label: t({ ID: 'Tentang Kami', EN: 'About Us' }), href: '/tentang-event' },
    { label: t({ ID: 'Hubungi Kami', EN: 'Contact Us' }), href: '/kontak' },
    { label: t({ ID: 'Bantuan & FAQ', EN: 'Help & FAQ' }), href: 'https://wa.me/6287763743577', external: true },
  ]

  const CUSTOMER = [
    { label: t({ ID: 'Cara Pembelian & Pengecekan', EN: 'How to Buy & Verify' }), href: '/cara-pembelian' },
    { label: t({ ID: 'Tiket Saya', EN: 'My Tickets' }), href: '/tiket-saya' },
    { label: t({ ID: 'Merchandise Saya', EN: 'My Merchandise' }), href: '/merch-saya' },
  ]

  return (
    <footer className="bg-slate-50 dark:bg-gray-950 border-t border-slate-200/80 dark:border-gray-800 mt-16 sm:mt-20 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
        <div className="md:col-span-5 space-y-3 text-center sm:text-left">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="EncoreTix" width={140} height={36} className="h-8 w-auto mx-auto sm:mx-0 object-contain dark:brightness-125" />
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm mx-auto sm:mx-0">
            {t({
              ID: 'Platform ticketing & merchandise resmi terpercaya untuk pengalaman konser dan festival musik terbaik Anda.',
              EN: 'The official trusted ticketing & merchandise platform for your best concert and music festival experience.',
            })}
          </p>
        </div>

        <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-8 text-sm">
          <div className="text-center sm:text-left">
            <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-3">{t({ ID: 'Tautan', EN: 'Links' })}</p>
            <ul className="space-y-2.5 text-gray-500 dark:text-gray-400">
              {TAUTAN.map((t2) => (
                <li key={t2.label}>
                  {t2.external ? (
                    <a href={t2.href} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t2.label}</a>
                  ) : (
                    <Link href={t2.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t2.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center sm:text-left">
            <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-3">{t({ ID: 'Layanan', EN: 'Services' })}</p>
            <ul className="space-y-2.5 text-gray-500 dark:text-gray-400">
              {CUSTOMER.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{c.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/#section-syarat" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t({ ID: 'Syarat & Ketentuan', EN: 'Terms & Conditions' })}</Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-1 text-center sm:text-left">
            <p className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider mb-3">{t({ ID: 'Sosial Media', EN: 'Social Media' })}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2.5">
              <a href="https://www.instagram.com/m4dnesstita" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center text-white hover:scale-105 transition-transform">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@califordelreyyy" aria-label="TikTok" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-black dark:bg-gray-800 dark:border dark:border-gray-700 flex items-center justify-center text-white hover:scale-105 transition-transform">
                <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.11V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47c1.36-1.36 2.05-3.08 1.98-5.32V8.75a8.28 8.28 0 0 0 4.79 1.5V6.8a4.88 4.88 0 0 1-1-.11z"/></svg>
              </a>
              <a href="https://www.threads.com/@m4dnesstita" aria-label="X" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-xl bg-black dark:bg-gray-800 dark:border dark:border-gray-700 flex items-center justify-center text-white hover:scale-105 transition-transform">
                <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 dark:text-gray-500 px-4 py-5 border-t border-slate-200/70 dark:border-gray-800/80">
        © 2026 EncoreTix. All rights reserved.
      </div>
    </footer>
  )
}
