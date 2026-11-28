# EncoreTix

Platform pemesanan tiket dan official merchandise untuk CoravFest. Dibangun dengan Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, MySQL lokal, Midtrans, dan Google Gemini untuk asisten chat.

## Menjalankan proyek

1. Pastikan Node.js 20+ dan MySQL (Laragon) berjalan.
2. Salin `.env.example` menjadi `.env.local`, lalu isi koneksi database dan kredensial yang dipakai (Midtrans, SMTP, Gemini, `AUTH_SECRET`).
3. Pasang dependency: `npm install`
4. Jalankan server: `npm run dev`
5. Buka `http://localhost:3000`.

## Script

- `npm run dev` — development server
- `npm run build` — build produksi
- `npm run start` — menjalankan hasil build
- `npm run lint` — ESLint

## Struktur singkat

- `src/app/` — halaman dan API route
- `src/components/` — komponen UI (navbar, footer, chat, toast, dll.)
- `src/app/lib/` — helper PDF, email, event, pembayaran, dan koneksi MySQL
- `src/lib/` — state bahasa, hook, utilitas klien
- `db/migrations/` — migrasi database
- `data/uploads/` — hasil upload poster/band/bukti pengambilan (dilayani lewat `/uploads/...`)

## Catatan database

Aplikasi saat ini memakai **MySQL lokal** melalui `src/app/lib/mysqlClient.ts`. File `db/schema.sql` adalah skema lama berdialek PostgreSQL/Supabase dan hanya dipakai sebagai referensi/arsip — jangan dijalankan langsung sebagai migrasi produksi. Periksa dialek tiap file di `db/migrations/` sebelum memakainya.

Jangan pernah commit `.env.local`.
