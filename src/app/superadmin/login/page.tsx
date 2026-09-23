'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Bebas_Neue } from 'next/font/google'
import { loginAdmin } from '@/lib/adminAuth'
import { useLang } from '@/lib/i18n'
import { friendlyError } from '@/app/lib/fetchError'
import Toast from '@/components/Toast'
import LoadingDots from '@/components/LoadingDots'

const bebasNeue = Bebas_Neue({ weight: '400', subsets: ['latin'] })

export default function SuperAdminLoginPage() {
  const { t } = useLang()
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const session = await loginAdmin(form.username, form.password)
      if (session.role !== 'superadmin') {
        throw new Error(t({ ID: 'Akun ini bukan super admin.', EN: 'This account is not a super admin.' }))
      }
      setSuccess(t({ ID: 'Login berhasil!', EN: 'Login successful!' }))
      // Jeda sebentar agar notifikasi berhasil sempat terbaca sebelum pindah halaman.
      await new Promise((resolve) => setTimeout(resolve, 1200))
      router.push('/superadmin/dashboard')
    } catch (err) {
      setError(friendlyError(err))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-between px-4 py-12">
      {/* Top spacer to push card to center */}
      <div />

      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image src="/logo.png" alt="EncoreTix" width={195} height={48} className="h-12 w-auto" />
        </div>

        {/* Card */}
        <div className="w-full bg-white border border-gray-200 rounded-xl px-6 sm:px-10 py-8 sm:py-10">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className={`${bebasNeue.className} text-4xl tracking-tight text-gray-900 uppercase`}>
              {t({ ID: 'Login Super Admin', EN: 'Login Super Admin' })}
            </h1>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              {t({
                ID: 'Dashboard untuk manajemen acara\ndan sistem.',
                EN: 'Dashboard for event and system\nmanagement.',
              })}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-1.5">
                {t({ ID: 'Username', EN: 'Username' })}
              </label>
              <input
                required
                type="text"
                placeholder="name@encoretix.com"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-2 text-base text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-600 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-gray-500 uppercase mb-1.5">
                {t({ ID: 'Password', EN: 'Password' })}
              </label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-2 text-base text-gray-900 placeholder-gray-300 focus:outline-none focus:border-indigo-600 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            {success && (
              <Toast ok text={<>{success}<LoadingDots /></>} onClose={() => setSuccess('')} />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm tracking-wide uppercase transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? <>{t({ ID: 'Memverifikasi', EN: 'Verifying' })}<LoadingDots /></> : t({ ID: 'Masuk', EN: 'Sign In' })}
            </button>

            <div className="text-center pt-1">
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {t({ ID: 'Secure Entry', EN: 'Secure Entry' })}
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Footer — pinned to bottom */}
      <p className="text-center text-[11px] text-gray-400">
        © {new Date().getFullYear()} EncoreTix. {t({ ID: 'All rights reserved.', EN: 'All rights reserved.' })}
      </p>
    </div>
  )
}