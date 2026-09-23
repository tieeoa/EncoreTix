'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  summary: string
  prevLabel: string
  nextLabel: string
}

function pageRange(total: number, current: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | '...')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) items.push('...')
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total - 1) items.push('...')
  items.push(total)
  return items
}

// Kontrol pagination untuk tabel di dashboard (dark theme).
export default function Pagination({ page, totalPages, onChange, summary, prevLabel, nextLabel }: PaginationProps) {
  if (totalPages <= 1 && summary) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3.5 border-t border-white/10">
        <span className="text-xs text-gray-500 text-center break-words">{summary}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-5 py-3.5 border-t border-white/10">
      <span className="text-xs text-gray-500 text-center sm:text-left break-words">{summary}</span>
      <div className="flex items-center gap-1 max-w-full overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={prevLabel}
          className="shrink-0 min-w-9 min-h-9 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ‹ <span className="hidden sm:inline">{prevLabel}</span>
        </button>
        {pageRange(totalPages, page).map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-gray-600 text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`shrink-0 min-w-9 min-h-9 w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label={nextLabel}
          className="shrink-0 min-w-9 min-h-9 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="hidden sm:inline">{nextLabel}</span> ›
        </button>
      </div>
    </div>
  )
}