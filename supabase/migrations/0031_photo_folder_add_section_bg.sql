-- Folder foto baru untuk latar section Acara (event_bg) dan Tanda Kasih (gift_bg).
-- Sebelumnya keduanya memakai gambar statis assets/img/rsvp-bg.webp milik root,
-- sehingga client baru tidak bisa menggantinya.
--
-- ALTER TYPE ... ADD VALUE tidak boleh digabung dengan pernyataan lain yang memakai
-- nilai barunya dalam satu transaksi, jadi file ini sengaja memakai dua pernyataan
-- ADD VALUE saja (tidak ada pemakaian).
alter type public.photo_folder add value if not exists 'event_bg';
alter type public.photo_folder add value if not exists 'gift_bg';
