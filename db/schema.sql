-- ============================================================
-- Skema database Supabase untuk EncoreTix
-- Berdasarkan ERD MySQL, dikonversi untuk PostgreSQL/Supabase
-- Cara pakai: buka dashboard supabase -> SQL Editor -> tempel & jalankan semua.
-- ============================================================

-- ---------- 1. TABEL CUSTOMER ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  email text not null unique,
  no_hp text,
  usia integer,
  no_identitas text,
  jenis_identitas text,
  jenis_kelamin text check (jenis_kelamin in ('Laki-laki', 'Perempuan')),
  created_at timestamptz not null default now()
);

-- ---------- 2. TABEL TIKET ----------
create table public.tiket (
  id uuid primary key default gen_random_uuid(),
  kategori text not null,
  harga numeric(12,2) not null,
  periode_penjualan text,
  deskripsi text,
  kuota integer not null,
  sisa_kuota integer not null,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  created_at timestamptz not null default now()
);

-- ---------- 3. TABEL VOUCHER ----------
create table public.voucher (
  id uuid primary key default gen_random_uuid(),
  kode_voucher text not null unique,
  nominal_diskon numeric(12,2) not null,
  jumlah_digunakan integer default 0,
  kuota_penggunaan integer not null,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  id_event text,
  created_at timestamptz not null default now(),
  constraint fk_voucher_event
    foreign key (id_event)
    references public.event_info(id)
    on update cascade
    on delete cascade
);

-- ---------- 4. TABEL PANITIA ----------
create table public.panitia (
  id uuid primary key default gen_random_uuid(),
  nama_panitia text not null,
  username text not null unique,
  password text not null,
  created_at timestamptz not null default now()
);

-- ---------- 5. TABEL BAND ----------
create table public.band (
  id uuid primary key default gen_random_uuid(),
  nama_band text not null,
  deskripsi text,
  gambar text,
  created_at timestamptz not null default now()
);

-- ---------- 6. TABEL MERCHANDISE ----------
create table public.merchandise (
  id uuid primary key default gen_random_uuid(),
  nama_merch text not null,
  foto text,
  harga numeric(12,2) not null,
  kategori text,
  status text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  stok_s integer default 0,
  stok_m integer default 0,
  stok_l integer default 0,
  stok_xl integer default 0,
  stok_xxl integer default 0,
  id_band uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_merch_band
    foreign key (id_band)
    references public.band(id)
    on update cascade
    on delete restrict
);

-- ---------- 7. TABEL PESANAN TIKET ----------
create table public.pesanan_tiket (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique,
  id_customer uuid not null,
  id_tiket uuid not null,
  id_voucher uuid null,
  jumlah integer not null,
  tanggal_pesan timestamptz not null default now(),
  source text not null default 'online' check (source in ('online', 'offline')),
  status_bayar text not null default 'pending' check (status_bayar in ('pending', 'berhasil', 'gagal')),
  status_check_in text not null default 'belum_check_in' check (status_check_in in ('belum_check_in', 'sudah_check_in')),
  qr_code text,
  pemilik_ids uuid[] not null default '[]',
  constraint fk_pesanan_customer
    foreign key (id_customer)
    references public.customers(id)
    on update cascade
    on delete cascade,
  constraint fk_pesanan_tiket
    foreign key (id_tiket)
    references public.tiket(id)
    on update cascade
    on delete restrict,
  constraint fk_pesanan_voucher
    foreign key (id_voucher)
    references public.voucher(id)
    on update cascade
    on delete set null
);

-- ---------- 8. TABEL PEMBAYARAN ----------
create table public.pembayaran (
  id uuid primary key default gen_random_uuid(),
  id_pesanan_tiket uuid not null unique,
  metode_pembayaran text not null,
  tanggal_bayar timestamptz,
  total_bayar numeric(12,2) not null,
  status_pembayaran text not null default 'pending' check (status_pembayaran in ('pending', 'berhasil', 'gagal')),
  created_at timestamptz not null default now(),
  constraint fk_pembayaran_pesanan
    foreign key (id_pesanan_tiket)
    references public.pesanan_tiket(id)
    on update cascade
    on delete cascade
);

