-- ============================================================
-- MIGRASI: SNAPSHOT NAMA/EMAIL PEMESAN PER PESANAN
-- ============================================================
-- Masalah: tabel `customers` disimpan per email, dan pemesanan tiket
-- meng-update `customers.nama` setiap kali email yang sama order lagi.
-- Akibatnya semua transaksi lama ikut menampilkan nama terakhir.
--
-- Solusi: simpan nama/email pemesan pada saat pesanan dibuat, di tabel
-- pesanan itu sendiri. Nilai snapshot ini tidak berubah walau data
-- customer diperbarui.
--
-- Aman dijalankan sekali. Kolom nullable; data lama tetap fallback ke
-- relasi `customers`.
-- ============================================================

ALTER TABLE pesanan_tiket
  ADD COLUMN nama_pemesan  VARCHAR(255) NULL AFTER status_check_in,
  ADD COLUMN email_pemesan VARCHAR(255) NULL AFTER nama_pemesan;

ALTER TABLE pesanan_merchandise
  ADD COLUMN nama_pemesan  VARCHAR(255) NULL,
  ADD COLUMN email_pemesan VARCHAR(255) NULL AFTER nama_pemesan;
