/** Template — pilih tampilan undangan. Terapkan langsung tersimpan (bukan
 * bagian siklus draft/save bar, sama seperti aksi foto — satu klik, satu
 * tindakan pasti). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["template"] = {
  title: "Template",
  group: "Tampilan",
  icon: window.PanelUI.icon("template"),
  async mount(outlet) {
    const { esc, toast } = window.PanelUI;
    // Daftar template dibaca dari templates/index.json — SATU sumber kebenaran
    // yang sama dengan katalog publik, supaya menambah template tidak perlu
    // menyunting halaman admin lagi.
    let KNOWN_TEMPLATES = [];
    try {
      const res = await fetch("templates/index.json", { cache: "no-cache" });
      KNOWN_TEMPLATES = (await res.json()).templates || [];
    } catch (_) {
      // Katalog tidak terbaca (offline) — jangan tampilkan halaman kosong.
      KNOWN_TEMPLATES = [{ id: "klasik", name: "Classic Elegance", desc: "", colors: [] }];
    }
    const c = window.PanelStore.getContent();
    // Data lama menyimpan id "classic-elegance"; template itu sekarang bernama
    // "klasik" (punya folder sendiri). Dipetakan saat dibaca supaya tenant lama
    // tetap menunjuk template yang benar tanpa perlu migrasi data.
    const ALIAS = { "classic-elegance": "klasik" };
    const raw = c.templateId || c.template || "klasik";
    let activeId = ALIAS[raw] || raw;
    if (KNOWN_TEMPLATES.length > 0 && !KNOWN_TEMPLATES.some((t) => t.id === activeId)) {
      activeId = "klasik";
    }

    function render() {
      outlet.innerHTML = `
        <p class="p-hint">Pilih tampilan undangan. Template mengubah warna, font, transisi, dan urutan section. Data (teks, foto, tamu) tetap aman.</p>
        <div style="display:grid;gap:1rem">
          ${KNOWN_TEMPLATES.map((t) => {
            const info = t;
            const active = t.id === activeId;
            // Pita swatch: warna template sebagai identitas visual kartu,
            // bukan tiga titik kecil. Hex datang dari data VISUAL_INFO.
            const stops = (info.colors || []).map((clr, i, arr) =>
              `${clr} ${(i / arr.length) * 100}% ${((i + 1) / arr.length) * 100}%`).join(", ");
            return `
            <section class="p-card"${active ? ' style="border-color:var(--p-accent);box-shadow:0 0 0 3px var(--p-accent-wash)"' : ""}>
              <div aria-hidden="true" style="height:10px;border-radius:999px;background:linear-gradient(90deg, ${stops});margin-bottom:.25rem"></div>
              <h3 class="p-card__title">${esc(t.name)} ${active ? window.PanelUI.badge("Aktif", "ok") : ""}</h3>
              <p class="p-card__desc">${esc(info.desc || "")}</p>
              <div class="p-toolbar">
                <button type="button" class="p-btn p-btn--primary" data-apply="${t.id}" ${active ? "disabled" : ""}>${active ? "Aktif" : "Pakai"}</button>
                <button type="button" class="p-btn p-btn--ghost" data-preview="${t.id}">Preview</button>
              </div>
            </section>`;
          }).join("")}
        </div>
      `;
      outlet.querySelectorAll("[data-apply]").forEach((btn) => btn.addEventListener("click", () => apply(btn.dataset.apply)));
      outlet.querySelectorAll("[data-preview]").forEach((btn) => btn.addEventListener("click", () => preview(btn.dataset.preview)));
    }

    async function apply(id) {
      if (id === activeId) return;
      // Ditulis ke templateId (kunci baru). `template` lama sengaja ikut
      // diisi supaya tenant yang sempat dibuka versi kode lama tidak kosong.
      window.PanelStore.set("templateId", id);
      window.PanelStore.set("template", id);
      const { error } = await window.PanelStore.save(["templateId", "template"]);
      if (error) { toast("Gagal menyimpan template: " + error.message, true); return; }
      activeId = id;
      toast("Template diterapkan. Buka ulang undangan untuk melihat hasilnya.");
      render();
    }
    function preview(id) {
      window.open(`${window.AdminAPI.tenant.path()}?template=${id}`, "_blank", "noopener");
    }

    render();
  },
  destroy() {}
};
