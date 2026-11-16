-- ============================================================
-- Voucher per-event: setiap event punya kode voucher sendiri.
-- Jalankan di dashboard Supabase -> SQL Editor.
-- ============================================================

alter table public.voucher
  add column if not exists id_event text
  constraint fk_voucher_event
    references public.event_info(id)
    on update cascade
    on delete cascade;

create index if not exists idx_voucher_event
  on public.voucher (id_event);

-- Voucher lama yang belum terikat event: tempelkan ke event aktif (Vol.1 / id '1').
-- Sesuaikan id-nya jika voucher lama memang milik event lain.
update public.voucher
  set id_event = '1'
  where id_event is null
    and exists (select 1 from public.event_info where id = '1');

-- Catatan: voucher dengan id_event NULL dianggap TIDAK berlaku di event mana pun
-- (harus di-set event dulu lewat menu Kelola Voucher).