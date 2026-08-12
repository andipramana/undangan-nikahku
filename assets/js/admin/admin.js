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
  // Tenant accounts are provisioned dynamically; the login form supplies email.
  window.AdminShared.initAdminAuth({
    // Tab Teks adalah tab aktif saat app tampil — muat isinya begitu login.
    onSignedIn: async () => {
      const preview = document.getElementById("preview-invitation");
      if (preview) preview.href = window.AdminAPI.tenant.path();
      const waWorkspace = document.getElementById("wa-workspace-link");
      if (waWorkspace) waWorkspace.href = window.AdminAPI.tenant.path("wa");
      if (window.ContentPanel && window.ContentPanel.load) await window.ContentPanel.load();
      // Menu lompat-section butuh fieldset #sec-... yang baru ada setelah form
      // tab Teks dirender — init di sini, bukan di awal halaman.
      if (window.SectionNav && window.SectionNav.init) window.SectionNav.init();
    },
    tabHandlers: {
      photos: () => { if (window.PhotosPanel) window.PhotosPanel.load(); },
      wishes: () => { if (window.WishesPanel) window.WishesPanel.load(); },
      // Pengiriman WA punya workspace terang sendiri; tidak lagi dimuat sebagai
      // panel gelap di sini (tautan di top-level admin.html menuju /<slug>/wa/).
      // Tampilan juga khusus admin.html (tema warna di luar scope check-in).
      tampilan: () => { if (window.ThemePanel) window.ThemePanel.load(); },
      fonts: () => { if (window.FontsPanel) window.FontsPanel.load(); },
      "editor-visual": () => { if (window.VisualEditorPanel) window.VisualEditorPanel.load(); }
    }
  });
})();
