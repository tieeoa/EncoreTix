import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { requireRole, rejectInactiveAdminMutation } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 30

const DEFAULT_BUCKET = 'band-images'
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp']
const MAX_SIZE = 6 * 1024 * 1024
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9-]*$/

// POST /api/uploads
// Upload gambar (PNG/JPG) ke penyimpanan lokal: data/uploads/<bucket>/<file>.
// Body: FormData dengan field `file` (wajib) & `bucket` (opsional, default 'band-images').
// Response: { url } — URL relatif yang bisa langsung dipakai di <img src>.
export async function POST(request: Request) {
  try {
    const auth = requireRole(request, ['admin', 'superadmin'])
    if ('response' in auth) return auth.response
    const ro = await rejectInactiveAdminMutation(request, auth.session)
    if (ro) return ro
    let file: File | null = null
    let bucket = DEFAULT_BUCKET
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

    if (!BUCKET_PATTERN.test(bucket)) {
      return NextResponse.json({ error: 'Nama bucket tidak valid' }, { status: 400 })
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

    const filename = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const dir = path.join(process.cwd(), 'data', 'uploads', bucket)
    await mkdir(dir, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, filename), bytes)

    return NextResponse.json({ url: `/uploads/${bucket}/${filename}` }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
