'use client'

import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type WidgetPos = { x: number; y: number }

const QUICK_PROMPTS = [
  { ID: 'Metode pembayaran apa saja yang didukung?', EN: 'What payment methods are supported?' },
  { ID: 'Bagaimana cara mengecek status tiket saya?', EN: 'How do I check my ticket status?' },
  { ID: 'Cara ambil official merchandise di mana?', EN: 'Where do I pick up official merchandise?' },
]

const WELCOME = {
  ID: 'Halo! Saya Encore Assistant. Ada yang bisa saya bantu seputar tiket konser atau official merchandise hari ini?',
  EN: 'Hi! I am Encore Assistant. How can I help you with concert tickets or official merchandise today?',
}

const WELCOME_BACK = {
  ID: 'Halo kembali! Ada informasi konser atau tiket lain yang ingin kamu tanyakan?',
  EN: 'Welcome back! Anything else you would like to know about concerts or tickets?',
}

const WIDGET_POS_KEY = 'encore_chat_widget_pos'
const WIDGET_MARGIN = 8
const DRAG_THRESHOLD = 5

const ALLOWED_CHAT_LINKS = [
  /^\/$/,
  /^\/#section-(lineup|deskripsi|syarat)$/,
  /^\/(tiket|merchandise|tentang-event|cara-pembelian|kontak|tiket-saya|merch-saya|checkout|payment)(\/[A-Za-z0-9_-]+)?$/,
  /^https:\/\/wa\.me\/6287763743577$/,
]

function isAllowedChatLink(url: string) {
  return ALLOWED_CHAT_LINKS.some((pattern) => pattern.test(url.trim()))
}

function clampToViewport(x: number, y: number, w: number, h: number): WidgetPos {
  const maxX = window.innerWidth - w - WIDGET_MARGIN
  const maxY = window.innerHeight - h - WIDGET_MARGIN
  return {
    x: Math.min(Math.max(WIDGET_MARGIN, x), Math.max(WIDGET_MARGIN, maxX)),
    y: Math.min(Math.max(WIDGET_MARGIN, y), Math.max(WIDGET_MARGIN, maxY)),
  }
}

// Render markdown link [text](url), bold **text**, dan newline
function FormattedMessage({ content }: { content: string }) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\n)/g)

  return (
    <span className="leading-relaxed whitespace-pre-wrap">
      {parts.map((part, idx) => {
        if (!part) return null

        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (linkMatch) {
          const [, label, url] = linkMatch
          if (!isAllowedChatLink(url)) return <span key={idx}>{label}</span>
          const isInternal = url.startsWith('/')
          if (isInternal) {
            return (
              <Link
                key={idx}
                href={url}
                className="font-semibold underline text-indigo-600 hover:text-indigo-800 transition"
              >
                {label}
              </Link>
            )
          }
          return (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline text-indigo-600 hover:text-indigo-800 transition"
            >
              {label}
            </a>
          )
        }

        const boldMatch = /^\*\*([^*]+)\*\*$/.exec(part)
        if (boldMatch) {
          return <strong key={idx} className="font-semibold">{boldMatch[1]}</strong>
        }

        return <span key={idx}>{part}</span>
      })}
    </span>
  )
}

