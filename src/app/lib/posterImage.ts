import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const FALLBACK_POSTER = path.join(process.cwd(), 'public', 'coravfest.jpg')

function toLocalPosterPath(source: string): string | null {
  let pathname = source
  if (/^https?:\/\//i.test(source)) {
    try {
      pathname = new URL(source).pathname
    } catch {
      return null
    }
  }
  if (!pathname.startsWith('/')) return null

  const clean = pathname.replace(/^\/+/, '')
  if (!clean || clean.split('/').includes('..')) return null

  return clean.startsWith('uploads/')
    ? path.join(process.cwd(), 'data', clean)
    : path.join(process.cwd(), 'public', clean)
}

async function readPoster(source: string | null | undefined): Promise<Buffer> {
  if (source) {
    const local = toLocalPosterPath(source)
    if (local) {
      try {
        return await readFile(/*turbopackIgnore: true*/ local)
      } catch {
        // lanjut ke poster bawaan
      }
    }
  }
  return readFile(FALLBACK_POSTER)
}

export async function getPosterJpeg(
  source: string | null | undefined,
  width: number,
  height: number
): Promise<Buffer> {
  const input = await readPoster(source)
  return sharp(input, { failOn: 'none' })
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 85 })
    .toBuffer()
}
