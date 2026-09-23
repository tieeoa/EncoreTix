function currentLang(): 'ID' | 'EN' {
  if (typeof window !== 'undefined' && window.localStorage?.getItem('lang') === 'EN') return 'EN'
  return 'ID'
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const isNetwork =
    /fetch failed|failed to fetch|networkerror|network request failed|load failed|econnrefused|enetrefused|enotfound|network is unreachable|internet connection/i.test(
      msg,
    )
  if (!isNetwork) return msg
  return currentLang() === 'EN' ? 'Check your internet connection' : 'Periksa koneksi internet'
}