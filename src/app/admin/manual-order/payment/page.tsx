'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/layout/AdminSidebar'
import DashboardHeader from '@/components/layout/DashboardHeader'
import { getAdminSession, useAdminName } from '@/lib/adminAuth'
import { AdminPaymentPage } from '@/app/payment/page'
import { useLang } from '@/lib/i18n'

export default function AdminManualOrderPaymentPage() {
  const { t } = useLang()
  const router = useRouter()
  const adminName = useAdminName()

  useEffect(() => {
    const session = getAdminSession('admin')
    if (!session || session.role !== 'admin') {
      router.replace('/admin/login')
    }
  }, [router])

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          searchPlaceholder={t({ ID: 'Cari...', EN: 'Search...' })}
          userName={adminName || 'Panitia'}
          userRole="Admin Panitia"
        />
        <main className="flex-1 overflow-auto">
          <div className="px-6 md:px-8 pt-6 md:pt-8 max-w-7xl w-full mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t({ ID: 'Pembayaran Manual Order', EN: 'Manual Order Payment' })}
            </h1>
            <p className="text-sm font-medium text-slate-600 mt-1">
              {t({ ID: 'Pilih metode dan selesaikan pembayaran di dashboard admin.', EN: 'Choose a method and complete payment inside the admin dashboard.' })}
            </p>
          </div>
          <AdminPaymentPage />
        </main>
      </div>
    </div>
  )
}
