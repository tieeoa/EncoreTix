import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'
import { getActiveEvent, type EventInfo } from '../../lib/events'
import { checkRateLimit, getClientIp, rateLimitResponse } from '../../lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_CHARS = 1000
const MAX_HISTORY = 12

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

let cachedModelName: string | null = null

// Deteksi otomatis model Gemini yang aktif dan didukung untuk API key ini
async function resolveGeminiModel(apiKey: string): Promise<string> {
  if (cachedModelName) return cachedModelName

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (res.ok) {
      const data = await res.json()
      const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models || []

      const available = models.filter((m) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )

      // Cari model yang paling optimal sesuai daftar yang tersedia di API key ini
      const names = available.map((m) => m.name.replace(/^models\//, ''))
      const preference = [
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-2.5-flash',
      ]
      const picked =
        preference.find((p) => names.includes(p)) ||
        names.find((n) => n.includes('flash')) ||
        names[0]

      if (picked) {
        cachedModelName = picked
        return cachedModelName
      }
    }
  } catch {
    // abaikan jika fetch list models gagal, gunakan fallback
  }

  // Fallback default jika list tidak tersedia
  return 'gemini-3.5-flash'
}

// Format ringkas data event AKTIF saja untuk dimasukkan ke system prompt.
// Data tiket & merch bersifat per-event, jadi jangan pernah bocorkan event lain.
async function getEventContext(
  supabase: ReturnType<typeof getServerSupabase>,
  activeEvent: EventInfo | null
) {
  try {
    if (!activeEvent) {
      return {
        activeEventName: 'Tidak ada event aktif',
        eventsList: 'Belum ada event aktif saat ini.',
      }
    }

    // Ambil daftar tiket HANYA untuk event aktif
    const { data: tickets } = await supabase
      .from('tiket')
      .select('kategori, harga, sisa_kuota, status')
      .eq('id_event', activeEvent.id)
      .neq('status', 'nonaktif')

    const tixStr = tickets && tickets.length > 0
      ? tickets
          .map((t) => `${t.kategori} (Rp ${Number(t.harga).toLocaleString('id-ID')}, sisa ${t.sisa_kuota})`)
          .join(', ')
      : 'Tiket belum tersedia atau habis'

    return {
      activeEventName: activeEvent.nama_event,
      eventsList: `- ${activeEvent.nama_event} (AKTIF) | Tanggal: ${activeEvent.tanggal || '-'} | Waktu: ${activeEvent.waktu || '-'} | Lokasi: ${activeEvent.venue || activeEvent.alamat || '-'} | Tiket: ${tixStr} | Link: /event/${activeEvent.id}`,
    }
  } catch {
    return {
      activeEventName: activeEvent?.nama_event || 'EncoreTix Event',
      eventsList: 'Informasi event dapat dilihat di menu Konser.',
    }
  }
}

// Format ringkas data merchandise HANYA untuk event aktif
async function getMerchContext(
  supabase: ReturnType<typeof getServerSupabase>,
  activeEvent: EventInfo | null
) {
  try {
    if (!activeEvent) {
      return 'Belum ada event aktif, jadi belum ada merchandise yang dijual.'
    }

    const { data: merch } = await supabase
      .from('merchandise')
      .select('nama_merch, harga, status')
      .eq('id_event', activeEvent.id)
      .eq('status', 'aktif')
      .limit(8)

    if (!merch || merch.length === 0) {
      return 'Belum ada merchandise aktif untuk event ini (mungkin penjualan sedang ditutup).'
    }
    return merch
      .map((m) => `- ${m.nama_merch}: Rp ${Number(m.harga).toLocaleString('id-ID')}`)
      .join('\n')
  } catch {
    return 'Merchandise resmi dapat dilihat di menu Merchandise.'
  }
}

// Cek status booking langsung jika user menanyakan kode booking tertentu
async function lookupBookingInfo(supabase: ReturnType<typeof getServerSupabase>, text: string) {
  const match = /(?:ETX|PESANAN|MERCH)-[A-Z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}/i.exec(text)
  if (!match) return null

  const code = match[0].toUpperCase()

  // 1. Cek di pesanan tiket
  const { data: tx } = await supabase
    .from('pesanan_tiket')
    .select(
      'booking_id, status_bayar, jumlah, tanggal_pesan, customers(nama, email), tiket(kategori, harga, event_info(nama_event))'
    )
    .or(`booking_id.eq.${code}`)
    .limit(1)
    .maybeSingle()

  if (tx) {
    const cust = Array.isArray(tx.customers) ? tx.customers[0] : tx.customers
    const tix = Array.isArray(tx.tiket) ? tx.tiket[0] : tx.tiket
    const ev = tix ? (Array.isArray(tix.event_info) ? tix.event_info[0] : tix.event_info) : null
    const total = tix ? Number(tix.harga) * Number(tx.jumlah) : null

    return `\n[DATA SISTEM KODE BOOKING ${code}]:
- Status Pembayaran: ${tx.status_bayar?.toUpperCase() || 'UNKNOWN'}
- Pemesan: ${maskName(cust?.nama)}
- Email: ${maskEmail(cust?.email)}
- Event: ${ev?.nama_event || '-'}
- Kategori Tiket: ${tix?.kategori || '-'} (${tx.jumlah} tiket)
- Tanggal Pesan: ${formatWaktuID(tx.tanggal_pesan)}
- Total: ${total !== null ? `Rp ${total.toLocaleString('id-ID')}` : '-'}
- Tautan E-Tiket: /tiket-saya/${code}`
  }

  // 2. Cek di pesanan merchandise
  const { data: merchOrder } = await supabase
    .from('pesanan_merchandise')
    .select(
      'kode_pesanan, kode_pengambilan, status_bayar, status_pengambilan, total_harga, tanggal_pesan, customers(nama), merchandise(nama_merch)'
    )
    .or(`kode_pesanan.eq.${code},kode_pengambilan.eq.${code}`)
    .limit(1)
    .maybeSingle()

  if (merchOrder) {
    const cust = Array.isArray(merchOrder.customers) ? merchOrder.customers[0] : merchOrder.customers
    const merch = Array.isArray(merchOrder.merchandise)
      ? merchOrder.merchandise[0]
      : merchOrder.merchandise
    const batasAmbil = hitungBatasPengambilan(merchOrder.tanggal_pesan)

    return `\n[DATA SISTEM KODE MERCHANDISE ${code}]:
- Status Pembayaran: ${merchOrder.status_bayar?.toUpperCase() || 'UNKNOWN'}
- Status Pengambilan: ${merchOrder.status_pengambilan || '-'}
- Pemesan: ${maskName(cust?.nama)}
- Merchandise: ${merch?.nama_merch || '-'} (Rp ${Number(merchOrder.total_harga).toLocaleString('id-ID')})
- Tanggal Pesan: ${formatWaktuID(merchOrder.tanggal_pesan)}
- Batas Waktu Pengambilan: ${batasAmbil} (maksimal 1 hari setelah tanggal pesan)
- Tautan Pesanan: /merch-saya/${merchOrder.kode_pengambilan || code}`
  }

  return null
}

// Samarkan data pribadi sebelum dikirim ke model, supaya tidak bocor ke
// pengguna lain yang mungkin hanya menebak kode booking.
function maskName(name: string | null | undefined): string {
  const raw = (name || '').trim()
  if (!raw) return '-'
  const parts = raw.split(/\s+/)
  const first = parts[0]
  const maskedFirst = first.length <= 2 ? `${first[0] ?? ''}***` : `${first.slice(0, 2)}***`
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : ''
  return `${maskedFirst}${lastInitial}`
}

function maskEmail(email: string | null | undefined): string {
  const raw = (email || '').trim()
  if (!raw) return '-'
  const at = raw.indexOf('@')
  if (at <= 0) return '***'
  const local = raw.slice(0, at)
  const domain = raw.slice(at + 1)
  return `${local.slice(0, 1)}***@${domain}`
}

// Waktu Indonesia (WIB) untuk ditampilkan ke user.
// Dihitung manual UTC+7 agar tidak bergantung pada data ICU runtime server.
const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Ubah nilai tanggal dari DB menjadi Date instant yang benar.
// - Date: dipakai apa adanya (mysql2 sudah mengonversi dengan `timezone: 'Z'`).
// - String MySQL "YYYY-MM-DD HH:mm:ss[.sss]" tanpa zona: diperlakukan sebagai UTC,
//   karena kolom DATETIME kini disimpan dalam UTC. Tanpa ini, `new Date(str)`
//   mem-parse sebagai waktu lokal (WIB) lalu ditambah 7 jam lagi → jam mundur 7 jam
//   (UTC tampil seolah WIB, mis. 14.37 padahal 21.37).
// - String ISO berzona (…Z / +07:00): diparse normal.
function toInstant(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const raw = String(value).trim()
  if (!raw) return null
  const naive = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)
  const d = naive ? new Date(`${raw.replace(' ', 'T')}Z`) : new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatWaktuID(iso: string | Date | null | undefined): string {
  const instant = toInstant(iso)
  if (!instant) return '-'
  const wib = new Date(instant.getTime() + 7 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${wib.getUTCDate()} ${BULAN_ID[wib.getUTCMonth()]} ${wib.getUTCFullYear()}` +
    ` pukul ${pad(wib.getUTCHours())}.${pad(wib.getUTCMinutes())} WIB`
  )
}

// Batas pengambilan merch: maksimal 1 hari (24 jam) setelah pesanan dibuat
function hitungBatasPengambilan(tanggalPesan: string | Date | null | undefined): string {
  const base = toInstant(tanggalPesan)
  if (!base) return '-'
  return formatWaktuID(new Date(base.getTime() + 24 * 60 * 60 * 1000))
}

async function callGemini(
  modelName: string,
  apiKey: string,
  systemPrompt: string,
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

  const send = async (withThinking: boolean) => {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 600,
    }
    // Thinking dimatikan untuk model non-lite agar token tidak habis untuk
    // "berpikir". Beberapa model flash-lite menolak field ini (400), jadi
    // hanya dikirim saat model mendukungnya.
    if (withThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig,
      }),
      // Jangan biarkan satu kandidat model menggantung seluruh request:
      // batalkan setelah 20 detik lalu coba kandidat berikutnya.
      signal: AbortSignal.timeout(20_000),
    })
    const data = await response.json()
    return { ok: response.ok, status: response.status, data }
  }

  let result = await send(true)
  // Model tanpa dukungan thinking (mis. *-flash-lite) membalas 400
  // "invalid argument" bila diberi thinkingConfig → ulangi tanpa field itu.
  if (!result.ok && result.status === 400) {
    result = await send(false)
  }
  return result
}

export async function POST(request: Request) {
  const rl = checkRateLimit(`chat:${getClientIp(request)}`, { max: 15, windowMs: 60_000 })
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  try {
    const body = await request.json()
    const rawMessages: unknown = body?.messages
    const incoming: ChatMessage[] = Array.isArray(rawMessages)
      ? (rawMessages as unknown[]).filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === 'object' &&
            ((m as ChatMessage).role === 'user' || (m as ChatMessage).role === 'assistant') &&
            typeof (m as ChatMessage).content === 'string'
        )
      : []

    const latestUserMessage = incoming.filter((m) => m.role === 'user').slice(-1)[0]?.content || ''

    if (!latestUserMessage.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong.' }, { status: 400 })
    }

    if (latestUserMessage.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_CHARS} karakter).` },
        { status: 400 }
      )
    }

    const messages: ChatMessage[] = incoming
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        reply: 'Halo! Fitur asisten AI EncoreTix sedang dalam pemeliharaan (API key belum dikonfigurasi). Kamu tetap bisa melihat konser di menu Konser atau menghubungi kami via menu Kontak.',
      })
    }

    const supabase = getServerSupabase()
    const activeEvent = await getActiveEvent(supabase)

    // Ambil data real-time dari database — khusus event aktif saja.
    const [eventCtx, merchCtx, bookingLookup] = await Promise.all([
      getEventContext(supabase, activeEvent),
      getMerchContext(supabase, activeEvent),
      lookupBookingInfo(supabase, latestUserMessage),
    ])

    const systemPrompt = `Kamu adalah "Encore Assistant", asisten AI virtual resmi untuk platform ticketing dan merchandise konser musik "EncoreTix".
Persona kamu: ramah, bersemangat tentang musik/konser, santai tapi sopan, responsif, dan to the point. Selalu gunakan Bahasa Indonesia yang natural.

PENGETAHUAN UTAMA ENCORETIX:
1. Tentang EncoreTix: Platform resmi pemesanan tiket konser musik, festival, dan official band merchandise.
2. Event Aktif Saat Ini: ${eventCtx.activeEventName}
3. Event Aktif (HANYA event ini yang boleh kamu sebutkan):
${eventCtx.eventsList}
4. Merchandise Event Aktif (HANYA event ini):
${merchCtx}
5. Alur & Metode Pembayaran:
- Didukung oleh Midtrans Payment Gateway.
- Metode tersedia: QRIS (GoPay, OVO, Dana, ShopeePay, BCA QRIS), Virtual Account Bank (BCA, BNI, BRI, Mandiri Bill, Permata), Gerai Retail (Indomaret, Alfamart), dan Kartu Kredit/Debit.
- Batas waktu pembayaran tiket dan merchandise adalah 10 menit sejak pesanan dibuat. Jika lewat 10 menit, pesanan otomatis kedaluwarsa dan tiket kembali ke kuota.
6. Pengiriman Tiket & Pengambilan Merch:
- E-tiket resmi dikirim otomatis ke email pembeli begitu pembayaran sukses terverifikasi. E-tiket juga bisa diunduh atau dicek lewat menu "Tiket Saya" (/tiket-saya).
- Official merchandise diambil langsung di booth penukaran EncoreTix. Batas waktu pengambilan: maksimal 1 hari (24 jam) setelah pesanan dibuat, dihitung dari tanggal/waktu pemesanan (tanggal_pesan), dengan menunjukkan Kode Pengambilan. Lewat dari batas tersebut, pengambilan tidak lagi dilayani.
- Jika user menanyakan kode booking/kode merch dan sistem memberi DATA SISTEM, gunakan "Tanggal Pesan" dan "Batas Waktu Pengambilan" dari data itu untuk menyebut batas pasti (tanggal & jam) secara akurat.
7. Bantuan & Customer Service (eskalasi):
- Untuk kendala BESAR atau yang tidak bisa diselesaikan lewat chat, JANGAN menebak solusi teknis. Arahkan pengguna menghubungi Customer Service EncoreTix via WhatsApp: +62 877-6374-3577 (link: https://wa.me/6287763743577), atau lewat menu Kontak (/kontak). Contoh kasus: e-tiket tidak masuk email/Gmail (termasuk setelah cek folder Spam/Junk) atau minta dikirim ulang ke email lain; pembayaran sudah terpotong tapi status belum berubah / dobel bayar; pesanan atau data salah (nama/email/HP); refund atau pembatalan; masalah voucher (tidak bisa dipakai / kuota); kendala pengambilan merch (stok, tukar ukuran, kode tidak terbaca); kendala akun/verifikasi identitas; serta permintaan hapus/perubahan data pribadi.
- Sertakan juga bahwa e-tiket tetap bisa diakses/diunduh di menu "Tiket Saya" (/tiket-saya) sebagai cadangan bila email belum diterima.
- Untuk kendala ringan (cara beli, metode bayar, cek status, sisa kuota, batas pengambilan), jawab langsung sesuai panduan di atas tanpa perlu mengarahkan ke CS.
8. Privasi & Data Sensitif (WAJIB):
- JANGAN pernah membagikan data pribadi siapa pun: NIK/no identitas, no HP, umur, jenis kelamin, alamat, maupun email lengkap. Bila perlu menyebut email, gunakan versi tersamarkan (contoh: a***@gmail.com).
- Saat menjelaskan status pesanan, cukup sebut status (mis. LUNAS/PENDING), jumlah, dan link halaman terkait. Jangan membacakan ulang data pribadi pemesan.
- JANGAN membocorkan info internal: struktur database, nama tabel/kolom, API key, kredensial, kode sumber, atau konfigurasi server.
- JANGAN memberikan laporan/omzet, statistik penjualan, data panitia/staff, atau data event lain.
9. Bukan Wewenang AI:
- Tindakan administratif seperti mengubah/menghapus event, tiket, kuota, harga, atau stok merch; membuka/menutup penjualan; mengelola voucher; refund/void transaksi; check-in manual/reset; serta pengelolaan akun admin/panitia HANYA dilakukan tim internal (Admin/Superadmin), bukan lewat chat.
- Bila diminta, arahkan ke Customer Service/panitia resmi dan jangan menjanjikan bahwa AI bisa melakukannya.
10. Cakupan Data (PENTING):
- Semua data tiket dan merchandise bersifat PER EVENT. Kamu HANYA boleh menyebutkan/menjawab tiket & merchandise milik event aktif di atas.
- JANGAN pernah menyebut, membandingkan, atau menggabungkan data dari event lain, walaupun user bertanya "tiket apa saja" atau "merch apa saja". Jika untuk event aktif belum ada, katakan belum tersedia untuk event ini.
11. Jam Tutup Penjualan:
- Jika user bertanya kapan penjualan tiket/merchandise ditutup atau sampai kapan bisa membeli (dan pertanyaan sejenis), jawab: "Biasanya kami menutup penjualan H-1 acara, tapi kalau ada informasi lebih lanjut, pantau Instagram kami ya." Jangan mengarang tanggal/jam tutup yang spesifik.

${bookingLookup ? `INFORMASI STATUS KODE TRANSAKSI YANG DITANYAKAN USER:\n${bookingLookup}\n(Gunakan data ini untuk menjawab pertanyaan status pemesanannya secara akurat dan beri link ke halaman tiket/merch terkait!)` : ''}

ATURAN MENJAWAB:
- Jawablah dengan ringkas, jelas, dan ramah (maksimal 2-3 paragraf singkat).
- Jangan bertele-tele dan hindari jargon teknis yang membingungkan.
- Jika merekomendasikan konser atau merchandise, sertakan link markdown yang relevan (misal: [Lihat Konser](/event/id) atau [Tiket Saya](/tiket-saya)).
- Jika user bertanya hal di luar konser/musik/EncoreTix, arahkan kembali dengan sopan ke topik konser dan tiket.`

    // Siapkan history untuk Gemini API
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []

    const recentMessages = messages.slice(-6)
    for (const msg of recentMessages) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })
    }

    // 1. Dapatkan model yang didukung secara otomatis dari akun user
    const resolvedModel = await resolveGeminiModel(apiKey)

    // Daftar kandidat model untuk dicoba berurutan. Model lite didahulukan
    // sebagai cadangan karena kuota free-tier dihitung per model; model
    // 'gemini-flash-latest' ditaruh paling akhir karena sering menggantung.
    const modelCandidates = Array.from(
      new Set([
        resolvedModel,
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
      ])
    )

    let lastError = ''
    for (const model of modelCandidates) {
      try {
        const result = await callGemini(model, apiKey, systemPrompt, contents)
        if (result.ok) {
          const parts = result.data.candidates?.[0]?.content?.parts || []
          const text = parts
            .filter((p: { thought?: boolean; text?: string }) => !p.thought && p.text)
            .map((p: { text: string }) => p.text)
            .join('')
          if (text) {
            cachedModelName = model
            return NextResponse.json({ reply: text })
          }
        }
        lastError = result.data.error?.message || `Model ${model} gagal`
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Koneksi gagal'
      }
    }

    throw new Error(lastError || 'Semua kandidat model Gemini gagal dihubungi.')
  } catch (err) {
    console.error('[Encore Assistant] Gagal memanggil Gemini:', err)
    return NextResponse.json(
      {
        reply:
          'Halo! Saya sedang mengalami kendala sementara dan belum bisa menjawab. Kamu bisa melihat info konser di menu Konser atau hubungi kami di menu Kontak.',
      },
      { status: 200 }
    )
  }
}
