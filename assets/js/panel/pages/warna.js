/** Warna — tema situs TAMU untuk template yang sedang aktif.
 *
 * Halaman ini TIDAK tahu nama variabel CSS satu template pun. Semuanya dibaca
 * dari templates/<id>/template.json:
 *   editor.colors   [{ key, var, label, default }]  — wajib, kalau kosong
 *                   halaman menyatakan template ini tanpa setelan warna
 *   editor.overlays [{ key, label, default, opacity }] — opsional
 *   editor.presets  [{ id, label, colors, overlayColors }] — opsional
 *
 * Yang disimpan hanyalah `key` (bukan nama var), di
 * content.templates[<id>].theme — jadi warna template A tidak pernah menyentuh
 * template B. Sisi tamu memasangkannya kembali ke variabel CSS lewat
 * WeddingEngine.applyThemeOverrides, memakai peta `var` dari manifest yang sama.
 *
 * Panel admin sendiri tidak terpengaruh (panel.css tetap).
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["warna"] = {
  title: "Warna",
  group: "Tampilan",
  icon: window.PanelUI.icon("palette"),
  async mount(outlet) {
    const { esc, escAttr, pickerHex, bindColorPair, card } = window.PanelUI;
    const { sb, photoUrl, tenant, query } = window.AdminAPI;

    const manifest = await window.PanelStore.activeManifest();
    const editor = manifest.editor || {};
    const COLORS = Array.isArray(editor.colors) ? editor.colors : [];
    const OVERLAYS = Array.isArray(editor.overlays) ? editor.overlays : [];
    const PRESETS = Array.isArray(editor.presets) ? editor.presets : [];

    if (!COLORS.length) {
      outlet.innerHTML = card(
        "Warna",
        "",
        `<p class="p-muted">Template <strong>${esc(manifest.name || manifest.id || "ini")}</strong> tidak menyediakan setelan warna. Warnanya sudah ditetapkan oleh desain template.</p>`
      );
      return;
    }

    const defaultOverlay = (key) => {
      const spec = OVERLAYS.find((o) => o.key === key) || {};
      return { enabled: true, color: spec.default, opacity: spec.opacity };
    };

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

    /** Pratinjau layer overlay. Rumusnya HARUS sama persis dengan sisi tamu
     * (assets/js/theme.js applyTheme) — kalau beda, pratinjau di sini bohong.
     * Bentuk gradient per key memang khas template klasik; template lain
     * sejauh ini tidak mendeklarasikan overlay sama sekali, jadi key yang
     * tidak dikenal jatuh ke warna rata (aman, bukan error). */
    function overlayStyle(k) {
      const layer = theme.overlays[k];
      const spec = OVERLAYS.find((o) => o.key === k) || {};
      if (!layer || layer.enabled === false) return { background: "", opacity: "0" };
      const rgb = hexRgb(layer.color);
      if (!rgb) return { background: "", opacity: "" };
      const o = overlayOpacity(layer, spec.opacity);
      if (k === "global") return { background: layer.color, opacity: String(o) };
      if (k === "closing") {
        return { background: `linear-gradient(180deg, rgba(${rgb},${0.7 * (o / 0.78)}) 0%, rgba(${rgb},${0.78 * (o / 0.78)}) 50%, rgba(${rgb},${0.88 * (o / 0.78)}) 100%)`, opacity: "" };
      }
      if (k === "quote") {
        const [r, g, b] = rgb.split(",");
        return { background: `linear-gradient(180deg, rgba(${rgb},${o}) 0%, rgba(${Math.round(r * .4)},${Math.round(g * .4)},${Math.round(b * .4)},${0.62 * (o / 0.55)}) 100%)`, opacity: "" };
      }
      return { background: `rgba(${rgb},${o})`, opacity: "" };
    }

    function mergeTheme(saved) {
      const cur = { colors: {}, overlays: {} };
      COLORS.forEach((c) => {
        cur.colors[c.key] = String((saved.colors && saved.colors[c.key]) || c.default);
      });
      OVERLAYS.forEach((spec) => {
        const s = (saved.overlays && saved.overlays[spec.key]) || {};
        cur.overlays[spec.key] = {
          enabled: s.enabled !== false,
          color: String(s.color || spec.default),
          opacity: overlayOpacity(s, spec.opacity)
        };
      });
      return cur;
    }

    function matchingPresetId() {
      const sameColors = (p) => COLORS.every((c) =>
        String(p.colors[c.key] || "").toLowerCase() === String(theme.colors[c.key]).toLowerCase());
      const sameOverlays = (p) => OVERLAYS.every((spec) =>
        String((p.overlayColors || {})[spec.key] || "").toLowerCase() === String(theme.overlays[spec.key].color).toLowerCase());
      const hit = PRESETS.find((p) => sameColors(p) && sameOverlays(p));
      return hit ? hit.id : "";
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

    const theme = mergeTheme(window.PanelStore.tplGet("theme", {}));
    let previewPhotoUrl = "";
    if (OVERLAYS.length) {
      const path = await fetchPreviewPhoto();
      if (path) previewPhotoUrl = photoUrl(path);
    }

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    function updatePreview(k) {
      const box = outlet.querySelector(`[data-preview-overlay="${k}"]`);
      if (!box) return;
      const s = overlayStyle(k);
      box.style.background = s.background;
      box.style.opacity = s.opacity;
    }

    function render() {
      const colorRows = COLORS.map((c) => `
        <div class="p-field">
          <span>${esc(c.label)}</span>
          <div class="p-color-row">
            <input type="color" value="${pickerHex(theme.colors[c.key])}" data-color-i="c${c.key}" aria-label="${escAttr(c.label)}">
            <input type="text" class="p-input" data-color-hex="c${c.key}" value="${escAttr(theme.colors[c.key])}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${escAttr(c.default)}">
            <button type="button" class="p-btn p-btn--tiny" data-reset-color="${escAttr(c.key)}" title="Reset ${escAttr(c.label)}" aria-label="Reset ${escAttr(c.label)}">&#8634;</button>
          </div>
        </div>`).join("");

      const overlayRows = OVERLAYS.map((spec) => {
        const k = spec.key;
        const s = overlayStyle(k);
        return `
        <div class="p-card" style="gap:.75rem">
          <div style="position:relative;aspect-ratio:16/9;border-radius:var(--p-r-md);overflow:hidden;border:1px solid var(--p-line);background:var(--p-sunken)">
            ${previewPhotoUrl ? `<img src="${escAttr(previewPhotoUrl)}" alt="Preview ${escAttr(spec.label)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ""}
            <div data-preview-overlay="${escAttr(k)}" style="position:absolute;inset:0;background:${s.background};opacity:${s.opacity}"></div>
          </div>
          <label class="p-switch"><input type="checkbox" data-overlay-enabled="${escAttr(k)}" ${theme.overlays[k].enabled ? "checked" : ""}><span>${esc(spec.label)}</span></label>
          <div class="p-color-row">
            <input type="color" value="${pickerHex(theme.overlays[k].color)}" data-color-i="o${k}" aria-label="Warna ${escAttr(spec.label)}">
            <input type="text" class="p-input" data-color-hex="o${k}" value="${escAttr(theme.overlays[k].color)}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off">
            <button type="button" class="p-btn p-btn--tiny" data-reset-overlay="${escAttr(k)}" title="Reset ${escAttr(spec.label)}" aria-label="Reset ${escAttr(spec.label)}">&#8634;</button>
          </div>
          <label class="p-field"><span>Kepekatan</span><input type="range" min="0" max="100" step="1" value="${Math.round(theme.overlays[k].opacity * 100)}" data-overlay-opacity="${escAttr(k)}"></label>
        </div>`;
      }).join("");

      const matchingId = matchingPresetId();
      const presetCard = PRESETS.length
        ? card("Tema siap pakai", `Hanya mengubah warna (${COLORS.length} solid${OVERLAYS.length ? ` + ${OVERLAYS.length} overlay` : ""}); status hidup/mati overlay tidak disentuh.`, `
            <label class="p-field"><span>Pilih tema</span><select class="p-select" id="wr-preset"><option value="">— pilih tema —</option>${PRESETS.map((p) => `<option value="${escAttr(p.id)}" ${p.id === matchingId ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>
            <button type="button" class="p-btn p-btn--ghost" id="wr-reset-all">Reset semua ke default</button>
          `)
        : card("Warna template", "", `
            <p class="p-muted">Warna bawaan template <strong>${esc(manifest.name || manifest.id)}</strong>. Ubah seperlunya — setelan ini hanya berlaku untuk template ini.</p>
            <button type="button" class="p-btn p-btn--ghost" id="wr-reset-all">Reset semua ke default</button>
          `);

      const overlayCard = OVERLAYS.length
        ? card("Overlay", "Mati/hidup tiap layer; warna hanya mengubah hue. Kotak di tiap kartu = pratinjau langsung.", `
            <label class="p-upload-wrap"><span class="p-btn p-btn--ghost">Ganti foto preview</span><input type="file" id="wr-preview-file" accept="image/*" hidden></label>
            <div style="display:grid;gap:.85rem;margin-top:.75rem">${overlayRows}</div>
          `)
        : "";

      outlet.innerHTML = presetCard +
        card("Warna", "", `<div style="display:grid;gap:.85rem">${colorRows}</div>`) +
        overlayCard;

      COLORS.forEach((c) => bindColorPair(outlet, "c" + c.key, (val) => { theme.colors[c.key] = val; markDirty(); }));
      OVERLAYS.forEach((spec) => bindColorPair(outlet, "o" + spec.key, (val) => { theme.overlays[spec.key].color = val; markDirty(); updatePreview(spec.key); }));

      outlet.querySelectorAll("[data-reset-color]").forEach((btn) => btn.addEventListener("click", () => {
        const c = COLORS.find((x) => x.key === btn.dataset.resetColor);
        if (c) { theme.colors[c.key] = c.default; markDirty(); render(); }
      }));
      outlet.querySelectorAll("[data-reset-overlay]").forEach((btn) => btn.addEventListener("click", () => {
        theme.overlays[btn.dataset.resetOverlay] = defaultOverlay(btn.dataset.resetOverlay); markDirty(); render();
      }));
      outlet.querySelectorAll("[data-overlay-enabled]").forEach((box) => box.addEventListener("change", () => {
        theme.overlays[box.dataset.overlayEnabled].enabled = box.checked; markDirty(); updatePreview(box.dataset.overlayEnabled);
      }));
      outlet.querySelectorAll("[data-overlay-opacity]").forEach((input) => input.addEventListener("input", () => {
        theme.overlays[input.dataset.overlayOpacity].opacity = Number(input.value) / 100; markDirty(); updatePreview(input.dataset.overlayOpacity);
      }));

      const fileInput = outlet.querySelector("#wr-preview-file");
      if (fileInput) fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) URL.revokeObjectURL(previewPhotoUrl);
        previewPhotoUrl = URL.createObjectURL(file);
        render();
      });

      const presetSel = outlet.querySelector("#wr-preset");
      if (presetSel) presetSel.addEventListener("change", (e) => {
        const preset = PRESETS.find((p) => p.id === e.target.value);
        if (!preset) return;
        Object.assign(theme.colors, preset.colors);
        Object.entries(preset.overlayColors || {}).forEach(([k, v]) => { if (theme.overlays[k]) theme.overlays[k].color = v; });
        markDirty();
        render();
      });

      outlet.querySelector("#wr-reset-all").addEventListener("click", () => {
        Object.assign(theme, mergeTheme({}));
        markDirty();
        render();
      });
    }
    render();

    async function onSave() {
      window.PanelStore.tplSet("theme", theme);
      const { error } = await window.PanelStore.saveTpl();
      if (error) { window.AdminAPI.toast("Gagal menyimpan tema: " + error.message, true); return false; }
      window.AdminAPI.toast("Tema disimpan.");
      return true;
    }
  },
  destroy() {}
};
