import { NextResponse } from 'next/server'
// @ts-expect-error midtrans-client tidak menyertakan deklarasi tipe TS resmi
import midtransClient from 'midtrans-client'
import { getServerSupabase } from '@/app/lib/supabaseClient'
import { resolveMerchGroup, buildMerchGroupData } from '@/app/lib/merchGroup'

export const dynamic = 'force-dynamic'

function getCoreClient() {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  const clientKey =
    process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
    process.env.MIDTRANS_CLIENT_KEY ||
    ''

  return new midtransClient.CoreApi({
    isProduction,
    serverKey,
    clientKey,
  })
}

interface CachedCharge {
  result: Record<string, unknown>
  gross_amount: number
  expiresAt: number
}
const chargeCache = new Map<string, CachedCharge>()

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bookingId = (body.booking_id as string || body.order_id as string || '').trim().toUpperCase()
    const paymentMethod = typeof body.payment_method === 'string' ? body.payment_method.trim().toLowerCase() : 'qris'

    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id wajib diisi' }, { status: 400 })
    }

    // Cek cache memori jika request yang sama persis dipanggil ulang dalam 10 menit
    const cacheKey = `${bookingId}:${paymentMethod}`
    const now = Date.now()
    const cached = chargeCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json({ ok: true, ...cached.result })
    }

    const supabase = getServerSupabase()
    const core = getCoreClient()

    let baseOrderId = bookingId
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
        return NextResponse.json({ error: 'Pesanan merchandise sudah lunas' }, { status: 400 })
      }

      baseOrderId = groupData.kode_pesanan
      grossAmount = groupData.total_harga
      customerDetails = {
        first_name: groupData.customers?.nama || 'Pembeli',
        email: groupData.customers?.email || undefined,
        phone: groupData.customers?.no_hp || undefined,
      }

      itemDetails = groupData.items.map((it) => ({
        id: it.id.slice(0, 50),
        price: Math.round(it.total_harga / it.jumlah),
        quantity: it.jumlah,
        name: (it.merchandise?.nama_merch || 'Merchandise').slice(0, 50),
      }))

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
      // 2. Pesanan tiket
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
      baseOrderId = pesanan.booking_id

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

    // Bangun payload Core API charge sesuai pilihan metode
    const buildChargePayload = (orderId: string): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount,
        },
        customer_details: customerDetails,
      }

      // Validasi item details
      const totalItems = itemDetails.reduce((a, b) => a + b.price * b.quantity, 0)
      if (totalItems === grossAmount) {
        payload.item_details = itemDetails
      }

      // Atur konfigurasi spesifik metode pembayaran
      if (paymentMethod === 'qris' || paymentMethod === 'gopay') {
        payload.payment_type = 'qris'
        payload.qris = { acquirer: 'gopay' }
      } else if (paymentMethod === 'shopeepay') {
        payload.payment_type = 'shopeepay'
      } else if (paymentMethod === 'bca_va' || paymentMethod === 'bca') {
        payload.payment_type = 'bank_transfer'
        payload.bank_transfer = { bank: 'bca' }
      } else if (paymentMethod === 'bni_va' || paymentMethod === 'bni') {
        payload.payment_type = 'bank_transfer'
        payload.bank_transfer = { bank: 'bni' }
      } else if (paymentMethod === 'bri_va' || paymentMethod === 'bri') {
        payload.payment_type = 'bank_transfer'
        payload.bank_transfer = { bank: 'bri' }
      } else if (paymentMethod === 'cimb_va' || paymentMethod === 'cimb') {
        payload.payment_type = 'bank_transfer'
        payload.bank_transfer = { bank: 'cimb' }
      } else if (paymentMethod === 'permata_va' || paymentMethod === 'permata') {
        payload.payment_type = 'permata'
      } else if (paymentMethod === 'echannel' || paymentMethod === 'mandiri') {
        payload.payment_type = 'echannel'
        payload.echannel = {
          bill_info1: 'Pembayaran Tagihan',
          bill_info2: 'EncoreTix',
        }
      } else if (paymentMethod === 'indomaret') {
        payload.payment_type = 'cstore'
        payload.cstore = {
          store: 'indomaret',
          message: 'EncoreTix Event Ticket',
        }
      } else if (paymentMethod === 'alfamart') {
        payload.payment_type = 'cstore'
        payload.cstore = {
          store: 'alfamart',
          message: 'EncoreTix Event Ticket',
        }
      } else {
        // Default ke QRIS
        payload.payment_type = 'qris'
        payload.qris = { acquirer: 'gopay' }
      }

      return payload
    }

    // Fungsi eksekusi charge dengan retry suffix jika order_id sudah pernah terpakai
    const chargeWithRetry = async (id: string, attempt: number = 0): Promise<Record<string, unknown>> => {
      const targetOrderId = attempt === 0 ? id : `${id}-${attempt}`
      const payload = buildChargePayload(targetOrderId)

      try {
        const response = await core.charge(payload)
        return response as Record<string, unknown>
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        // Jika order ID sudah ada di Midtrans (sudah pernah di-charge), coba dengan suffix baru (-1, -2, ...)
        if (
          (errMsg.includes('already been taken') ||
            errMsg.includes('has already been generated') ||
            errMsg.includes('transaction has been created')) &&
          attempt < 5
        ) {
          return chargeWithRetry(id, attempt + 1)
        }
        throw err
      }
    }

    const chargeRes = await chargeWithRetry(baseOrderId)

    // Ekstrak data instruksi yang relevan untuk UI EncoreTix
    const actions = (chargeRes.actions as { name: string; method: string; url: string }[]) || []
    const qrUrlAction = actions.find((a) => a.name === 'generate-qr-code')
    const qrUrl = qrUrlAction?.url || null
    const qrString = (chargeRes.qr_string as string) || null

    const vaNumbers = (chargeRes.va_numbers as { bank: string; va_number: string }[]) || []
    const vaNumber = vaNumbers.length > 0 ? vaNumbers[0].va_number : null
    const vaBank = vaNumbers.length > 0 ? vaNumbers[0].bank : null

    const billKey = (chargeRes.bill_key as string) || null
    const billerCode = (chargeRes.biller_code as string) || null
    const permataVa = (chargeRes.permata_va_number as string) || null
    const paymentCode = (chargeRes.payment_code as string) || null

    const formattedResult: Record<string, unknown> = {
      order_id: chargeRes.order_id,
      transaction_id: chargeRes.transaction_id,
      payment_type: chargeRes.payment_type,
      payment_method: paymentMethod,
      gross_amount: grossAmount,
      transaction_status: chargeRes.transaction_status,
      expiry_time: chargeRes.expiry_time || null,
      qr_url: qrUrl,
      qr_string: qrString,
      va_number: vaNumber || permataVa,
      bank: vaBank || (permataVa ? 'permata' : null),
      bill_key: billKey,
      biller_code: billerCode,
      payment_code: paymentCode,
    }

    // Cache hasil selama 10 menit
    chargeCache.set(cacheKey, {
      result: formattedResult,
      gross_amount: grossAmount,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    return NextResponse.json({
      ok: true,
      ...formattedResult,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada pembayaran Midtrans'
    console.error('[Midtrans Core Charge Error]:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

