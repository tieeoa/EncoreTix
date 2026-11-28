'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearAdminSession, adminFetch } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { useSelectedEventId, selectEventId } from '@/lib/eventStore'

interface MenuItem {
  label: string
  href: string
  icon: (active: boolean) => React.ReactNode
}

const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/superadmin/dashboard',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Event',
    href: '/superadmin/events',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Tiket',
    href: '/superadmin/tickets',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Voucher',
    href: '/superadmin/vouchers',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Band',
    href: '/superadmin/bands',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    label: 'Merchandise',
    href: '/superadmin/merchandise',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Transaksi',
    href: '/superadmin/transactions',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    label: 'Kelola Admin',
    href: '/superadmin/admins',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H3v-2a4 4 0 014-4h6a4 4 0 014 4v2zM12 11a4 4 0 100-8 4 4 0 000 8zm6 1a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    ),
  },
  {
    label: 'Laporan',
    href: '/superadmin/reports',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-white' : 'text-[#8e9eb5]'}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

interface EventSummary {
  id: string
  nama_event: string
  status: string
  finished: boolean
  tanggal: string | null
  venue: string | null
  tiketTerjual: number
  totalRevenue: number
}

function formatRupiah(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID')
}

export default function SuperAdminSidebar() {
  const { t } = useLang()
  const pathname = usePathname()
  const router = useRouter()
  const selectedEventId = useSelectedEventId()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [eventsOpen, setEventsOpen] = useState(false)
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

  useEffect(() => {
    adminFetch('/api/events/summaries')
      .then((r) => r.json())
      .then((res) => {
        if (!res.error) setEvents(res.data || [])
      })
      .catch(() => setEvents([]))
  }, [])

  const menuItemLabel = (label: string) =>
    label === 'Dashboard'
      ? t({ ID: 'Dashboard', EN: 'Dashboard' })
      : label === 'Kelola Event'
        ? t({ ID: 'Kelola Event', EN: 'Manage Events' })
        : label === 'Kelola Tiket'
        ? t({ ID: 'Kelola Tiket', EN: 'Manage Tickets' })
        : label === 'Kelola Band'
          ? t({ ID: 'Kelola Band', EN: 'Manage Bands' })
          : label === 'Kelola Voucher'
            ? t({ ID: 'Kelola Voucher', EN: 'Manage Vouchers' })
            : label === 'Merchandise'
            ? t({ ID: 'Kelola Merchandise', EN: 'Manage Merchandise' })
            : label === 'Transaksi'
              ? t({ ID: 'Transaksi', EN: 'Transactions' })
              : label === 'Kelola Admin'
                ? t({ ID: 'Kelola Admin', EN: 'Manage Admins' })
                : t({ ID: 'Laporan', EN: 'Reports' })

  const handleLogout = () => {
    clearAdminSession('superadmin')
  }

  const sidebarBody = (
    <SidebarBody
      pathname={pathname}
      events={events}
      eventsOpen={eventsOpen}
      setEventsOpen={setEventsOpen}
      selectedEventId={selectedEventId}
      onLogout={handleLogout}
      onNavigate={() => setMobileOpen(false)}
      t={t}
      menuItemLabel={menuItemLabel}
    />
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

function SidebarBody({
  pathname,
  events,
  eventsOpen,
  setEventsOpen,
  selectedEventId,
  onLogout,
  onNavigate,
  t,
  menuItemLabel,
}: {
  pathname: string
  events: EventSummary[]
  eventsOpen: boolean
  setEventsOpen: (v: boolean | ((v: boolean) => boolean)) => void
  selectedEventId: string
  onLogout: () => void
  onNavigate: () => void
  t: (v: { ID: string; EN: string }) => string
  menuItemLabel: (label: string) => string
}) {
  return (
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
            <p className="text-sm font-semibold text-white/95 leading-tight">Super Admin</p>
            <p className="text-[11px] text-[#8e9eb5] leading-tight mt-0.5">Event Operations</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-[#132347] text-white font-medium shadow-sm border border-white/5'
                  : 'text-[#8e9eb5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="shrink-0">{item.icon(isActive)}</span>
              <span className="truncate">{menuItemLabel(item.label)}</span>
            </Link>
          )
        })}
      </nav>

      {/* Edisi Event (collapsible) */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setEventsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8e9eb5]">
              {t({ ID: 'Edisi Event', EN: 'Event Editions' })}
            </p>
            <p className="text-[10px] text-[#5b6b8c] mt-0.5 truncate">
              {eventsOpen
                ? t({ ID: 'Klik untuk ganti event', EN: 'Click to switch event' })
                : events.find((e) => e.id === selectedEventId)?.nama_event ||
                  `${events.length + 1} ${t({ ID: 'event', EN: 'events' })}`}
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-[#8e9eb5] shrink-0 transition-transform duration-200 ${eventsOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {eventsOpen && (
          <div className="mt-1.5 space-y-1.5 max-h-[36vh] overflow-y-auto pr-0.5">
            <button
              onClick={() => selectEventId('')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 text-left ${
                selectedEventId === ''
                  ? 'bg-[#132347] text-white font-medium shadow-sm border border-white/5'
                  : 'text-[#8e9eb5] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#8e9eb5]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <span className="truncate">{t({ ID: 'Event Aktif (otomatis)', EN: 'Active event (auto)' })}</span>
            </button>

            {events.map((ev) => {
              const isActive = selectedEventId === ev.id
              return (
                <button
                  key={ev.id}
                  onClick={() => selectEventId(ev.id)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 text-left ${
                    isActive
                      ? 'bg-[#132347] text-white shadow-sm border border-white/5'
                      : 'text-[#8e9eb5] hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{ev.nama_event}</span>
                    {ev.finished ? (
                      <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-[#9fb0c9] border border-white/10">
                        {t({ ID: 'Selesai', EN: 'Finished' })}
                      </span>
                    ) : ev.status === 'active' ? (
                      <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/20">
                        ● {t({ ID: 'Aktif', EN: 'Active' })}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/20">
                        {t({ ID: 'Paused', EN: 'Paused' })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#5b6b8c]">
                    <span>
                      {ev.tiketTerjual.toLocaleString('id-ID')} {t({ ID: 'tiket', EN: 'tickets' })}
                    </span>
                    <span className="font-semibold">{formatRupiah(ev.totalRevenue)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={onLogout}
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
}
