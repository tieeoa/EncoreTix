export const MERCH_CHECKOUT_FORM_KEY = 'encoretix_checkout_merch_data'

export function clearMerchCheckoutDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(MERCH_CHECKOUT_FORM_KEY)
    window.sessionStorage.removeItem(MERCH_CHECKOUT_FORM_KEY)
  } catch {}
}
