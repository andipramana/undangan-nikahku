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
      // `hidden: true` = template masih digarap: folder + entri katalog tetap
      // ada (test kontrak mewajibkan katalog & folder sepadan, dan masih bisa
      // dipratinjau lewat ?template=<id>), tapi client tidak boleh memilihnya.
      KNOWN_TEMPLATES = ((await res.json()).templates || []).filter((t) => !t.hidden);
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
        <p class="p-hint">Pilih tampilan undangan. Setelan tampilan setiap template terpisah. Data undangan (nama, tanggal, acara, cerita) tetap terbawa.</p>
        <div style="display:grid;gap:1rem">
          ${KNOWN_TEMPLATES.map((t) => {
            const info = t;
            const active = t.id === activeId;
            const stops = (info.colors || []).map((clr, i, arr) =>
              `${clr} ${(i / arr.length) * 100}% ${((i + 1) / arr.length) * 100}%`).join(", ");
            const swatches = (info.colors || []).slice(0, 3).map((clr) =>
              `<span aria-hidden="true" style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${esc(clr)};border:1px solid rgba(0,0,0,.15)"></span>`
            ).join("");
            return `
            <section class="p-card"${active ? ' style="border-color:var(--p-accent);box-shadow:0 0 0 3px var(--p-accent-wash)"' : ""}>
              <div style="display:flex;gap:.9rem;align-items:flex-start">
                <img src="templates/${esc(t.id)}/cover.jpg" alt="${esc(t.name)}" loading="lazy" width="72" height="90" style="width:72px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#1a1210">
                <div style="flex:1;min-width:0">
                  <div aria-hidden="true" style="height:8px;border-radius:999px;background:linear-gradient(90deg, ${stops});margin-bottom:.4rem"></div>
                  <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                    <h3 class="p-card__title" style="margin:0">${esc(t.name)} ${active ? window.PanelUI.badge("Aktif", "ok") : ""}</h3>
                    <span style="display:inline-flex;gap:4px;margin-left:auto">${swatches}</span>
                  </div>
                  <p class="p-card__desc" style="margin-top:.3rem">${esc(info.desc || "")}</p>
                </div>
              </div>
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
      window.PanelStore.set("templateId", id);
      window.PanelStore.set("template", id);
      const { error } = await window.PanelStore.save(["templateId", "template"]);
      if (error) { toast("Gagal menyimpan template: " + error.message, true); return; }
      activeId = id;
      if (window.PanelStore.loadManifest) {
        await window.PanelStore.loadManifest(id);
        if (window.PanelRouter && window.PanelRouter.registerChapters) {
          window.PanelRouter.registerChapters(window.PanelStore.getManifest());
        }
      }
      toast("Template diterapkan. Setelan tampilan setiap template terpisah; data undangan tetap terbawa.");
      render();
    }
    function preview(id) {
      window.open(`${window.AdminAPI.tenant.path()}?template=${id}`, "_blank", "noopener");
    }

    render();
  },
  destroy() {}
};
