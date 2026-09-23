'use client'

import React from 'react'
import { useLang } from '@/lib/i18n'

interface DashboardHeaderProps {
  searchValue?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
  userName?: string
  userRole?: string
}

export default function DashboardHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  userName = 'Panitia',
  userRole = 'Admin',
}: DashboardHeaderProps) {
  const { lang, setLang } = useLang()

  return (
    <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center gap-3 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Hamburger — buka sidebar drawer di mobile */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-dashboard-sidebar'))}
        aria-label="Buka menu"
        className="lg:hidden shrink-0 w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search Bar matching Figma */}
      <div className="relative flex items-center flex-1 min-w-0 max-w-xl">
        <span className="absolute left-3.5 text-slate-400 pointer-events-none text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full min-w-0 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs md:text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64 md:w-80 transition-all"
        />
      </div>

      {/* Right Controls: Language toggle + Profile */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
        <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-full">
          <button
            onClick={() => setLang('ID')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${lang === 'ID' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            ID
          </button>
          <button
            onClick={() => setLang('EN')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${lang === 'EN' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            EN
          </button>
        </div>
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shadow-inner">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">{userName}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
