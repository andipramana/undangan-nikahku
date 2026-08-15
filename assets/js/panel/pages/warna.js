/** Warna — tema situs TAMU (style.css): 7 warna solid + 4 layer overlay.
 * Panel admin sendiri tidak terpengaruh (panel.css tetap). Rumus preview HARUS
 * sama persis dengan assets/js/theme.js sisi tamu (applyTheme) — kalau beda,
 * preview di sini bohong. Kalau template kustom aktif, warna ini tidak
 * berlaku (main.js sengaja skip applyTheme — lihat memori proyek). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["warna"] = {
  title: "Warna",
  group: "Tampilan",
  icon: window.PanelUI.icon("palette"),
  async mount(outlet) {
    const { esc, escAttr, pickerHex, bindColorPair, card } = window.PanelUI;
    const { sb, photoUrl, tenant, query } = window.AdminAPI;

    const DEFAULT_THEME = {
      colors: { bg: "#f7f3ea", dark: "#14120f", dark2: "#1c1914", gold: "#c9a668", goldSoft: "#e6d7b3", text: "#2b2620", textLight: "#f7f3ea" },
      overlays: {
        global: { enabled: true, color: "#c9a668", opacity: 0.4 },
        flat: { enabled: true, color: "#0a0907", opacity: 0.22 },
        closing: { enabled: true, color: "#0a0907", opacity: 0.78 },
        quote: { enabled: true, color: "#30200d", opacity: 0.55 }
      }
    };
    const COLOR_LABELS = { bg: "Latar halaman", dark: "Latar gelap", dark2: "Latar gelap (tua)", gold: "Emas", goldSoft: "Emas lembut", text: "Warna teks", textLight: "Teks terang" };
    const OVERLAY_LABELS = { global: "Golden hour global", flat: "Cover & pembuka", closing: "Closing & footer", quote: "Foto quote" };
    const THEME_PRESETS = [
      { id: "golden-hour", label: "Golden Hour (default)", colors: DEFAULT_THEME.colors, overlayColors: { global: "#c9a668", flat: "#0a0907", closing: "#0a0907", quote: "#30200d" } },
      { id: "mocha-bloom", label: "Mocha & Bloom", colors: { bg: "#f6f0e6", dark: "#241811", dark2: "#1a1109", gold: "#8a5f3c", goldSoft: "#c9a97e", text: "#2a2018", textLight: "#f6f0e6" }, overlayColors: { global: "#8a5f3c", flat: "#1a1109", closing: "#1a1109", quote: "#241811" } },
      { id: "burgundy-wine", label: "Burgundy Wine", colors: { bg: "#f6f0e6", dark: "#241811", dark2: "#1a1109", gold: "#7a2b30", goldSoft: "#b06a63", text: "#2a2018", textLight: "#f6f0e6" }, overlayColors: { global: "#7a2b30", flat: "#1a1109", closing: "#1a1109", quote: "#2e1416" } },
      { id: "emerald-luxe", label: "Emerald Luxe", colors: { bg: "#f5f1e6", dark: "#0f1a14", dark2: "#16241c", gold: "#b8935a", goldSoft: "#d9c396", text: "#1c231d", textLight: "#f5f1e6" }, overlayColors: { global: "#b8935a", flat: "#0f1a14", closing: "#0f1a14", quote: "#16241c" } },
      { id: "rose-blush", label: "Rose Blush", colors: { bg: "#faf3f0", dark: "#241615", dark2: "#2e1c1a", gold: "#c98a7a", goldSoft: "#e8c4b8", text: "#2c1c1a", textLight: "#faf3f0" }, overlayColors: { global: "#c98a7a", flat: "#241615", closing: "#241615", quote: "#2e1c1a" } },
      { id: "navy-gold", label: "Navy & Gold", colors: { bg: "#f4f2ec", dark: "#0d1420", dark2: "#131c2c", gold: "#c9a668", goldSoft: "#e6d7b3", text: "#1a1f28", textLight: "#f4f2ec" }, overlayColors: { global: "#c9a668", flat: "#0d1420", closing: "#0d1420", quote: "#131c2c" } },
      { id: "sage-cream", label: "Sage & Cream", colors: { bg: "#f7f5ee", dark: "#232922", dark2: "#2c332a", gold: "#a8b48a", goldSoft: "#cdd6b8", text: "#262b22", textLight: "#f7f5ee" }, overlayColors: { global: "#a8b48a", flat: "#232922", closing: "#232922", quote: "#2c332a" } },
      { id: "terracotta-sunset", label: "Terracotta Sunset", colors: { bg: "#f8f0e6", dark: "#2a1810", dark2: "#351f15", gold: "#c76f4e", goldSoft: "#e0a888", text: "#2c1a12", textLight: "#f8f0e6" }, overlayColors: { global: "#c76f4e", flat: "#2a1810", closing: "#2a1810", quote: "#351f15" } },
      { id: "lavender-dusk", label: "Lavender Dusk", colors: { bg: "#f6f2f6", dark: "#221a29", dark2: "#2c2233", gold: "#9b7fb0", goldSoft: "#cbb8db", text: "#241c29", textLight: "#f6f2f6" }, overlayColors: { global: "#9b7fb0", flat: "#221a29", closing: "#221a29", quote: "#2c2233" } },
      { id: "noir-gold", label: "Classic Noir & Gold", colors: { bg: "#f5f5f0", dark: "#0a0a0a", dark2: "#161616", gold: "#d4af37", goldSoft: "#e8d38a", text: "#1a1a1a", textLight: "#f5f5f0" }, overlayColors: { global: "#d4af37", flat: "#0a0a0a", closing: "#0a0a0a", quote: "#161616" } },
      { id: "ocean-teal", label: "Ocean Teal", colors: { bg: "#f2f6f5", dark: "#0e2624", dark2: "#163330", gold: "#4d8f85", goldSoft: "#9dc9c1", text: "#17241f", textLight: "#f2f6f5" }, overlayColors: { global: "#4d8f85", flat: "#0e2624", closing: "#0e2624", quote: "#163330" } },
      { id: "champagne-blush", label: "Champagne Blush", colors: { bg: "#faf4ee", dark: "#2b1e1a", dark2: "#362521", gold: "#d1a78e", goldSoft: "#ecd3c1", text: "#2c1f1a", textLight: "#faf4ee" }, overlayColors: { global: "#d1a78e", flat: "#2b1e1a", closing: "#2b1e1a", quote: "#362521" } }
    ];

    function hexRgb(hex) {
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
      if (!m) return null;
      const h = m[1].length === 3 ? m[1].split("").map((ch) => ch + ch).join("") : m[1];
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
    }
    function overlayOpacity(layer, fallback) {
      const o = typeof layer.opacity === "number" && isFinite(layer.opacity) ? layer.opacity : fallback;
      return Math.min(1, Math.max(0, o));
    }
    function overlayStyle(theme, k) {
      const layer = theme.overlays[k];
      if (!layer || layer.enabled === false) return { background: "", opacity: "0" };
      const rgb = hexRgb(layer.color);
      if (!rgb) return { background: "", opacity: "" };
      if (k === "global") return { background: layer.color, opacity: String(overlayOpacity(layer, 0.4)) };
      if (k === "flat") return { background: `rgba(${rgb},${overlayOpacity(layer, 0.22)})`, opacity: "" };
      if (k === "closing") {
        const o = overlayOpacity(layer, 0.78);
        return { background: `linear-gradient(180deg, rgba(${rgb},${0.7 * (o / 0.78)}) 0%, rgba(${rgb},${0.78 * (o / 0.78)}) 50%, rgba(${rgb},${0.88 * (o / 0.78)}) 100%)`, opacity: "" };
      }
      if (k === "quote") {
        const [r, g, b] = rgb.split(",");
        const o = overlayOpacity(layer, 0.55);
        return { background: `linear-gradient(180deg, rgba(${rgb},${o}) 0%, rgba(${Math.round(r * .4)},${Math.round(g * .4)},${Math.round(b * .4)},${0.62 * (o / 0.55)}) 100%)`, opacity: "" };
      }
      return { background: "", opacity: "" };
    }
    function mergeTheme(saved) {
      const cur = { colors: {}, overlays: {} };
      Object.keys(DEFAULT_THEME.colors).forEach((k) => { cur.colors[k] = String((saved.colors && saved.colors[k]) || DEFAULT_THEME.colors[k]); });
      Object.keys(DEFAULT_THEME.overlays).forEach((k) => {
        const s = (saved.overlays && saved.overlays[k]) || {};
        cur.overlays[k] = { enabled: s.enabled !== false, color: String(s.color || DEFAULT_THEME.overlays[k].color), opacity: overlayOpacity(s, DEFAULT_THEME.overlays[k].opacity) };
      });
      return cur;
    }
    function matchingPresetId(theme) {
      const wantColors = Object.keys(DEFAULT_THEME.colors).map((k) => [k, String(theme.colors[k]).toLowerCase()]);
      const wantOverlays = Object.keys(DEFAULT_THEME.overlays).map((k) => [k, String(theme.overlays[k].color).toLowerCase()]);
      for (const p of THEME_PRESETS) {
        if (wantColors.every(([k, v]) => String(p.colors[k]).toLowerCase() === v) && wantOverlays.every(([k, v]) => String(p.overlayColors[k]).toLowerCase() === v)) return p.id;
      }
      return "";
    }
    async function fetchPreviewPhoto() {
      const queries = [
        sb.from("photos").select("storage_path").eq("invitation_id", tenant.invitationId).eq("folder", "cover").order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(1),
        sb.from("photos").select("storage_path").eq("invitation_id", tenant.invitationId).order("id", { ascending: true }).limit(1)
      ];
      for (const q of queries) {
        const { data, error } = await query(q, "Permintaan foto preview");
        if (!error && data && data[0]) return data[0].storage_path;
      }
      return null;
    }

    const theme = mergeTheme(window.PanelStore.get("theme", {}));
    let previewPhotoUrl = "";
    const path = await fetchPreviewPhoto();
    if (path) previewPhotoUrl = photoUrl(path);

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    function updatePreview(k) {
      const box = outlet.querySelector(`[data-preview-overlay="${k}"]`);
      if (!box) return;
      const s = overlayStyle(theme, k);
      box.style.background = s.background;
      box.style.opacity = s.opacity;
    }

    function render() {
      const colorRows = Object.keys(DEFAULT_THEME.colors).map((k) => `
        <div class="p-field">
          <span>${COLOR_LABELS[k]}</span>
          <div class="p-color-row">
            <input type="color" value="${pickerHex(theme.colors[k])}" data-color-i="c${k}" aria-label="${COLOR_LABELS[k]}">
            <input type="text" class="p-input" data-color-hex="c${k}" value="${escAttr(theme.colors[k])}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="#c9a668">
            <button type="button" class="p-btn p-btn--tiny" data-reset-color="${k}" title="Reset ${COLOR_LABELS[k]}" aria-label="Reset ${COLOR_LABELS[k]}">&#8634;</button>
          </div>
        </div>`).join("");

      const overlayRows = Object.keys(DEFAULT_THEME.overlays).map((k) => {
        const s = overlayStyle(theme, k);
        return `
        <div class="p-card" style="gap:.75rem">
          <div style="position:relative;aspect-ratio:16/9;border-radius:var(--p-r-md);overflow:hidden;border:1px solid var(--p-line);background:var(--p-sunken)">
            ${previewPhotoUrl ? `<img src="${escAttr(previewPhotoUrl)}" alt="Preview ${OVERLAY_LABELS[k]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ""}
            <div data-preview-overlay="${k}" style="position:absolute;inset:0;background:${s.background};opacity:${s.opacity}"></div>
          </div>
          <label class="p-switch"><input type="checkbox" data-overlay-enabled="${k}" ${theme.overlays[k].enabled ? "checked" : ""}><span>${OVERLAY_LABELS[k]}</span></label>
          <div class="p-color-row">
            <input type="color" value="${pickerHex(theme.overlays[k].color)}" data-color-i="o${k}" aria-label="Warna ${OVERLAY_LABELS[k]}">
            <input type="text" class="p-input" data-color-hex="o${k}" value="${escAttr(theme.overlays[k].color)}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off">
            <button type="button" class="p-btn p-btn--tiny" data-reset-overlay="${k}" title="Reset ${OVERLAY_LABELS[k]}" aria-label="Reset ${OVERLAY_LABELS[k]}">&#8634;</button>
          </div>
          <label class="p-field"><span>Kepekatan</span><input type="range" min="0" max="100" step="1" value="${Math.round(theme.overlays[k].opacity * 100)}" data-overlay-opacity="${k}"></label>
        </div>`;
      }).join("");

      const matchingId = matchingPresetId(theme);
      outlet.innerHTML =
        card("Tema siap pakai", "Hanya mengubah warna (7 solid + 4 overlay); status hidup/mati overlay tidak disentuh.", `
          <label class="p-field"><span>Pilih tema</span><select class="p-select" id="wr-preset"><option value="">— pilih tema —</option>${THEME_PRESETS.map((p) => `<option value="${p.id}" ${p.id === matchingId ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
          <button type="button" class="p-btn p-btn--ghost" id="wr-reset-all">Reset semua ke default</button>
        `) +
        card("Warna", "", `<div style="display:grid;gap:.85rem">${colorRows}</div>`) +
        card("Overlay", "Mati/hidup tiap layer; warna hanya mengubah hue. Kotak di tiap kartu = pratinjau langsung.", `
          <label class="p-upload-wrap"><span class="p-btn p-btn--ghost">Ganti foto preview</span><input type="file" id="wr-preview-file" accept="image/*" hidden></label>
          <div style="display:grid;gap:.85rem;margin-top:.75rem">${overlayRows}</div>
        `);

      // Sinkron picker (11 pasangan: 7 warna + 4 overlay)
      Object.keys(DEFAULT_THEME.colors).forEach((k) => bindColorPair(outlet, "c" + k, (val) => { theme.colors[k] = val; markDirty(); }));
      Object.keys(DEFAULT_THEME.overlays).forEach((k) => bindColorPair(outlet, "o" + k, (val) => { theme.overlays[k].color = val; markDirty(); updatePreview(k); }));

      outlet.querySelectorAll("[data-reset-color]").forEach((btn) => btn.addEventListener("click", () => { theme.colors[btn.dataset.resetColor] = DEFAULT_THEME.colors[btn.dataset.resetColor]; markDirty(); render(); }));
      outlet.querySelectorAll("[data-reset-overlay]").forEach((btn) => btn.addEventListener("click", () => { theme.overlays[btn.dataset.resetOverlay] = { ...DEFAULT_THEME.overlays[btn.dataset.resetOverlay] }; markDirty(); render(); }));
      outlet.querySelectorAll("[data-overlay-enabled]").forEach((box) => box.addEventListener("change", () => { theme.overlays[box.dataset.overlayEnabled].enabled = box.checked; markDirty(); updatePreview(box.dataset.overlayEnabled); }));
      outlet.querySelectorAll("[data-overlay-opacity]").forEach((input) => input.addEventListener("input", () => { theme.overlays[input.dataset.overlayOpacity].opacity = Number(input.value) / 100; markDirty(); updatePreview(input.dataset.overlayOpacity); }));

      outlet.querySelector("#wr-preview-file").addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) URL.revokeObjectURL(previewPhotoUrl);
        previewPhotoUrl = URL.createObjectURL(file);
        render();
      });
      outlet.querySelector("#wr-preset").addEventListener("change", (e) => {
        const preset = THEME_PRESETS.find((p) => p.id === e.target.value);
        if (!preset) return;
        Object.assign(theme.colors, preset.colors);
        Object.keys(preset.overlayColors).forEach((k) => { if (theme.overlays[k]) theme.overlays[k].color = preset.overlayColors[k]; });
        markDirty();
        render();
      });
      outlet.querySelector("#wr-reset-all").addEventListener("click", () => { Object.assign(theme, mergeTheme({})); markDirty(); render(); });
    }
    render();

    async function onSave() {
      window.PanelStore.set("theme", theme);
      const { error } = await window.PanelStore.save(["theme"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan tema: " + error.message, true); return false; }
      window.AdminAPI.toast("Tema disimpan.");
      return true;
    }
  },
  destroy() {}
};
