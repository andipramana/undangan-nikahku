/** Font — tipografi per elemen untuk template yang sedang aktif.
 *
 * Seperti halaman Warna, halaman ini TIDAK tahu satu pun nama kelas milik
 * template. Daftar elemen yang bisa disetel dibaca dari
 * templates/<id>/template.json:
 *
 *   editor.typography: [
 *     { id, label, elements: [ { key, label, selector, sample, family, size, weight } ] }
 *   ]
 *
 * `key` yang disimpan (di content.templates[<id>].typography.elements), bukan
 * selector-nya — sisi tamu memasangkannya kembali lewat
 * WeddingEngine.applyTypographyOverrides memakai peta dari manifest yang sama.
 * Itulah yang membuat tab ini berlaku untuk template mana pun, termasuk yang
 * tidak memuat assets/js/theme.js.
 *
 * Hanya elemen yang benar-benar disetel client yang tersimpan; "Reset elemen"
 * menghapus entrinya, sehingga gaya bawaan template kembali berlaku.
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["font"] = {
  title: "Font",
  group: "Tampilan",
  icon: window.PanelUI.icon("type"),
  async mount(outlet) {
    const { esc, escAttr, card } = window.PanelUI;
    const FONTS = ["Beau Rivage", "Great Vibes", "Allura", "Parisienne", "Sacramento", "Dancing Script", "Cormorant Garamond", "Playfair Display", "DM Serif Display", "Bodoni Moda", "Bricolage Grotesque", "Newsreader", "Lora", "Libre Baskerville", "Poppins", "Montserrat", "Mulish", "Karla", "Open Sans", "Alegreya Sans"];

    const manifest = await window.PanelStore.activeManifest();
    const SECTIONS = ((manifest.editor || {}).typography) || [];

    if (!SECTIONS.length) {
      outlet.innerHTML = card("Font", "",
        `<p class="p-muted">Template <strong>${esc(manifest.name || manifest.id || "ini")}</strong> tidak menyediakan setelan font. Tipografinya sudah ditetapkan oleh desain template.</p>`);
      return;
    }

    const liveContent = window.PanelStore.getContent();
    const elements = window.PanelStore.tplGet("typography.elements", {});
    let activeSection = SECTIONS[0].id;

    const get = (path, fallback = "") => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), liveContent) ?? fallback;
    /** Contoh teks memakai data undangan yang sebenarnya, supaya client menilai
     * font pada kalimatnya sendiri — bukan pada "Lorem ipsum". Token di
     * manifest ({bride}, {tanggal}, …) diganti di sini; teks tanpa token
     * dipakai apa adanya. */
    const TOKENS = () => ({
      "{bride}": get("couple.bride.nickname", get("couple.bride.name", "Mita")),
      "{groom}": get("couple.groom.nickname", get("couple.groom.name", "Andi")),
      "{bridefull}": get("couple.bride.name", "Mita Pratama"),
      "{ayah}": get("couple.bride.father", "Budi"),
      "{ibu}": get("couple.bride.mother", "Sri"),
      "{tamu}": get("defaultGuestName", "Bapak/Ibu/Saudara/i"),
      "{tanggal}": get("event.dateLabel", "25 Agustus 2026"),
      "{hari}": get("event.dayLabel", "Minggu"),
      "{akad}": get("event.akad.label", "Akad Nikah"),
      "{venue}": get("event.akad.venue.name", "Gedung Bahagia"),
      "{quote}": get("opening.quote", "Dan di antara tanda-tanda kekuasaan-Nya…"),
      "{quotefoto}": get("quotePhoto.quote", "Cinta adalah perjalanan yang indah."),
      "{cerita}": get("loveStory.0.title", "Awal perjalanan kami"),
      "{dresscode}": get("dresscode.text", "Earth tone"),
      "{closing}": get("closing.text", "Terima kasih atas doa dan kehadirannya.")
    });
    function previewText(sample) {
      const tokens = TOKENS();
      return String(sample || "").replace(/\{[a-z]+\}/g, (t) => tokens[t] ?? t).trim();
    }
    const findEl = (key) => SECTIONS.flatMap((g) => g.elements).find((e) => e.key === key);
    const config = (key) => {
      const spec = findEl(key) || {};
      return { family: spec.family, size: spec.size, weight: spec.weight, ...(elements[key] || {}) };
    };
    const fontOptions = (value) => `<option value="">— pilih font —</option>${FONTS.map((f) => `<option value="${esc(f)}" ${f === value ? "selected" : ""}>${esc(f)}</option>`).join("")}`;
    const styleOf = (v) => `font-family:'${esc(v.family)}',sans-serif;font-size:${Number(v.size) || 16}px;font-weight:${Number(v.weight) || 400};${v.color ? `color:${esc(v.color)}` : ""}`;
    function loadFont(name) {
      const n = String(name || "").trim(); if (!n) return;
      const id = "panel-font-" + encodeURIComponent(n).replace(/%/g, "");
      if (document.getElementById(id)) return;
      const link = document.createElement("link"); link.id = id; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@300;400;500;600;700&display=swap";
      document.head.appendChild(link);
    }

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }

    function render() {
      Object.keys(elements).forEach((id) => loadFont(config(id).family));
      const section = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];
      outlet.innerHTML =
        `<p class="p-hint">Default di bawah adalah gaya asli website sebelum fitur Font. Pilih section lalu atur setiap tulisan secara terpisah. Reset elemen mengembalikan elemen itu ke CSS awal.</p>` +
        `<div class="p-toolbar">
          <label class="p-field" style="flex-direction:row;align-items:center;gap:.5rem"><span>Section</span><select class="p-select" id="fn-section">${SECTIONS.map((s) => `<option value="${s.id}" ${s.id === section.id ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></label>
          <button class="p-btn p-btn--ghost" type="button" id="fn-reset-all">Reset semua ke default awal</button>
        </div>` +
        `<div style="display:grid;gap:1rem">` +
        section.elements.map((spec) => {
          const id = spec.key;
          const v = config(id);
          return card(spec.label, "", `
            <div class="p-field" data-font-preview="${id}" style="${styleOf(v)};padding:.75rem;border:1px solid var(--p-line);border-radius:var(--p-r-md);background:var(--p-canvas)">${esc(previewText(spec.sample))}</div>
            <label class="p-field"><span>Font pilihan</span><select class="p-select" data-font-select="${id}">${fontOptions(v.family)}</select></label>
            <label class="p-field"><span>Nama font custom</span><input class="p-input" data-font-family="${id}" value="${escAttr(v.family)}" placeholder="Contoh: Cormorant Garamond"></label>
            <div class="p-grid-2">
              <label class="p-field"><span>Ukuran (px)</span><input class="p-input" type="number" min="8" max="120" data-font-size="${id}" value="${v.size}"></label>
              <label class="p-field"><span>Ketebalan</span><select class="p-select" data-font-weight="${id}">${[300, 400, 500, 600, 700].map((w) => `<option value="${w}" ${Number(v.weight) === w ? "selected" : ""}>${w}</option>`).join("")}</select></label>
            </div>
            <label class="p-field"><span>Warna (opsional)</span><input class="p-input" data-font-color="${id}" value="${escAttr(v.color || "")}" placeholder="Warna awal CSS"></label>
            <button class="p-btn p-btn--tiny p-btn--ghost" type="button" data-font-reset="${id}">Reset elemen</button>
          `);
        }).join("") +
        `</div>`;

      outlet.querySelector("#fn-section").addEventListener("change", (e) => { activeSection = e.target.value; render(); });
      outlet.querySelector("#fn-reset-all").addEventListener("click", () => { Object.keys(elements).forEach((k) => delete elements[k]); markDirty(); render(); });
      outlet.querySelectorAll("[data-font-reset]").forEach((b) => b.addEventListener("click", () => { delete elements[b.dataset.fontReset]; markDirty(); render(); }));
      outlet.querySelectorAll("[data-font-select],[data-font-family],[data-font-size],[data-font-weight],[data-font-color]").forEach((el) => {
        el.addEventListener("input", () => {
          const id = el.dataset.fontSelect || el.dataset.fontFamily || el.dataset.fontSize || el.dataset.fontWeight || el.dataset.fontColor;
          const prop = (el.dataset.fontSelect || el.dataset.fontFamily) ? "family" : el.dataset.fontSize ? "size" : el.dataset.fontWeight ? "weight" : "color";
          elements[id] = { ...config(id), [prop]: el.value };
          if (prop === "family") loadFont(el.value);
          markDirty();
          const p = outlet.querySelector(`[data-font-preview="${id}"]`);
          if (p) p.style.cssText = styleOf(config(id)) + ";padding:.75rem;border:1px solid var(--p-line);border-radius:var(--p-r-md);background:var(--p-canvas)";
        });
      });
    }
    render();

    async function onSave() {
      window.PanelStore.tplSet("typography.elements", elements);
      const { error } = await window.PanelStore.saveTpl();
      if (error) { window.AdminAPI.toast("Gagal menyimpan font: " + error.message, true); return false; }
      window.AdminAPI.toast("Font disimpan.");
      return true;
    }
  },
  destroy() {}
};
