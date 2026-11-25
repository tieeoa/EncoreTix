import { NextResponse } from 'next/server'
// @ts-expect-error midtrans-client tidak menyertakan deklarasi tipe TS resmi
import midtransClient from 'midtrans-client'
import { getServerSupabase } from '@/app/lib/supabaseClient'
import { resolveMerchGroup, buildMerchGroupData } from '@/app/lib/merchGroup'

export const dynamic = 'force-dynamic'

function getSnapClient() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  const clientKey =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    process.env.MIDTRANS_CLIENT_KEY ||
    ''

  return new midtransClient.Snap({
    isProduction,
    serverKey,
    clientKey,
  })
}

// Mapping metode pembayaran dari UI EncoreTix ke channel code resmi Midtrans Snap
function mapPaymentMethodToChannels(method: string, grossAmount: number): string[] {
  // Channel tertentu memiliki batas minimum transaksi di Midtrans (BCA VA & Retail min Rp 10.000)
  if (grossAmount < 10000) {
    if (method === 'bca_va' || method === 'bca') {
      // Jika nominal < 10.000, BCA VA ditolak oleh Midtrans. Fallback ke QRIS & E-Wallet agar transaksi tidak error
      return ['other_qris', 'gopay', 'bni_va', 'bri_va']
    }
    if (method === 'alfamart' || method === 'indomaret') {
      return ['other_qris', 'gopay']
    }
  }

  switch (method) {
    case 'qris':
      return ['other_qris', 'gopay']
    case 'gopay':
      return ['gopay']
    case 'shopeepay':
      return ['shopeepay']
    case 'bca_va':
    case 'bca':
      return ['bca_va']
    case 'echannel':
    case 'mandiri':
      return ['echannel']
    case 'bni_va':
    case 'bni':
      return ['bni_va']
    case 'bri_va':
    case 'bri':
      return ['bri_va']
    case 'permata_va':
    case 'permata':
      return ['permata_va']
    case 'cimb_va':
    case 'cimb':
      return ['cimb_va']
    case 'other_va':
      return ['other_va']
    case 'credit_card':
      return ['credit_card']
    case 'indomaret':
      return ['indomaret']
    case 'alfamart':
      return ['alfamart']
    default:
      return method ? [method] : []
  }
}

