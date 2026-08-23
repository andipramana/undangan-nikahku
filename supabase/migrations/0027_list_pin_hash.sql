-- PIN opsional PER DAFTAR untuk Kontak (0022) & Kado/Amplop (0025):
-- mencegah anggota admin yang berbagi login saling "ngintip" isi daftar
-- lewat UI. Null = daftar tidak ber-PIN (perilaku lama, langsung terbuka).
-- Hash SHA-256 dihitung di browser (PanelListPin.hashPin) — TIDAK pernah
-- menyimpan plaintext. Catatan jujur: ini gerbang UI biasa, bukan kontrol
-- keamanan level DB — RLS tetap mengizinkan semua admin tenant baca penuh.
alter table public.contact_lists add column if not exists pin_hash text;
alter table public.gift_lists add column if not exists pin_hash text;
