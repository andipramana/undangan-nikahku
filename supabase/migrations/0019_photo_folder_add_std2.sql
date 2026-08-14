-- Folder foto baru "std2" (Save The Date 2 — foto statis di section countdown,
-- sebelumnya numpang ambil foto TERAKHIR dari folder "opening"). Enum
-- photo_folder dipakai oleh kolom photos.folder dan RLS.
--
-- PENTING (batasan PostgreSQL): "ALTER TYPE ... ADD VALUE" tidak bisa
-- digabung dalam satu transaksi dengan pernyataan lain yang memakai nilai
-- baru tersebut. Oleh karena itu file ini sengaja HANYA berisi SATU
-- pernyataan. Pemakaian nilai 'std2' (query admin, upload, RLS) baru boleh
-- dilakukan setelah migration ini ter-push.
alter type public.photo_folder add value if not exists 'std2';
