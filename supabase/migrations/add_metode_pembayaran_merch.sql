-- Metode pembayaran yang dipilih pembeli untuk pesanan merchandise.
-- Terapkan di dashboard Supabase (Database > Migrations / SQL Editor)
-- agar kolom Metode tampil di halaman transaksi.
ALTER TABLE "public"."pesanan_merchandise"
  ADD COLUMN IF NOT EXISTS "metode_pembayaran" text;