// Cache token di memori agar jika user menutup popup dan membuka lagi dalam waktu singkat,
// Midtrans tidak error dengan "order_id has already been taken".
interface CachedSnap {
  token: string
  redirect_url: string
  gross_amount: number
  expiresAt: number
}
const tokenCache = new Map<string, CachedSnap>()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = (body.booking_id as string || body.order_id as string || '').trim().toUpperCase()
    const paymentMethod = typeof body.payment_method === 'string' ? body.payment_method.trim().toLowerCase() : ''
    const adminMode = body.admin_mode === true

    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id wajib diisi' }, { status: 400 })
    }

    // Cek cache memori berdasarkan bookingId dan paymentMethod
    const cacheKey = paymentMethod ? `${bookingId}:${paymentMethod}` : bookingId
    const now = Date.now()
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({
        token: cached.token,
        redirect_url: cached.redirect_url,
      })
    }

    const supabase = getServerSupabase()
    const snap = getSnapClient()

    let orderId = bookingId
    let grossAmount = 0
    let customerDetails: {
      first_name?: string
      email?: string
      phone?: string
    } = {}
    let itemDetails: {
      id: string
      price: number
      quantity: number
      name: string
    }[] = []

    // 1. Cek apakah ini pesanan merchandise
    const isMerch =
      bookingId.startsWith('EMRC-') ||
      bookingId.startsWith('PESANAN-') ||
      bookingId.startsWith('MERCH-')

    if (isMerch) {
      const resolved = await resolveMerchGroup(supabase, bookingId)
      if (!resolved || resolved.rows.length === 0) {
        return NextResponse.json({ error: 'Pesanan merchandise tidak ditemukan' }, { status: 404 })
      }

      const groupData = buildMerchGroupData(resolved.rows, resolved.groupCode)
      if (groupData.status_bayar === 'berhasil') {
        return NextResponse.json({ error: 'Pesanan sudah dibayar' }, { status: 400 })
      }

      orderId = groupData.kode_pesanan
      grossAmount = groupData.total_harga
      customerDetails = {
        first_name: groupData.customers?.nama || 'Pembeli',
        email: groupData.customers?.email || undefined,
        phone: groupData.customers?.no_hp || undefined,
      }

      // Rincian item
      itemDetails = groupData.items.map((it) => ({
        id: it.id.slice(0, 50),
        price: Math.round(it.total_harga / it.jumlah),
        quantity: it.jumlah,
        name: (it.merchandise?.nama_merch || 'Merchandise').slice(0, 50),
      }))

      // Biaya admin jika ada selisih
      const itemsSum = itemDetails.reduce((acc, it) => acc + it.price * it.quantity, 0)
      if (grossAmount > itemsSum) {
        itemDetails.push({
          id: 'ADMIN_FEE',
          price: grossAmount - itemsSum,
          quantity: 1,
          name: 'Biaya Layanan',
        })
      }
    } else {
      // 2. Jika bukan merchandise, cek tabel pesanan_tiket
      const { data: pesanan, error: findError } = await supabase
        .from('pesanan_tiket')
        .select('*, customers(nama, email, no_hp), tiket(kategori, harga), voucher(kode_voucher, nominal_diskon)')
        .eq('booking_id', bookingId)
        .maybeSingle()

      if (findError) throw new Error(findError.message)
      if (!pesanan) {
        return NextResponse.json({ error: 'Pesanan tiket tidak ditemukan' }, { status: 404 })
      }

      if (pesanan.status_bayar === 'berhasil') {
        return NextResponse.json({ error: 'Pesanan tiket sudah lunas' }, { status: 400 })
      }

      const subtotal = Number(pesanan.tiket?.harga ?? 0) * pesanan.jumlah
      const adminFee = Math.round(subtotal * 0.04)
      const diskon = Number(pesanan.voucher?.nominal_diskon ?? 0)
      grossAmount = Math.max(0, subtotal + adminFee - diskon)
      orderId = pesanan.booking_id

      customerDetails = {
        first_name: pesanan.customers?.nama || 'Pembeli',
        email: pesanan.customers?.email || undefined,
        phone: pesanan.customers?.no_hp || undefined,
      }

      itemDetails = [
        {
          id: `TIKET-${pesanan.id_tiket}`.slice(0, 50),
          price: Number(pesanan.tiket?.harga ?? 0),
          quantity: pesanan.jumlah,
          name: `Tiket ${pesanan.tiket?.kategori || ''}`.slice(0, 50),
        },
      ]

      if (adminFee > 0) {
        itemDetails.push({
          id: 'ADMIN_FEE',
          price: adminFee,
          quantity: 1,
          name: 'Biaya Layanan (4%)',
        })
      }

      if (diskon > 0) {
        itemDetails.push({
          id: 'DISCOUNT',
          price: -diskon,
          quantity: 1,
          name: `Diskon Voucher (${pesanan.voucher?.kode_voucher || 'Promo'})`.slice(0, 50),
        })
      }
    }

    if (grossAmount <= 0) {
      return NextResponse.json({ error: 'Total pembayaran tidak valid' }, { status: 400 })
    }

    // Fungsi membuat transaksi dengan fallback retry jika order_id sudah pernah dibuat di Midtrans
    const createTransactionWithRetry = async (id: string, attempt: number = 0): Promise<{ token: string; redirect_url: string }> => {
      const targetOrderId = attempt === 0 ? id : `${id}-${attempt}`
      const callbackUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/api/payment/webhook`
        : `${new URL(request.url).origin}/api/payment/webhook`
      const parameter: Record<string, unknown> = {
        transaction_details: {
          order_id: targetOrderId,
          gross_amount: grossAmount,
        },
        customer_details: customerDetails,
        callback_url: callbackUrl,
      }
      if (adminMode) parameter.expiry = { unit: 'minute', duration: 3 }

      // Jika user memilih metode pembayaran spesifik di UI EncoreTix,
      // teruskan ke Midtrans agar Snap LANGSUNG membuka metode tersebut (bypass menu pemilihan Midtrans).
      const channels = mapPaymentMethodToChannels(paymentMethod, grossAmount)
      if (channels.length > 0) {
        parameter.enabled_payments = channels
      }

      // Pastikan total itemDetails persis sama dengan grossAmount jika dikirim
      const totalItems = itemDetails.reduce((a, b) => a + b.price * b.quantity, 0)
      if (totalItems === grossAmount) {
        parameter.item_details = itemDetails
      }

      try {
        const result = await snap.createTransaction(parameter)
        return {
          token: result.token,
          redirect_url: result.redirect_url,
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        // Jika order_id sudah dipakai sebelumnya di Midtrans, coba dengan suffix baru (-1, -2)
        if (errMsg.includes('already been taken') && attempt < 5) {
          return createTransactionWithRetry(id, attempt + 1)
        }
        throw err
      }
    }

    const transaction = await createTransactionWithRetry(orderId)

    // Simpan ke cache untuk 10 menit
    tokenCache.set(cacheKey, {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      gross_amount: grossAmount,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    return NextResponse.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    console.error('[Midtrans Snap Error]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