-- ---------- 9. TABEL PESANAN MERCHANDISE ----------
create table public.pesanan_merchandise (
  id uuid primary key default gen_random_uuid(),
  id_customer uuid not null,
  id_merch uuid not null,
  id_panitia uuid null,
  tanggal_pesan timestamptz not null default now(),
  jumlah integer not null,
  ukuran text,
  alamat text,
  total_harga numeric(12,2) not null,
  qr_pengambilan text,
  kode_pengambilan text unique,
  kode_pesanan text,
  status_bayar text not null default 'pending' check (status_bayar in ('pending', 'berhasil', 'gagal')),
  status_pengambilan text not null default 'belum_diambil' check (status_pengambilan in ('belum_diambil', 'sudah_diambil')),
  constraint fk_merch_order_customer
    foreign key (id_customer)
    references public.customers(id)
    on update cascade
    on delete cascade,
  constraint fk_merch_order_merch
    foreign key (id_merch)
    references public.merchandise(id)
    on update cascade
    on delete restrict,
  constraint fk_merch_order_panitia
    foreign key (id_panitia)
    references public.panitia(id)
    on update cascade
    on delete set null
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Aktifkan RLS untuk semua tabel
alter table public.customers enable row level security;
alter table public.tiket enable row level security;
alter table public.voucher enable row level security;
alter table public.panitia enable row level security;
alter table public.band enable row level security;
alter table public.merchandise enable row level security;
alter table public.pesanan_tiket enable row level security;
alter table public.pembayaran enable row level security;
alter table public.pesanan_merchandise enable row level security;

-- Katalog publik (tiket, band, merchandise) boleh dibaca siapa saja (anon key)
create policy "tiket publik bisa dibaca" on public.tiket
  for select to anon using (true);

create policy "band publik bisa dibaca" on public.band
  for select to anon using (true);

create policy "merchandise publik bisa dibaca" on public.merchandise
  for select to anon using (true);

-- Data sensitif (customer, voucher, panitia, pesanan, pembayaran) TIDAK boleh diakses langsung dari browser
-- Semua akses lewat API route yang memakai service role key
-- (Tidak ada policy anon => deny by default)

-- ============================================================
-- MIGRASI (jalankan setelah tabel di atas dibuat)
-- ============================================================

-- Tambah kolom role di panitia (untuk admin vs superadmin)
alter table public.panitia
  add column if not exists role text not null default 'admin'
  check (role in ('admin', 'superadmin'));

-- Status akun panitia (aktif/nonaktif)
alter table public.panitia
  add column if not exists status text not null default 'aktif'
  check (status in ('aktif', 'nonaktif'));

-- Tabel event. MULTI-ROW: satu baris per edisi event (CoravFest Vol.1, Vol.2, dst).
-- Event dengan status 'active' = event yang sedang dijual & ditampilkan di halaman utama.
-- Event dengan status 'closed' (atau tanggal sudah lewat) = "Event Sebelumnya" di home.
-- id event otomatis angka berurutan (1, 2, 3, ...) via sequence.
create sequence if not exists public.event_info_id_seq;
create table if not exists public.event_info (
  id text primary key default nextval('public.event_info_id_seq')::text,
  nama_event text not null default 'CoravFest Vol.1',
  slug text unique,
  tanggal date,
  waktu text,
  venue text,
  alamat text,
  deskripsi text,
  syarat_ketentuan text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'closed')),
  gambar text,
  updated_at timestamptz not null default now()
);

alter table public.event_info enable row level security;

create policy "event_info publik bisa dibaca" on public.event_info
  for select to anon using (true);

-- Masuk data awal event_info (Edisi Pertama / Vol.1)
insert into public.event_info (id, nama_event, slug) values ('1', 'CoravFest Vol.1', 'coravfest-vol-1')
  on conflict (id) do nothing;
insert into public.event_info (id, nama_event, slug) values ('2', 'CoravFest Vol.2', 'coravfest-vol-2')
  on conflict (id) do nothing;

-- Lanjutkan sequence setelah data seed (id = 2).
select setval('public.event_info_id_seq', greatest(coalesce((select max(id::bigint) from public.event_info where id ~ '^[0-9]+$'), 0), 2));

-- ============================================================
-- MIGRASI (untuk database yang SUDAH jalan)
-- ============================================================

-- Kolom baru di band: deskripsi (teks) & gambar (path/URL file PNG/JPG)
alter table public.band
  add column if not exists deskripsi text,
  add column if not exists gambar text;

alter table public.tiket
  add column if not exists deskripsi text;

-- ============================================================
-- MIGRASI: HAPUS created_at DI TABEL PESANAN
-- ============================================================
-- PENYIMPANAN GAMBAR BAND (Supabase Storage)
-- ============================================================
-- Gambar band (PNG/JPG) diupload ke Supabase Storage:
--   1. Dashboard Supabase -> Storage -> New bucket
--   2. Nama bucket: band-images
--   3. Public bucket: ON (supaya gambar bisa langsung ditampilkan di halaman)
--   4. Ukuran file max: 6MB (default free tier)
-- Kolom band.gambar menyimpan URL publik hasil upload tersebut.

-- ============================================================
-- KATEGORI MERCHANDISE (otomatis dari data)
-- ============================================================
-- Dropdown/button kategori TIDAK memakai tabel terpisah.
-- Kode mengambil nilai unik kolom merchandise.kategori lewat API
-- (select distinct). Pastikan saat tambah produk, isi kategori
-- dengan nilai yang konsisten (contoh: Apparel, Accessories, ...).

-- ============================================================
-- MIGRASI: HAPUS created_at DI TABEL PESANAN
-- ============================================================
-- Kolom timestamp yang dipakai adalah tanggal_pesan (sesuai ERD).
-- Jalankan untuk database yang SUDAH jalan bila masih ada created_at.
alter table public.pesanan_tiket
  drop column if exists created_at;

