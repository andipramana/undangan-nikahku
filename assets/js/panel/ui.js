/**
 * Helper komponen dipakai lintas halaman panel: escaping, builder HTML untuk
 * field/textarea/select/switch/card, dan pola sinkron color-picker+hex yang
 * dipakai berulang (dresscode, tema, dst — sama seperti admin lama, hanya
 * dikumpulkan satu tempat supaya tidak diketik ulang 19 kali).
 */
(function () {
  function esc(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escAttr(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function field(label, id, opts = {}) {
    const type = opts.type || "text";
    const extra = opts.extra || "";
    return `<label class="p-field"><span>${esc(label)}</span><input class="p-input" type="${type}" id="${escAttr(id)}" ${extra}></label>`;
  }
  function textarea(label, id, opts = {}) {
    const rows = opts.rows || 3;
    return `<label class="p-field"><span>${esc(label)}</span><textarea class="p-textarea" id="${escAttr(id)}" rows="${rows}" placeholder="${escAttr(opts.placeholder || "")}"></textarea></label>`;
  }
  function select(label, id, options, opts = {}) {
    const optsHtml = options.map(([value, text]) => `<option value="${escAttr(value)}">${esc(text)}</option>`).join("");
    return `<label class="p-field"><span>${esc(label)}</span><select class="p-select" id="${escAttr(id)}">${optsHtml}</select></label>`;
  }
  function switchRow(label, id, opts = {}) {
    return `<label class="p-switch"><input type="checkbox" id="${escAttr(id)}"><span>${esc(label)}</span></label>${opts.hint ? `<p class="p-hint">${esc(opts.hint)}</p>` : ""}`;
  }
  function card(title, desc, bodyHtml, opts = {}) {
    return `<section class="p-card"${opts.id ? ` id="${escAttr(opts.id)}"` : ""}>` +
      `<h2 class="p-card__title">${esc(title)}</h2>` +
      (desc ? `<p class="p-card__desc">${esc(desc)}</p>` : "") +
      bodyHtml +
      `</section>`;
  }
  function badge(text, variant) {
    return `<span class="p-badge p-badge--${variant || "info"}">${esc(text)}</span>`;
  }

  /** <input type="color"> hanya menerima #rrggbb — bentuk singkat (#fff)
   * dipanjangkan dulu. Nilai yang DISIMPAN tetap apa adanya. */
  function pickerHex(value) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
    if (!m) return "#000000";
    const h = m[1];
    return ("#" + (h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h)).toLowerCase();
  }

  /** Pasang sinkron dua arah picker warna + kotak hex di dalam `root` untuk
   * satu baris [data-color-i="key"]/[data-color-hex="key"]. onChange(val)
   * dipanggil dengan hex sah setiap kali nilainya berubah (dan HANYA saat
   * sah — nilai setengah jadi seperti "#c9a6" tidak pernah dikirim). */
  function bindColorPair(root, key, onChange) {
    const picker = root.querySelector(`[data-color-i="${key}"]`);
    const hexInput = root.querySelector(`[data-color-hex="${key}"]`);
    if (picker) {
      // Beberapa browser mobile tidak menyinkronkan atribut HTML `value` dengan
      // state internal popup color-picker native. Paksa assign ulang.
      picker.value = "";
      picker.value = picker.getAttribute("value");
      picker.addEventListener("input", () => {
        onChange(picker.value);
        if (hexInput) { hexInput.value = picker.value; hexInput.classList.remove("is-invalid"); }
      });
    }
    if (hexInput) {
      hexInput.addEventListener("input", () => {
        let val = hexInput.value.trim();
        if (val && !val.startsWith("#")) val = "#" + val;
        const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val);
        hexInput.classList.toggle("is-invalid", !ok);
        if (!ok) return;
        onChange(val);
        if (picker) picker.value = pickerHex(val);
      });
      hexInput.addEventListener("blur", () => {
        hexInput.classList.remove("is-invalid");
      });
    }
  }

  function toast(msg, isError) {
    window.AdminAPI.toast(msg, isError);
  }

  /** Buka .p-modal dengan aksesibilitas minimum wajib (§8 rencana): fokus
   * pindah ke elemen pertama di dalam modal, Tab/Shift+Tab terperangkap di
   * dalamnya, Esc menutup. Pakai ini (bukan `el.hidden = false` langsung)
   * untuk setiap modal baru. */
  function openModal(el) {
    if (!el) return;
    const trigger = document.activeElement;
    el.hidden = false;
    const focusable = () => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((x) => !x.disabled && x.offsetParent !== null);
    const first = focusable()[0];
    if (first) first.focus();
    function onKeydown(e) {
      if (e.key === "Escape") { e.stopPropagation(); closeModal(el); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    el.__panelModalKeydown = onKeydown;
    el.__panelModalTrigger = trigger;
    el.addEventListener("keydown", onKeydown);
  }
  function closeModal(el) {
    if (!el) return;
    el.hidden = true;
    if (el.__panelModalKeydown) { el.removeEventListener("keydown", el.__panelModalKeydown); el.__panelModalKeydown = null; }
    if (el.__panelModalTrigger && typeof el.__panelModalTrigger.focus === "function") el.__panelModalTrigger.focus();
    el.__panelModalTrigger = null;
  }

  /** Ikon garis minimal, inline SVG — dipakai kartu navigasi & sidebar.
   * BUKAN emoji (dilarang §2.1 rencana). Satu set kecil dipakai ulang antar
   * halaman yang temanya berdekatan (mis. "image" untuk semua section
   * berbasis foto) — bukan berarti setiap halaman butuh bentuk unik. */
  const ICONS = {
    home: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-4 4-2-2-5 5"/>',
    heart: '<path d="M12 20s-7-4.35-9.5-8.8C.7 7.6 2.4 4 6 4c2 0 3.5 1.2 4 2.4C10.5 5.2 12 4 14 4c3.6 0 5.3 3.6 3.5 7.2C19 15.65 12 20 12 20z"/>',
    quote: '<path d="M7 10c0-2.2 1.8-4 4-4M5 10v4a2 2 0 0 0 2 2M13 10c0-2.2 1.8-4 4-4M11 10v4a2 2 0 0 0 2 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    story: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 9h18M12 9v12M12 9c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 0z"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
    flag: '<path d="M5 3v18M5 4h11l-2 3 2 3H5"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M17 14c2.8.4 5 2.5 5 5"/>',
    message: '<path d="M4 5h16v11H8l-4 4V5z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7M14 20h3"/>',
    template: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10.5" r="1.2"/><circle cx="12" cy="8" r="1.2"/><circle cx="15.5" cy="10.5" r="1.2"/><path d="M12 21a3 3 0 0 1 0-6h5a3 3 0 0 0 0-6"/>',
    type: '<path d="M5 6h14M12 6v14M9 20h6"/>',
    wand: '<path d="M4 20l10-10M14 4l1.5 1.5M18 8l1.5 1.5M11 4l1 2-2 1M17 10l1 2-2 1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.9 7.9 0 0 0-1.7-1L15 3h-6l-.3 2.5a7.9 7.9 0 0 0-1.7 1l-2.4-1-2 3.5L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.9 7.9 0 0 0 1.7 1L9 21h6l.3-2.5a7.9 7.9 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5z"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 9 18l-5 2z"/><path d="M8.5 9.5c0 3 2.5 5.5 5.5 5.5"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    contacts: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.5-2 2-3 4-3s3.5 1 4 3"/><path d="M4 8h1M4 13h1"/>'
  };
  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.home}</svg>`;
  }

  window.PanelUI = { esc, escAttr, field, textarea, select, switchRow, card, badge, pickerHex, bindColorPair, toast, icon, openModal, closeModal };
})();
