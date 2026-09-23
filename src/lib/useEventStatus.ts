'use client'

import { useEffect, useState } from 'react'
import { useSelectedEventId } from './eventStore'

export interface SelectedEventStatus {
  id: string | null
  status: string | null
  finished: boolean
  loading: boolean
}

// Status event yang sedang terpilih (dari localStorage / event aktif otomatis).
// finished = status 'closed' ATAU tanggal sudah lewat / hari-H (sama dgn isEventFinished).
export function useSelectedEventStatus(): SelectedEventStatus {
  const eventId = useSelectedEventId()
  const [state, setState] = useState<SelectedEventStatus>({ id: null, status: null, finished: false, loading: true })

  // Reset ke loading saat event berganti — pola "adjust state during render"
  // (bukan setState di dalam effect) agar tidak memicu cascading renders.
  const [prevId, setPrevId] = useState(eventId)
  if (prevId !== eventId) {
    setPrevId(eventId)
    setState({ id: null, status: null, finished: false, loading: true })
  }

  useEffect(() => {
    let alive = true
    fetch('/api/events/summaries')
      .then((r) => r.json())
      .then((res) => {
        if (!alive) return
        const all = (res?.data || []) as { id: string; status: string; finished: boolean }[]
        const eff = eventId
          ? all.find((e) => e.id === eventId) ?? null
          : all.find((e) => e.status === 'active') ?? null
        setState({
          id: eff?.id ?? null,
          status: eff?.status ?? null,
          finished: eff?.finished ?? false,
          loading: false,
        })
      })
      .catch(() => {
        if (alive) setState({ id: null, status: null, finished: false, loading: false })
      })
    return () => {
      alive = false
    }
  }, [eventId])

  return state
}