alter table public.pesanan_merchandise
  drop column if exists created_at;

-- ============================================================
-- MIGRASI: DUKUNGAN MULTI-EVENT
-- ============================================================
-- Semua katalog (tiket, band, merchandise) kini di-scope per event.
-- Tambahkan kolom `id_event` (nullable dulu + backfill, lalu FK).
alter table public.tiket
  add column if not exists id_event text;

alter table public.band
  add column if not exists id_event text;

alter table public.merchandise
  add column if not exists id_event text;

-- Backfill: data lama (yang belum punya event) diarahkan ke event '1' (CoravFest Vol.1).
update public.tiket set id_event = '1' where id_event is null;
update public.band set id_event = '1' where id_event is null;
update public.merchandise set id_event = '1' where id_event is null;

alter table public.tiket
  add constraint fk_tiket_event
    foreign key (id_event) references public.event_info(id)
    on update cascade on delete restrict;

alter table public.band
  add constraint fk_band_event
    foreign key (id_event) references public.event_info(id)
    on update cascade on delete restrict;

alter table public.merchandise
  add constraint fk_merch_event
    foreign key (id_event) references public.event_info(id)
    on update cascade on delete restrict;

create index if not exists idx_tiket_id_event on public.tiket(id_event);
create index if not exists idx_band_id_event on public.band(id_event);
create index if not exists idx_merch_id_event on public.merchandise(id_event);

-- RLS: select publik untuk event_info sudah ada di atas.
-- Perhatikan: semua penulisan katalog melalui API route (service role => RLS bypass).

-- ============================================================
-- MIGRASI: HAPUS KOLOM KAPASITAS DI EVENT_INFO
-- ============================================================
-- Kapasitas event kini diambil dari total stok tiket
-- (sum kuota tiket untuk id_event tersebut), bukan kolom sendiri.
alter table public.event_info
  drop column if exists kapasitas;

-- ============================================================
-- MIGRASI: GABUNGKAN WAKTU_MULAI & WAKTU_SELESAI MENJADI `waktu`
-- ============================================================
-- Nilai `waktu` = gabungan mulai & selesai, contoh: '15.00 - 22.00 WIB'.
alter table public.event_info
  add column if not exists waktu text;

update public.event_info set waktu = trim(
  concat_ws(' - ', nullif(waktu_mulai, ''), nullif(waktu_selesai, ''))
) where waktu is null;

alter table public.event_info
  drop column if exists waktu_mulai,
  drop column if exists waktu_selesai;

-- ============================================================
-- MIGRASI: RENAME POSTER_URL -> GAMBAR DI EVENT_INFO
-- ============================================================
alter table public.event_info
  rename column poster_url to gambar;

-- ============================================================
-- SELESAI
-- ============================================================

-- ============================================================
-- MIGRASI: FOTO MERCHANDISE JADI ARRAY (lebih dari 1 foto)
-- ============================================================
-- Ubah kolom `foto` (text) menjadi `text[]` agar bisa menyimpan
-- banyak URL foto sekaligus. Foto pertama = foto utama.
alter table public.merchandise
  alter column foto type text[]
  using case
    when foto is null or foto = '' then '{}'::text[]
    else array[foto]
  end;

-- ============================================================
-- MIGRASI: UKURAN MERCHANDISE (S, M, L, XL, XXL)
-- ============================================================
-- Tambahkan kolom `ukuran` di pesanan_merchandise untuk
-- menyimpan pilihan ukuran barang yang dibeli customer.
alter table public.pesanan_merchandise
  add column if not exists ukuran text;

-- ============================================================
-- MIGRASI: STOK PER UKURAN MERCHANDISE (S, M, L, XL, XXL)
-- ============================================================
-- Simpan kapasitas stok online per ukuran di kolom terpisah.
-- Sisa stok per ukuran = stok_<ukuran> - total qty pesanan
-- berstatus `berhasil` dengan ukuran tersebut.
alter table public.merchandise
  add column if not exists stok_s integer default 0,
  add column if not exists stok_m integer default 0,
  add column if not exists stok_l integer default 0,
  add column if not exists stok_xl integer default 0,
  add column if not exists stok_xxl integer default 0;

-- `kuota_online` diganti oleh stok per ukuran di atas.
alter table public.merchandise
  drop column if exists kuota_online;

-- ============================================================
-- MIGRASI: STATUS PENJUALAN MERCHANDISE
-- ============================================================
-- `status` = 'aktif' (bisa dibeli online) / 'nonaktif' (penjualan dihentikan,
-- sisa stok dijual offline saat event).
alter table public.merchandise
  add column if not exists status text not null default 'aktif'
  check (status in ('aktif', 'nonaktif'));

-- Stok offline (kuota_offline) dihapus; fokus penjualan lewat web.
alter table public.merchandise
  drop column if exists kuota_offline;

