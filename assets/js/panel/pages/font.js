/** Font — tipografi PER ELEMEN, site_content.typography.elements. Default di
 * bawah adalah gaya asli style.css sebelum fitur ini ada. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["font"] = {
  title: "Font",
  group: "Tampilan",
  icon: window.PanelUI.icon("type"),
  async mount(outlet) {
    const { esc, escAttr, card } = window.PanelUI;
    const FONTS = ["Beau Rivage", "Great Vibes", "Allura", "Parisienne", "Sacramento", "Dancing Script", "Cormorant Garamond", "Playfair Display", "DM Serif Display", "Lora", "Libre Baskerville", "Poppins", "Montserrat", "Open Sans", "Alegreya Sans"];
    const SECTIONS = [
      { id: "cover", label: "Cover", elements: [
        ["cover-eyebrow", "Tulisan 'The Wedding Of'", ".cover-eyebrow", "THE WEDDING OF", { family: "Alegreya Sans", size: 13, weight: 500 }],
        ["cover-names", "Nama mempelai", ".cover-names, #couple-names-cover", "Mita & Andi", { family: "Beau Rivage", size: 50, weight: 400 }],
        ["cover-guest", "Sapaan & nama tamu", ".guest-label, .guest-name", "Kepada Yth. Nadia Pratama", { family: "Poppins", size: 16, weight: 500 }],
        ["cover-button", "Tombol buka undangan", ".btn-open", "BUKA UNDANGAN", { family: "Poppins", size: 14, weight: 500 }]
      ] },
      { id: "opening", label: "Save the Date & Pembuka", elements: [
        ["opening-eyebrow", "Eyebrow Save the Date", "#opening .eyebrow", "SAVE THE DATE", { family: "Alegreya Sans", size: 13, weight: 500 }],
        ["opening-names", "Nama mempelai", "#couple-names-opening", "Mita & Andi", { family: "Beau Rivage", size: 50, weight: 400 }],
        ["opening-date", "Tanggal acara", ".save-date, .cover-countdown__date", "MINGGU, 25 AGUSTUS 2026", { family: "Poppins", size: 16, weight: 500 }],
        ["opening-quote", "Quote pembuka", ".opening-quote", "Dan di antara tanda-tanda-Nya...", { family: "Poppins", size: 20, weight: 400 }]
      ] },
      { id: "couple", label: "Mempelai", elements: [
        ["couple-eyebrow", "Eyebrow section", "#couple .section-eyebrow", "THE COUPLE", { family: "Alegreya Sans", size: 13, weight: 500 }],
        ["couple-title", "Judul section", "#couple .section-title--script", "Mempelai", { family: "Beau Rivage", size: 40, weight: 400 }],
        ["couple-name", "Nama mempelai di kartu", ".couple-info__name", "Mita Pratama", { family: "Beau Rivage", size: 42, weight: 400 }],
        ["couple-label", "Label & keterangan keluarga", ".couple-info__label, .couple-info__parents", "PUTRI DARI BPK. & IBU", { family: "Alegreya Sans", size: 13, weight: 500 }]
      ] },
      { id: "event", label: "Acara & Dresscode", elements: [
        ["event-eyebrow", "Eyebrow section", "#event .section-eyebrow", "WEDDING EVENT", { family: "Alegreya Sans", size: 13, weight: 500 }],
        ["event-title", "Judul section", "#event .section-title", "Rangkaian Acara", { family: "Poppins", size: 30, weight: 500 }],
        ["event-label", "Label Akad / Resepsi", ".event-label", "AKAD NIKAH", { family: "Alegreya Sans", size: 20, weight: 500 }],
        ["event-date", "Angka & detail tanggal", ".event-num, .event-day, .event-month, .event-year, .event-time", "25 AGUSTUS 2026", { family: "Beau Rivage", size: 38, weight: 400 }],
        ["event-venue", "Nama & alamat venue", ".event-place h3, .event-place p", "Gedung Bahagia", { family: "Poppins", size: 16, weight: 500 }],
        ["dresscode", "Dresscode", ".dresscode-label, .dresscode-text", "DRESSCODE · KREM", { family: "Alegreya Sans", size: 16, weight: 500 }]
      ] },
      { id: "story", label: "Cerita, Galeri & Quote", elements: [
        ["story-title", "Judul Our Story", "#love-story .section-title--script", "Perjalanan Kami", { family: "Beau Rivage", size: 40, weight: 400 }],
        ["story-content", "Judul & isi cerita", ".timeline-item h4, .timeline-item p", "Awal perjalanan kami", { family: "Poppins", size: 16, weight: 400 }],
        ["gallery-title", "Judul Galeri", "#gallery .section-title--script", "Galeri Foto", { family: "Beau Rivage", size: 40, weight: 400 }],
        ["quote", "Quote foto", ".quote-text", "Cinta adalah perjalanan yang indah.", { family: "Poppins", size: 20, weight: 400 }]
      ] },
      { id: "gift", label: "Gift & RSVP", elements: [
        ["gift-title", "Judul Gift", "#gift .section-title", "Tanda Kasih", { family: "Poppins", size: 30, weight: 500 }],
        ["gift-content", "Rekening & rekomendasi kado", ".gift-account__bank, .gift-account__number, .gift-rec-card__name, .gift-rec-card__price", "Wedding Gift", { family: "Poppins", size: 16, weight: 500 }],
        ["gift-button", "Tombol Gift", "#gift .btn-primary, #gift .btn-outline, #gift .btn-text", "KIRIM HADIAH", { family: "Poppins", size: 14, weight: 500 }],
        ["rsvp-title", "Judul RSVP", "#rsvp .section-title", "Doa & Ucapan", { family: "Poppins", size: 30, weight: 500 }],
        ["rsvp-form", "Label, input & tombol RSVP", ".rsvp-form label, .rsvp-form input, .rsvp-form select, .rsvp-form textarea, .rsvp-pill, #rsvp-submit", "Kirim Konfirmasi", { family: "Poppins", size: 14, weight: 500 }],
        ["wishes", "Daftar ucapan", ".wishes-heading p, .wishes-intro, .wish-card__name, .wish-card__status, .wish-card__message", "Nadia Pratama · Semoga bahagia", { family: "Poppins", size: 14, weight: 400 }]
      ] },
      { id: "closing", label: "Closing & Footer", elements: [
        ["closing-text", "Teks penutup", ".closing-text, footer", "Terima kasih atas doa dan kehadirannya.", { family: "Poppins", size: 16, weight: 400 }],
        ["closing-names", "Nama mempelai", "#couple-names-closing", "Mita & Andi", { family: "Beau Rivage", size: 40, weight: 400 }]
      ] }
    ];

    const liveContent = window.PanelStore.getContent();
    const elements = window.PanelStore.get("typography.elements", {});
    let activeSection = SECTIONS[0].id;

    const get = (path, fallback = "") => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), liveContent) ?? fallback;
    function previewText(id, fallback) {
      const bride = get("couple.bride.nickname", get("couple.bride.name", "Mita"));
      const groom = get("couple.groom.nickname", get("couple.groom.name", "Andi"));
      const map = {
        "cover-names": `${bride} & ${groom}`, "opening-names": `${bride} & ${groom}`, "closing-names": `${bride} & ${groom}`,
        "cover-guest": `Kepada Yth. ${get("defaultGuestName", "Bapak/Ibu/Saudara/i")}`,
        "opening-date": get("event.dateLabel"), "opening-quote": get("opening.quote"),
        "couple-name": get("couple.bride.name"), "couple-label": `Putri dari Bpk. ${get("couple.bride.father", "")} & Ibu ${get("couple.bride.mother", "")}`,
        "event-label": get("event.akad.label"), "event-date": `${get("event.dayLabel", "")} · ${get("event.dateLabel", "")}`,
        "event-venue": get("event.akad.venue.name"), "dresscode": get("dresscode.text"),
        "story-content": get("loveStory.0.title", ""), "quote": get("quotePhoto.quote"),
        "gift-content": fallback, "wishes": fallback, "closing-text": get("closing.text", fallback)
      };
      return String(map[id] || fallback || "").trim();
    }
    const findEl = (id) => SECTIONS.flatMap((s) => s.elements).find((e) => e[0] === id);
    const config = (id) => ({ ...(findEl(id)?.[4] || {}), ...(elements[id] || {}) });
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
        section.elements.map(([id, label, selector, sample]) => {
          const v = config(id);
          return card(label, `Target: <code>${esc(selector)}</code>`, `
            <div class="p-field" data-font-preview="${id}" style="${styleOf(v)};padding:.75rem;border:1px solid var(--p-line);border-radius:var(--p-r-md);background:var(--p-canvas)">${esc(previewText(id, sample))}</div>
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
      window.PanelStore.set("typography.elements", elements);
      const { error } = await window.PanelStore.save(["typography"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan font: " + error.message, true); return false; }
      window.AdminAPI.toast("Font disimpan.");
      return true;
    }
  },
  destroy() {}
};
