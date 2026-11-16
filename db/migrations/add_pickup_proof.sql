-- Bukti pengambilan merchandise (foto dari panitia saat serah terima)
ALTER TABLE "public"."pesanan_merchandise"
  ADD COLUMN IF NOT EXISTS "bukti_pengambilan" text;

ALTER TABLE "public"."pesanan_merchandise"
  ADD COLUMN IF NOT EXISTS "bukti_pengambilan_at" timestamptz;

-- Auto-create public bucket untuk menyimpan foto bukti pengambilan
INSERT INTO "storage"."buckets" (id, name, public)
VALUES ('pickup-proofs', 'pickup-proofs', true)
ON CONFLICT (id) DO NOTHING;