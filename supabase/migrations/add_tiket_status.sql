-- ============================================================
-- Status penjualan per tiket: aktif / nonaktif (seperti voucher & merchandise).
-- Jalankan di dashboard Supabase -> SQL Editor.
-- ============================================================

alter table public.tiket
  add column if not exists status text not null default 'aktif'
  check (status in ('aktif', 'nonaktif'));

create index if not exists idx_tiket_status
  on public.tiket (status);

-- Tiket lama (yang belum punya status) otomatis dianggap aktif.
update public.tiket
  set status = 'aktif'
  where status is null;

-- Catatan: tiket dengan status 'nonaktif' disembunyikan dari penjualan
-- online (/tiket & /checkout) tapi tetap bisa dijual manual/offline
-- oleh admin via /admin/manual-order.
