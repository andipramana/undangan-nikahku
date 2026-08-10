-- Bersih-bersih: Supabase project ini sebelumnya dipakai bersama sebuah
-- aplikasi pencatatan keuangan pribadi yang tidak lagi dipakai. 15 tabel
-- berikut bukan bagian dari skema undangan-nikahku (tidak pernah dibuat oleh
-- migration manapun di folder ini) dan saling terhubung lewat user_id/
-- wallet_id/category_id sebagai satu skema aplikasi itu sendiri — dikonfirmasi
-- pemilik project sudah tidak dipakai lagi, aman dihapus bersama.
--
-- Tabel "tamu" (daftar tamu manual, TIDAK terhubung ke skema ini maupun ke
-- skema di atas) SENGAJA DIPERTAHANKAN — masih kadang dipakai terpisah.
--
-- CASCADE membereskan foreign key antar 15 tabel ini sendiri; tidak ada
-- tabel undangan-nikahku maupun "tamu" yang mereferensikannya, jadi CASCADE
-- tidak akan merembet ke luar grup ini.
drop view if exists public.wallet_balances cascade;
drop table if exists public.savings_goals cascade;
drop table if exists public.debts cascade;
drop table if exists public.transaction_splits cascade;
drop table if exists public.pockets cascade;
drop table if exists public.asset_disposals cascade;
drop table if exists public.assets cascade;
drop table if exists public.app_release_info cascade;
drop table if exists public.transactions cascade;
drop table if exists public.recurring_transactions cascade;
drop table if exists public.budgets cascade;
drop table if exists public.notification_templates cascade;
drop table if exists public.categories cascade;
drop table if exists public.wallets cascade;
drop table if exists public.profiles cascade;
