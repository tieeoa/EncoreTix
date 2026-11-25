-- Tambah kolom pencatat aktor admin (tanpa tabel baru, aman untuk data lama).
-- Pesanan tiket manual: id_panitia = pembuat order; checked_in_by = petugas check-in.
ALTER TABLE pesanan_tiket
  ADD COLUMN id_panitia CHAR(36) NULL DEFAULT NULL,
  ADD COLUMN checked_in_by CHAR(36) NULL DEFAULT NULL;

CREATE INDEX idx_pesanan_tiket_panitia ON pesanan_tiket (id_panitia);
CREATE INDEX idx_pesanan_tiket_checkin_by ON pesanan_tiket (checked_in_by);

-- pesanan_merchandise.id_panitia sudah ada di skema aktual (dipakai saat verifikasi pengambilan).
