import { NextResponse } from 'next/server'
import { getServerSupabase } from '../../lib/supabaseClient'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
// Max ukuran unggahan: 6MB (default free tier supabase storage)
export const maxDuration = 30

const BUCKET = 'band-images'
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp']
const MAX_SIZE = 6 * 1024 * 1024

// POST /api/uploads
// Upload gambar (PNG/JPG) ke Supabase Storage.
// Body: FormData dengan field `file` (wajib) & `bucket` (opsional, default 'band-images').
// Response: { url }
export async function POST(request: Request) {
  try {
    let file: File | null = null
    let bucket = BUCKET
    try {
      const formData = await request.formData()
      file = formData.get('file') as File | null
      const bucketField = formData.get('bucket') as string | null
      if (typeof bucketField === 'string' && bucketField.trim()) {
        bucket = bucketField.trim()
      }
    } catch {
      return NextResponse.json({ error: 'Body harus berupa FormData dengan field file' }, { status: 400 })
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Pilih file gambar terlebih dahulu' }, { status: 400 })
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: 'Format tidak didukung. Gunakan PNG, JPG, atau WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 6MB' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: false,
    })
    if (upErr) {
      if (upErr.message.toLowerCase().includes('bucket')) {
        return NextResponse.json(
          { error: `Bucket "${bucket}" belum dibuat. Buat di dashboard Supabase -> Storage (Public bucket).` },
          { status: 500 }
        )
      }
      throw new Error(upErr.message)
    }

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl.publicUrl }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}