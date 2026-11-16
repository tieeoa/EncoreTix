-- ============================================================
-- MIGRASI: SNAPSHOT LENGKAP DATA PEMESAN & PEMILIK TIKET
-- ============================================================
-- Melengkapi migrasi add_pemesan_snapshot.sql.
--
-- Masalah: tabel `customers` unik per email dan nama tidak pernah ditimpa,
-- sehingga e-tiket/e-merch/dashboard bisa menampilkan nama lama (nama saat
-- email tersebut pertama kali terdaftar), bukan nama yang diisi saat checkout.
--
-- Solusi: simpan snapshot data pemesan dan seluruh pemilik tiket pada
-- pesanan itu sendiri. Nilai snapshot tidak berubah walau data customer
-- diperbarui di kemudian hari.
--
-- pemesan_data  : object  { nama, email, no_hp, usia, no_identitas, jenis_identitas, jenis_kelamin }
-- pemilik_data  : array   object dengan bentuk sama, urut sesuai pemilik_ids
--
-- Aman dijalankan sekali pada database MySQL. Kolom nullable; data lama tetap
-- fallback ke relasi `customers` / kolom nama_pemesan & email_pemesan.
-- ============================================================

ALTER TABLE pesanan_tiket
  ADD COLUMN pemesan_data JSON NULL AFTER email_pemesan,
  ADD COLUMN pemilik_data JSON NULL AFTER pemilik_ids;

ALTER TABLE pesanan_merchandise
  ADD COLUMN pemesan_data JSON NULL AFTER email_pemesan;
