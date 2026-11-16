-- ============================================================
-- MIGRASI: SAMAKAN TIMESTAMP DATABASE KE UTC (MySQL)
-- ============================================================
-- Jalankan SEKALI saja pada database yang sudah berisi data.
--
-- Latar belakang:
--   Sebelumnya sesi MySQL mengikuti timezone server (WIB / +07:00), sehingga
--   kolom DATETIME ber-default CURRENT_TIMESTAMP tersimpan sebagai jam dinding
--   WIB, padahal aplikasi membacanya sebagai UTC (mysql2 `timezone: 'Z'`).
--   Akibatnya jam tampil +7 jam.
--
--   Kini koneksi aplikasi menyetel `SET time_zone = '+00:00'` (UTC), jadi data
--   BARU tersimpan sebagai UTC. Baris LAMA di bawah ini masih WIB dan perlu
--   dikurangi 7 jam agar konsisten.
--
-- Catatan: kolom tanpa default CURRENT_TIMESTAMP (mis. pembayaran.tanggal_bayar,
-- pesanan_merchandise.bukti_pengambilan_at) sudah ditulis sebagai UTC oleh
-- aplikasi, jadi TIDAK ikut diubah.
--
-- JANGAN jalankan dua kali (akan mengurangi 7 jam lagi).
-- ============================================================

UPDATE band                 SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE customers            SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE event_info           SET updated_at     = DATE_SUB(updated_at,     INTERVAL 7 HOUR) WHERE updated_at     IS NOT NULL;
UPDATE merchandise          SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE panitia              SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE pembayaran           SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE pesanan_merchandise  SET tanggal_pesan  = DATE_SUB(tanggal_pesan,  INTERVAL 7 HOUR) WHERE tanggal_pesan  IS NOT NULL;
UPDATE pesanan_tiket        SET tanggal_pesan  = DATE_SUB(tanggal_pesan,  INTERVAL 7 HOUR) WHERE tanggal_pesan  IS NOT NULL;
UPDATE tiket                SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
UPDATE voucher              SET created_at     = DATE_SUB(created_at,     INTERVAL 7 HOUR) WHERE created_at     IS NOT NULL;
