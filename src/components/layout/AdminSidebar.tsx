'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearAdminSession } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'

interface MenuItem {
  label: string
  href: string
  icon: (active: boolean) => React.ReactNode
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    label: 'Check-In',
    href: '/admin/checkin',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    label: 'Merchandise Verification',
    href: '/admin/merch-verification',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Manual Orders',
    href: '/admin/manual-order',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Transaksi',
    href: '/admin/transactions',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
]

const MENU_LABELS: Record<string, { ID: string; EN: string }> = {
  '/admin/dashboard': { ID: 'Dashboard', EN: 'Dashboard' },
  '/admin/checkin': { ID: 'Check-in', EN: 'Check-in' },
  '/admin/merch-verification': { ID: 'Verifikasi Merchandise', EN: 'Merchandise Verification' },
  '/admin/manual-order': { ID: 'Order Manual', EN: 'Manual Orders' },
  '/admin/transactions': { ID: 'Transaksi', EN: 'Transactions' },
}

export default function AdminSidebar() {
  const { t } = useLang()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const open = () => setMobileOpen(true)
    window.addEventListener('open-dashboard-sidebar', open)
    return () => window.removeEventListener('open-dashboard-sidebar', open)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const sidebarBody = (
    <>
      {/* Logo Header matching Image 1 */}
      <div className="px-6 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md p-1.5 shrink-0">
            <svg className="w-full h-full text-[#06122d]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white leading-tight tracking-tight">EncoreTix</h1>
            <p className="text-sm font-semibold text-white/95 leading-tight">Panitia</p>
            <p className="text-[11px] text-[#8e9eb5] leading-tight mt-0.5">Event Operations</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-[#132347] text-white font-medium shadow-sm border border-white/5'
                  : 'text-[#8e9eb5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="shrink-0">{item.icon(isActive)}</span>
              <span className="truncate">{t(MENU_LABELS[item.href])}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => {
            clearAdminSession('admin')
            router.push('/admin/login')
          }}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#8e9eb5] hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <svg className="w-5 h-5 text-[#8e9eb5]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>{t({ ID: 'Keluar', EN: 'Logout' })}</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-[#06122d] h-screen sticky top-0 flex-col border-r border-[#0f2347] z-30 select-none">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-[#06122d] flex flex-col border-r border-[#0f2347] select-none shadow-2xl animate-fade-fast overflow-y-auto">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  )
}
