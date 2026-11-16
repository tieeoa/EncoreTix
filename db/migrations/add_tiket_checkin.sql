-- Check-in per tiket: simpan nomor tiket (1-based) yang sudah check-in.
-- status_check_in tetap dipakai sebagai status keseluruhan:
-- 'sudah_check_in' bila SEMUA tiket pada pesanan sudah check-in.
ALTER TABLE "public"."pesanan_tiket"
  ADD COLUMN IF NOT EXISTS "tiket_check_in" int[] NOT NULL DEFAULT '{}'::int[];

-- Backfill: pesanan yang sudah berstatus check-in dianggap semua tiketnya hadir.
UPDATE "public"."pesanan_tiket"
SET "tiket_check_in" = (
  SELECT array_agg(g ORDER BY g)
  FROM generate_series(1, "jumlah") AS g
)
WHERE "status_check_in" = 'sudah_check_in'
  AND COALESCE(array_length("tiket_check_in", 1), 0) = 0
  AND "jumlah" IS NOT NULL
  AND "jumlah" > 0;