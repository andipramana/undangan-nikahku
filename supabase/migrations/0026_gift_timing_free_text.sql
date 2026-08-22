-- Keterangan kado jadi TEKS BEBAS (mis. "H-, saat akad") — dropdown 3 opsi
-- H-/H/H+ dinilai terlalu kaku oleh pemilik produk. Constraint check dari
-- 0025 dilepas; nilai 'h-'/'h'/'h+' yang sempat tersimpan dibiarkan apa
-- adanya (masih string biasa).
alter table public.gift_list_entries drop constraint if exists gift_list_entries_timing_check;
