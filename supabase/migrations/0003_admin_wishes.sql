-- Kelola ucapan dari panel admin.
--
-- Policy di 0001 ditulis `to anon` saja. Role di Postgres tidak bertingkat di
-- sini: pengguna yang SUDAH LOGIN berperan `authenticated`, bukan `anon`, jadi
-- policy lama tidak berlaku untuknya. Akibatnya admin yang login justru melihat
-- daftar ucapan KOSONG — bukan error, sekadar nol baris lolos RLS — sementara
-- tamu yang belum login melihat isinya. Dua policy di bawah menutup celah itu.

-- Admin boleh membaca seluruh ucapan.
create policy "admin read wishes"
  on public.wishes for select
  to authenticated
  using (true);

-- Admin boleh menghapus ucapan (mis. spam atau salah kirim).
-- Tamu (anon) tetap hanya boleh menulis & membaca — tidak ada policy delete
-- untuk anon, jadi tamu tidak bisa menghapus ucapan siapa pun.
create policy "admin delete wishes"
  on public.wishes for delete
  to authenticated
  using (true);

grant select, delete on public.wishes to authenticated;
