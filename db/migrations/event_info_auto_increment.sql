-- ============================================================
-- MIGRASI: ID EVENT MENJADI AUTO INCREMENT (1, 2, 3, 4, ...)
-- Versi aman: TIDAK bergantung pada FK ON UPDATE CASCADE.
-- Data lama tidak dihapus/diubah isinya — hanya diskalakan ke id angka baru.
-- Run satu kali di Supabase SQL Editor.
-- ============================================================

create sequence if not exists public.event_info_id_seq;

-- Pemetaan id UUID lama -> id angka baru (lanjut dari angka terbesar yang ada).
-- Baris ber-id angka (seed '1','2') dibiarkan tetap biar tidak ada data yang berpindah.
create temp table event_id_map as
with base as (
  select coalesce(max(id::bigint), 0) as max_num from public.event_info where id ~ '^[0-9]+$'
)
select
  e.id as old_id,
  (base.max_num + row_number() over (
    order by (e.tanggal is null), e.tanggal nulls last, e.updated_at asc nulls last, e.nama_event
  ))::text as new_id
from public.event_info e
cross join base
where e.id !~ '^[0-9]+$';

-- Simpan slug asli (unik), lalu kosongkan punya baris lama supaya insert salinan tidak clash.
create temp table event_slug_map as select id as old_id, slug from public.event_info;
update public.event_info set slug = null where id in (select old_id from event_id_map);

-- Salin event UUID menjadi baris baru ber-id angka (data sama persis).
insert into public.event_info (id, nama_event, slug, tanggal, waktu, venue, alamat, deskripsi, syarat_ketentuan, status, gambar, updated_at)
select
  m.new_id, e.nama_event, s.slug, e.tanggal, e.waktu, e.venue, e.alamat, e.deskripsi, e.syarat_ketentuan, e.status, e.gambar, e.updated_at
from public.event_info e
join event_id_map m on m.old_id = e.id
left join event_slug_map s on s.old_id = e.id;

-- Arahkan data katalog (tiket/band/merch) ke id baru.
update public.tiket t set id_event = m.new_id from event_id_map m where t.id_event = m.old_id;
update public.band b set id_event = m.new_id from event_id_map m where b.id_event = m.old_id;
update public.merchandise me set id_event = m.new_id from event_id_map m where me.id_event = m.old_id;

-- Hapus baris event lama (sudah tidak ada lagi yang mereferensinya).
delete from public.event_info e using event_id_map m where e.id = m.old_id;

-- Default id baru = angka auto-increment dari sequence.
alter table public.event_info
  alter column id set default nextval('public.event_info_id_seq')::text;

-- Lanjutkan sequence ke angka terbesar saat ini (agar event berikutnya lanjut).
select setval('public.event_info_id_seq', coalesce((select max(id::bigint) from public.event_info where id ~ '^[0-9]+$'), 0));