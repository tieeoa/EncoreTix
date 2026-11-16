'use client'

import { usePathname } from 'next/navigation'
import { LanguageProvider } from '@/lib/i18n'
import Navbar from './Navbar'
import Footer from './Footer'
import ChatBot from '../ChatBot'

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPanel = pathname.startsWith('/admin') || pathname.startsWith('/superadmin')

  if (isPanel) return <LanguageProvider>{children}</LanguageProvider>

  return (
    <LanguageProvider>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatBot />
    </LanguageProvider>
  )
}