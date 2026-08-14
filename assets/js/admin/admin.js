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
      if (preview) {
        preview.href = window.AdminAPI.tenant.path(); // fallback statis (mis. copy-link)
        preview.addEventListener("click", async (ev) => {
          ev.preventDefault();
          // Publish membekukan tampilan tamu ke versi terakhir dipublikasikan
          // (lihat migration 0020 + publish.js) — supaya tombol Preview tetap
          // menunjukkan DRAFT (perubahan yang belum dipublikasikan), tulis
          // dulu draft terkini ke cache localStorage yang sudah dibaca
          // fetchInvitation() (wedding_invitation_v2_<slug>), baru buka tab
          // baru dengan ?preview=1 supaya halaman tamu memakainya alih-alih
          // memanggil RPC publik.
          try {
            const { data, error } = await window.AdminAPI.sb.rpc(
              "get_invitation_draft",
              { p_slug: window.AdminAPI.tenant.slug }
            );
            if (error) throw error;
            localStorage.setItem(`wedding_invitation_v2_${window.AdminAPI.tenant.slug}`, JSON.stringify(data));
          } catch (err) {
            console.warn("Gagal menyiapkan pratinjau draft, tampilkan versi terpublikasi:", err);
          }
          const base = window.AdminAPI.tenant.path();
          const url = base + (base.includes("?") ? "&" : "?") + "preview=1";
          window.open(url, "_blank", "noopener");
        });
      }
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
