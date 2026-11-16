-- Kode kelompok pesanan merchandise. Satu kelompok (satu checkout) berisi satu
-- atau lebih baris item (produk + ukuran + jumlah). Semua baris berbagi
-- kode_pesanan yang sama; kode_pengambilan tetap unik per baris.
-- Pesanan lama / pesanan 1 item: kode_pesanan = kode_pengambilan.
ALTER TABLE "public"."pesanan_merchandise"
  ADD COLUMN IF NOT EXISTS "kode_pesanan" text;

CREATE INDEX IF NOT EXISTS idx_pesanan_merchandise_kode_pesanan
  ON "public"."pesanan_merchandise" (kode_pesanan);

-- Backfill data lama: setiap baris lama adalah pesanan tunggal,
-- jadikan kode_pesanan sama dengan kode_pengambilan-nya.
UPDATE "public"."pesanan_merchandise"
SET kode_pesanan = kode_pengambilan
WHERE kode_pesanan IS NULL AND kode_pengambilan IS NOT NULL;