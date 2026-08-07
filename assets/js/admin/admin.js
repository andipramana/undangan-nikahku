/**
 * Panel admin utama (admin.html): pembuatan client Supabase, sesi login/logout,
 * perpindahan tab, toast, dan helper bersama sudah diekstrak ke admin/shared.js
 * (dipakai juga oleh admin-qr.html — perbaikan bug di sana cukup sekali, tidak
 * diduplikasi). File ini hanya memegang hal spesifik halaman ini: identitas
 * login (email tetap + username tampilan) dan pemicu panel per tab.
 *
 * Keamanan:
 *  - Password TIDAK pernah ada di kode. Form login hanya meneruskan kata
 *    sandi ke signInWithPassword — verifikasi dilakukan server Supabase.
 *  - Nama pengguna "Mita&Andi" dipetakan ke email tetap; pemetaan ini bukan
 *    rahasia (email admin boleh terlihat), sedangkan kata sandi rahasia.
 */
(function () {
  const ADMIN_EMAIL = "admin@mitaandi.wedding";
  const ADMIN_USERNAME = "Mita&Andi";

  window.AdminShared.initAdminAuth({
    email: ADMIN_EMAIL,
    username: ADMIN_USERNAME,
    // Tab Teks adalah tab aktif saat app tampil — muat isinya begitu login.
    onSignedIn: () => {
      if (window.ContentPanel && window.ContentPanel.load) window.ContentPanel.load();
    },
    tabHandlers: {
      photos: () => { if (window.PhotosPanel) window.PhotosPanel.load(); },
      wishes: () => { if (window.WishesPanel) window.WishesPanel.load(); }
    }
  });
})();
