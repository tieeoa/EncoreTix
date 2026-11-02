import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  jfif: 'image/jpeg',
  gif: 'image/gif',
}

// GET /uploads/[...path]
// Menyajikan file hasil upload dari folder data/uploads (di luar public agar
// tetap bisa diakses pada mode produksi `next start`).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    const safe = segments.map((s) => decodeURIComponent(s))
    if (safe.some((s) => !s || s === '.' || s === '..' || s.includes('/') || s.includes('\\'))) {
      return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 })
    }

    const base = path.join(process.cwd(), 'data', 'uploads')
    const filePath = path.join(base, ...safe)
    if (!filePath.startsWith(base + path.sep)) {
      return NextResponse.json({ error: 'Path tidak valid' }, { status: 400 })
    }

    const bytes = await readFile(filePath)
    const ext = (safe[safe.length - 1].split('.').pop() || '').toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
  }
}
