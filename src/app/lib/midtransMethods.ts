export interface PaymentMethodItem {
  id: string
  name: string
  category: 'ewallet' | 'va' | 'card' | 'cstore'
  badge?: string
  description?: string
  logoText?: string
  popular?: boolean
  minAmount?: number
}

export interface PaymentCategory {
  id: 'ewallet' | 'va' | 'card' | 'cstore'
  title: { ID: string; EN: string }
  subtitle: { ID: string; EN: string }
  icon: string
}

export const PAYMENT_CATEGORIES: PaymentCategory[] = [
  {
    id: 'ewallet',
    title: { ID: 'QRIS & E-Wallet', EN: 'QRIS & E-Wallet' },
    subtitle: { ID: 'GoPay, ShopeePay, OVO, DANA, BCA, Livin, dll', EN: 'GoPay, ShopeePay, OVO, DANA, BCA, Livin, etc.' },
    icon: 'qr',
  },
  {
    id: 'va',
    title: { ID: 'Transfer Bank (Virtual Account)', EN: 'Bank Transfer (Virtual Account)' },
    subtitle: { ID: 'Verifikasi instan otomatis 24 jam', EN: 'Instant automated 24/7 verification' },
    icon: 'bank',
  },
  {
    id: 'card',
    title: { ID: 'Kartu Kredit / Debit', EN: 'Credit / Debit Card' },
    subtitle: { ID: 'Visa, Mastercard, JCB, American Express', EN: 'Visa, Mastercard, JCB, American Express' },
    icon: 'card',
  },
  {
    id: 'cstore',
    title: { ID: 'Gerai Retail (Tunai / Kasir)', EN: 'Retail Outlets (Cash at Counter)' },
    subtitle: { ID: 'Bayar tunai di kasir Indomaret atau Alfamart', EN: 'Pay cash at Indomaret or Alfamart counters' },
    icon: 'store',
  },
]

export const MIDTRANS_PAYMENT_METHODS: PaymentMethodItem[] = [
  // QRIS & E-Wallet
  {
    id: 'qris',
    name: 'QRIS',
    category: 'ewallet',
    badge: 'Rekomendasi',
    popular: true,
    logoText: 'QRIS',
    description: 'Scan pakai GoPay, OVO, DANA, ShopeePay, BCA, Livin, LinkAja, atau aplikasi m-Banking apa saja',
  },
  {
    id: 'gopay',
    name: 'GoPay / GoPay Later',
    category: 'ewallet',
    logoText: 'GoPay',
    description: 'Bayar langsung lewat aplikasi Gojek atau scan QR GoPay',
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    category: 'ewallet',
    logoText: 'ShopeePay',
    description: 'Bayar via aplikasi Shopee atau scan QR ShopeePay',
  },

  // Virtual Account
  {
    id: 'bca_va',
    name: 'BCA Virtual Account',
    category: 'va',
    badge: 'Otomatis',
    popular: true,
    logoText: 'BCA',
    minAmount: 10000,
    description: 'Transfer via BCA Mobile, KlikBCA, atau ATM BCA (Min. Rp 10.000)',
  },
  {
    id: 'echannel',
    name: 'Mandiri Bill Payment',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'Mandiri',
    description: 'Bayar lewat Livin\' by Mandiri, ATM Mandiri, atau Internet Banking',
  },
  {
    id: 'bri_va',
    name: 'BRI Virtual Account (BRIVA)',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'BRI',
    description: 'Transfer melalui BRImo, ATM BRI, atau Internet Banking BRI',
  },
  {
    id: 'bni_va',
    name: 'BNI Virtual Account',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'BNI',
    description: 'Transfer melalui BNI Mobile Banking atau ATM BNI',
  },
  {
    id: 'permata_va',
    name: 'Permata Virtual Account',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'Permata',
    description: 'Transfer via PermataMobile X atau ATM Permata',
  },
  {
    id: 'cimb_va',
    name: 'CIMB Niaga Virtual Account',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'CIMB',
    description: 'Transfer lewat OCTO Mobile, OCTO Clicks, atau ATM CIMB',
  },
  {
    id: 'other_va',
    name: 'Bank Lainnya (ATM Bersama / Prima)',
    category: 'va',
    badge: 'Otomatis',
    logoText: 'ATM Bersama',
    description: 'Transfer dari rekening bank apa saja melalui jaringan ATM Bersama, Prima, atau Alto',
  },

  // Kartu
  {
    id: 'credit_card',
    name: 'Kartu Kredit / Debit Online',
    category: 'card',
    badge: '3D Secure',
    logoText: 'Visa / MC',
    description: 'Mendukung Visa, Mastercard, JCB, dan American Express dengan OTP 3D-Secure',
  },

  // Retail
  {
    id: 'indomaret',
    name: 'Indomaret / i.saku',
    category: 'cstore',
    badge: 'Kasir',
    logoText: 'Indomaret',
    minAmount: 10000,
    description: 'Tunjukkan kode pembayaran ke kasir Indomaret terdekat (Min. Rp 10.000)',
  },
  {
    id: 'alfamart',
    name: 'Alfamart / Alfamidi',
    category: 'cstore',
    badge: 'Kasir',
    logoText: 'Alfamart',
    minAmount: 10000,
    description: 'Tunjukkan kode pembayaran ke kasir Alfamart / Alfamidi / Dan+Dan (Min. Rp 10.000)',
  },
]

