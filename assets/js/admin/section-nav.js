/**
 * Menu lompat-section untuk tab Teks admin — meniru pola nav-menu.js sisi
 * tamu: FAB membuka modal berisi shortcut ke tiap fieldset form (id="sec-..."
 * dari content.js), supaya admin tidak perlu scroll melewati 13 section.
 *
 * FAB HANYA relevan saat tab Teks aktif, jadi visibilitasnya mengikuti
 * visibilitas #tab-content. Tab click handler utama hidup di shared.js
 * (initAdminAuth) — file ini cukup pasang listener TAMBAHAN di .tab, tanpa
 * mengubah shared.js. MutationObserver pada #app menutup celah jalur lain
 * (login baru / logout / sesi kedaluwarsa men-toggle hidden #app tanpa klik
 * tab), supaya FAB tidak pernah mengambang di layar login.
 *
 * Dipanggil dari admin.js SETELAH ContentPanel.load() — form (dan id section)
 * harus sudah ada di DOM sebelum modal dibangun. */
window.SectionNav = { init };

// [id section, label menu] — urut sama persis dengan render() di content.js.
// Label sengaja singkat dan manusiawi; boleh beda dari judul fieldset.
const SECTION_ITEMS = [
  ["umum", "Umum"],
  ["sapaan", "Sapaan tamu"],
  ["mempelai", "Mempelai"],
  ["opening", "Opening"],
  ["event", "Event"],
  ["dresscode", "Dresscode"],
  ["quote", "Quote foto"],
  ["live-streaming", "Live streaming"],
  ["love-story", "Love story"],
  ["gift-rekening", "Rekening"],
  ["gift-kontak", "Kontak WA"],
  ["gift-alamat", "Alamat kado"],
  ["gift-rekomendasi", "Rekomendasi kado"],
  ["lainnya", "Lainnya"]
];

function init() {
  const btn = document.getElementById("btn-section-nav");
  const modal = document.getElementById("section-nav-modal");
  const list = document.getElementById("section-nav-list");
  if (!btn || !modal || !list) return;

  list.innerHTML = SECTION_ITEMS
    .map(([id, label]) => `<button type="button" data-scroll="#sec-${id}">${label}</button>`)
    .join("");

  btn.addEventListener("click", () => {
    modal.hidden = false;
  });

  const close = () => {
    modal.hidden = true;
  };
  modal.querySelector(".modal__close").addEventListener("click", close);
  // Klik di luar panel (overlay) menutup — pola sama seperti modal lain.
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  // Klik item → tutup menu dulu, baru scroll pelan ke section-nya. Kalau
  // target entah kenapa belum ada (mis. form gagal dimuat), klik hanya
  // menutup menu tanpa scroll.
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-scroll]");
    if (!item) return;
    const target = document.querySelector(item.dataset.scroll);
    close();
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Visibilitas FAB + tombol simpan: hanya tab Teks yang terbuka ----------
  const app = document.getElementById("app");
  const contentPanel = document.getElementById("tab-content");
  // Tombol "Simpan semua" (admin.html, fixed di luar scroller) hidup di tab
  // yang sama dengan FAB — visibilitasnya digabung ke sini, tidak perlu
  // mekanisme kedua.
  const saveBtn = document.getElementById("btn-save-content");
  function updateVisibility() {
    const contentOpen = app && !app.hidden && contentPanel && !contentPanel.hidden;
    // Tanpa pengecekan section, FAB tampil sia-sia kalau form gagal dimuat
    // (load() menampilkan warning + tombol "Coba lagi" — tidak ada target
    // yang bisa dilompati; kalau muat ulang berhasil, FAB muncul kembali
    // saat tab berpindah).
    const hasSections = !!document.querySelector(".form-section");
    btn.hidden = !contentOpen || !hasSections;
    if (saveBtn) saveBtn.hidden = btn.hidden;
    if (btn.hidden && !modal.hidden) close();
  }
  document.querySelectorAll(".tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", updateVisibility);
  });
  // Login/logout dan sesi yang kedaluwarsa men-toggle hidden pada #app tanpa
  // klik tab — amati perubahan atributnya supaya FAB ikut sembunyi.
  if (app) {
    new MutationObserver(updateVisibility).observe(app, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }
  updateVisibility();
}
