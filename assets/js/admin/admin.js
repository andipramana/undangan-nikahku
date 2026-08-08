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
    onSignedIn: async () => {
      if (window.ContentPanel && window.ContentPanel.load) await window.ContentPanel.load();
      // Menu lompat-section butuh fieldset #sec-... yang baru ada setelah form
      // tab Teks dirender — init di sini, bukan di awal halaman.
      if (window.SectionNav && window.SectionNav.init) window.SectionNav.init();
    },
    tabHandlers: {
      photos: () => { if (window.PhotosPanel) window.PhotosPanel.load(); },
      wishes: () => { if (window.WishesPanel) window.WishesPanel.load(); },
      // Kirim WA hanya ada di admin.html — admin-qr.html tidak punya tab ini
      // (fitur broadcast di luar scope check-in), jadi handler ini tidak pernah
      // dipanggil di sana.
      wa: () => { if (window.WaBlast) window.WaBlast.load(); }
    }
  });
})();