export default function ChatBot() {
  const { t, lang } = useLang()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pos, setPos] = useState<WidgetPos | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: '' },
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const msgIdRef = useRef(0)
  const didDragRef = useRef(false)
  const dragRef = useRef<{
    id: number
    startX: number
    startY: number
    origX: number
    origY: number
    w: number
    h: number
    moved: boolean
  } | null>(null)

  const hasPos = pos !== null

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen, messages, isLoading])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WIDGET_POS_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as WidgetPos
      if (typeof saved?.x === 'number' && typeof saved?.y === 'number') {
        const el = buttonRef.current
        setPos(clampToViewport(saved.x, saved.y, el?.offsetWidth ?? 44, el?.offsetHeight ?? 44))
      }
    } catch {
      // abaikan posisi tersimpan yang tidak valid
    }
  }, [])

  useEffect(() => {
    if (!hasPos) return
    const onResize = () => {
      const el = buttonRef.current
      setPos((p) =>
        p ? clampToViewport(p.x, p.y, el?.offsetWidth ?? 44, el?.offsetHeight ?? 44) : p
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [hasPos])

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      w: rect.width,
      h: rect.height,
      moved: false,
    }
    didDragRef.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      drag.moved = true
      didDragRef.current = true
    }
    setPos(clampToViewport(drag.origX + dx, drag.origY + dy, drag.w, drag.h))
    e.preventDefault()
  }

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (drag.moved) {
      setPos((p) => {
        if (p) {
          try {
            localStorage.setItem(WIDGET_POS_KEY, JSON.stringify(p))
          } catch {
            // penyimpanan tidak tersedia; abaikan
          }
        }
        return p
      })
    }
  }

  const handleOpen = () => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    setIsOpen(true)
  }

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      id: String(++msgIdRef.current),
      role: 'user',
      content: text,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang,
            messages: updatedMessages
              .filter((m) => m.content.trim())
              .slice(-12)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
      })

      const data = await res.json().catch(() => ({}))
      const botReply = data.reply || data.error || 'Maaf, terjadi kendala saat memproses jawaban.'

      setMessages((prev) => [
        ...prev,
        {
          id: String(++msgIdRef.current),
          role: 'assistant',
          content: botReply,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(++msgIdRef.current),
          role: 'assistant',
          content: t({
            ID: 'Maaf, terjadi gangguan jaringan. Silakan coba lagi nanti.',
            EN: 'Sorry, there was a network problem. Please try again later.',
          }),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([{ id: 'welcome-back', role: 'assistant', content: '' }])
  }

  return (
    <>
      {!isOpen && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label={t({ ID: 'Buka bantuan Encore Assistant', EN: 'Open Encore Assistant help' })}
          style={pos ? { left: pos.x, top: pos.y, touchAction: 'none' } : { touchAction: 'none' }}
          className={`fixed z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors cursor-grab active:cursor-grabbing select-none ${
            pos ? '' : 'bottom-28 right-4 sm:bottom-24 sm:right-6'
          }`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="text-sm font-semibold">{t({ ID: 'Bantuan', EN: 'Help' })}</span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed z-50 inset-x-3 bottom-3 h-[70vh] max-h-[80vh] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:h-[560px] sm:max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        >
          <div className="bg-indigo-600 px-4 py-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-tight truncate">Encore Assistant</h3>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title={t({ ID: 'Mulai Percakapan Baru', EN: 'Start a new conversation' })}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={t({ ID: 'Tutup Chat', EN: 'Close chat' })}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-50/60 text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user'
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    <FormattedMessage
                      content={
                        m.id === 'welcome'
                          ? t(WELCOME)
                          : m.id === 'welcome-back'
                            ? t(WELCOME_BACK)
                            : m.content
                      }
                    />
                  </div>
                </div>
              )
            })}

            {isLoading && (
              <div className="flex items-start">
                <div className="bg-white text-gray-400 border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}

            {messages.length <= 2 && !isLoading && (
              <div className="pt-2">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  {t({ ID: 'Pertanyaan Populer:', EN: 'Popular questions:' })}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(t(prompt))}
                      className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-100 hover:border-indigo-200 rounded-lg text-[11px] font-medium text-left transition cursor-pointer active:scale-95"
                    >
                      {t(prompt)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="p-3 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t({ ID: 'Ketik pertanyaan seputar tiket/konser...', EN: 'Ask about tickets/concerts...' })}
              maxLength={1000}
              disabled={isLoading}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition shrink-0 cursor-pointer"
              title={t({ ID: 'Kirim Pesan', EN: 'Send message' })}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
