-- Kontak WA sekarang boleh tanpa nomor (mis. nama grup/keluarga yang mau
-- dikirim manual lewat tombol "Salin pesan", bukan wa.me). NULL = "tanpa
-- nomor" (bukan string kosong — index/pencarian lebih rapi).
alter table public.wa_contacts alter column phone drop not null;
