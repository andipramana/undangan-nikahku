/**
 * Tab "Tampilan": warna situs TAMU (style.css) — 7 warna solid + 4 layer
 * overlay. Panel admin sendiri tidak terpengaruh (admin.css tetap, supaya
 * admin konsisten dipakai apa pun temanya).
 *
 * Disimpan ke site_content.theme (JSONB yang sudah ada — TANPA migrasi
 * baru). Simpan memakai pola saveLivestream() di shared.js: SELECT
 * site_content -> ganti HANYA key `theme` -> UPSERT objek utuh, supaya
 * field lain (Teks, gift, dst.) tidak ikut tertimpa.
 *
 * Reset (per-field & semua) HANYA mengubah form — perubahan benar-benar
 * tersimpan kalau admin menekan "Simpan".
 *
 * Tiap baris overlay punya kotak preview kecil (satu foto statis + layer
 * overlay di atasnya) yang update LIVE tanpa klik apa pun. Foto contoh
 * diambil dari Storage (folder cover dulu, fallback foto pertama mana pun),
 * atau admin upload sendiri — upload itu blob lokal (URL.createObjectURL,
 * TIDAK disimpan ke Supabase), hilang saat halaman di-reload.
 *
 * Butuh migration 0003+ (tabel site_content) — sama seperti tab Teks.
 */
(function () {
  const { sb, photoUrl, toast } = window.AdminAPI;

  // Nilai default SAMA PERSIS dengan style.css sebelum fitur ini ada:
  //  - 7 var warna di :root
  //  - overlay global: var(--color-gold) = #c9a668, opacity .4 (soft-light)
  //  - flat: rgba(10,9,7,.22) -> warna dasar #0a0907
  //  - closing: rgba(10,9,7,.7/.78/.88) -> warna dasar #0a0907
  //  - quote: stop-1 rgba(48,32,13,.55) = #30200d (stop-2 = turunan ~40%)
  const DEFAULT_THEME = {
    colors: {
      bg: "#f7f3ea",
      dark: "#14120f",
      dark2: "#1c1914",
      gold: "#c9a668",
      goldSoft: "#e6d7b3",
      text: "#2b2620",
      textLight: "#f7f3ea"
    },
    overlays: {
      global: { enabled: true, color: "#c9a668" },
      flat: { enabled: true, color: "#0a0907" },
      closing: { enabled: true, color: "#0a0907" },
      quote: { enabled: true, color: "#30200d" }
    }
  };

  const COLOR_LABELS = {
    bg: "Latar halaman",
    dark: "Latar gelap",
    dark2: "Latar gelap (tua)",
    gold: "Emas",
    goldSoft: "Emas lembut",
    text: "Warna teks",
    textLight: "Teks terang"
  };

  const OVERLAY_LABELS = {
    global: "Golden hour global",
    flat: "Cover & pembuka",
    closing: "Closing & footer",
    quote: "Foto quote"
  };

  // Tema siap pakai untuk dropdown preset. HANYA mengubah warna (7 solid +
  // 4 warna overlay) — status hidup/mati (enabled) tiap overlay TIDAK
  // disentuh, dan memilih preset tidak auto-save (pola sama seperti reset).
  const THEME_PRESETS = [
    { id: "golden-hour", label: "Golden Hour (default)",
      colors: { bg: "#f7f3ea", dark: "#14120f", dark2: "#1c1914", gold: "#c9a668", goldSoft: "#e6d7b3", text: "#2b2620", textLight: "#f7f3ea" },
      overlayColors: { global: "#c9a668", flat: "#0a0907", closing: "#0a0907", quote: "#30200d" } },
    { id: "mocha-bloom", label: "Mocha & Bloom",
      colors: { bg: "#f6f0e6", dark: "#241811", dark2: "#1a1109", gold: "#8a5f3c", goldSoft: "#c9a97e", text: "#2a2018", textLight: "#f6f0e6" },
      overlayColors: { global: "#8a5f3c", flat: "#1a1109", closing: "#1a1109", quote: "#241811" } },
    { id: "burgundy-wine", label: "Burgundy Wine",
      colors: { bg: "#f6f0e6", dark: "#241811", dark2: "#1a1109", gold: "#7a2b30", goldSoft: "#b06a63", text: "#2a2018", textLight: "#f6f0e6" },
      overlayColors: { global: "#7a2b30", flat: "#1a1109", closing: "#1a1109", quote: "#2e1416" } },
    { id: "emerald-luxe", label: "Emerald Luxe",
      colors: { bg: "#f5f1e6", dark: "#0f1a14", dark2: "#16241c", gold: "#b8935a", goldSoft: "#d9c396", text: "#1c231d", textLight: "#f5f1e6" },
      overlayColors: { global: "#b8935a", flat: "#0f1a14", closing: "#0f1a14", quote: "#16241c" } },
    { id: "rose-blush", label: "Rose Blush",
      colors: { bg: "#faf3f0", dark: "#241615", dark2: "#2e1c1a", gold: "#c98a7a", goldSoft: "#e8c4b8", text: "#2c1c1a", textLight: "#faf3f0" },
      overlayColors: { global: "#c98a7a", flat: "#241615", closing: "#241615", quote: "#2e1c1a" } },
    { id: "navy-gold", label: "Navy & Gold",
      colors: { bg: "#f4f2ec", dark: "#0d1420", dark2: "#131c2c", gold: "#c9a668", goldSoft: "#e6d7b3", text: "#1a1f28", textLight: "#f4f2ec" },
      overlayColors: { global: "#c9a668", flat: "#0d1420", closing: "#0d1420", quote: "#131c2c" } },
    { id: "sage-cream", label: "Sage & Cream",
      colors: { bg: "#f7f5ee", dark: "#232922", dark2: "#2c332a", gold: "#a8b48a", goldSoft: "#cdd6b8", text: "#262b22", textLight: "#f7f5ee" },
      overlayColors: { global: "#a8b48a", flat: "#232922", closing: "#232922", quote: "#2c332a" } },
    { id: "terracotta-sunset", label: "Terracotta Sunset",
      colors: { bg: "#f8f0e6", dark: "#2a1810", dark2: "#351f15", gold: "#c76f4e", goldSoft: "#e0a888", text: "#2c1a12", textLight: "#f8f0e6" },
      overlayColors: { global: "#c76f4e", flat: "#2a1810", closing: "#2a1810", quote: "#351f15" } },
    { id: "lavender-dusk", label: "Lavender Dusk",
      colors: { bg: "#f6f2f6", dark: "#221a29", dark2: "#2c2233", gold: "#9b7fb0", goldSoft: "#cbb8db", text: "#241c29", textLight: "#f6f2f6" },
      overlayColors: { global: "#9b7fb0", flat: "#221a29", closing: "#221a29", quote: "#2c2233" } },
    { id: "noir-gold", label: "Classic Noir & Gold",
      colors: { bg: "#f5f5f0", dark: "#0a0a0a", dark2: "#161616", gold: "#d4af37", goldSoft: "#e8d38a", text: "#1a1a1a", textLight: "#f5f5f0" },
      overlayColors: { global: "#d4af37", flat: "#0a0a0a", closing: "#0a0a0a", quote: "#161616" } },
    { id: "ocean-teal", label: "Ocean Teal",
      colors: { bg: "#f2f6f5", dark: "#0e2624", dark2: "#163330", gold: "#4d8f85", goldSoft: "#9dc9c1", text: "#17241f", textLight: "#f2f6f5" },
      overlayColors: { global: "#4d8f85", flat: "#0e2624", closing: "#0e2624", quote: "#163330" } },
    { id: "champagne-blush", label: "Champagne Blush",
      colors: { bg: "#faf4ee", dark: "#2b1e1a", dark2: "#362521", gold: "#d1a78e", goldSoft: "#ecd3c1", text: "#2c1f1a", textLight: "#faf4ee" },
      overlayColors: { global: "#d1a78e", flat: "#2b1e1a", closing: "#2b1e1a", quote: "#362521" } }
  ];

  // State form — hasil merge tema tersimpan (kalau ada) di atas default.
  let theme = null;

  // Foto untuk kotak preview overlay. Kosong = belum ada (kotak preview
  // tampil polos); "blob:" = upload lokal, hilang saat halaman di-reload.
  let previewPhotoUrl = "";

  window.ThemePanel = { load };

  /* ---------- Helper ---------- */

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /** <input type="color"> hanya menerima #rrggbb — bentuk singkat (#fff)
   * dipanjangkan dulu. Nilai yang DISIMPAN tetap apa adanya (pola sama
   * dengan pickerHex di content.js dresscode). */
  function pickerHex(value) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
    if (!m) return "#000000";
    const h = m[1];
    return ("#" + (h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h)).toLowerCase();
  }

  // -----------------------------------------------------------------------
  // Kotak preview overlay — rumus & angka alpha HARUS SAMA PERSIS dengan
  // sisi tamu (assets/js/theme.js, fungsi hexRgb + transform di applyTheme).
  // Kalau beda, preview BOHONG — tidak mencerminkan tampilan asli.
  // -----------------------------------------------------------------------

  /** "#c9a668" / "#fff" / "c9a668" -> "r,g,b" string; null kalau tak sah.
   * Salinan persis hexRgb di assets/js/theme.js (konteks file beda, duplikasi
   * kecil OK — pola yang sama dengan duplikasi animasi angka reveal.js/
   * countdown.js). */
  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const h = m[1].length === 3 ? m[1].split("").map((ch) => ch + ch).join("") : m[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
  }

  /** Background + opacity elemen overlay untuk layer `k` — transform SAMA
   * PERSIS applyTheme() sisi tamu: flat rgba(.,.22); closing 3 stop
   * .7/.78/.88; quote 2 stop .55 + turunan ~40% .62; global warna solid +
   * opacity .4 (alpha soft-light dari .app-frame::after). */
  function overlayStyle(k) {
    const layer = theme.overlays[k];
    if (!layer || layer.enabled === false) return { background: "", opacity: "0" };
    const rgb = hexRgb(layer.color);
    if (!rgb) return { background: "", opacity: "" };
    if (k === "global") return { background: layer.color, opacity: ".4" };
    if (k === "flat") return { background: `rgba(${rgb},.22)`, opacity: "" };
    if (k === "closing") {
      return {
        background: `linear-gradient(180deg, rgba(${rgb},.7) 0%, rgba(${rgb},.78) 50%, rgba(${rgb},.88) 100%)`,
        opacity: ""
      };
    }
    if (k === "quote") {
      const [r, g, b] = rgb.split(",");
      return {
        background: `linear-gradient(180deg, rgba(${rgb},.55) 0%, rgba(${Math.round(r * .4)},${Math.round(g * .4)},${Math.round(b * .4)},.62) 100%)`,
        opacity: ""
      };
    }
    return { background: "", opacity: "" };
  }

  /** Update SATU kotak preview saja (elemen [data-preview-overlay=k]) —
   * JANGAN render ulang seluruh form tiap ketik, cukup elemen itu. */
  function updatePreview(k) {
    const box = document.querySelector(`[data-preview-overlay="${k}"]`);
    if (!box) return;
    const s = overlayStyle(k);
    box.style.background = s.background;
    box.style.opacity = s.opacity;
  }

  /** Gabungkan tema tersimpan di atas default — key/layer yang belum pernah
   * disimpan (tema lama dari sebelum fitur ini) tetap dapat nilai default,
   * bukan undefined. */
  function mergeTheme(saved) {
    const cur = { colors: {}, overlays: {} };
    Object.keys(DEFAULT_THEME.colors).forEach((k) => {
      cur.colors[k] = String((saved.colors && saved.colors[k]) || DEFAULT_THEME.colors[k]);
    });
    Object.keys(DEFAULT_THEME.overlays).forEach((k) => {
      const s = (saved.overlays && saved.overlays[k]) || {};
      cur.overlays[k] = {
        enabled: s.enabled !== false,
        color: String(s.color || DEFAULT_THEME.overlays[k].color)
      };
    });
    return cur;
  }

  /* ---------- Load ---------- */

  async function load() {
    const { data, error } = await window.AdminAPI.query(
      sb.from("site_content").select("content").eq("id", 1).maybeSingle(),
      "Permintaan tema"
    );
    // PGRST116 = baris belum ada — lanjut dengan default saja.
    if (error && error.code !== "PGRST116") {
      const root = document.getElementById("theme-root");
      root.innerHTML =
        `<p class="warning">Gagal memuat tab Tampilan: ${esc(error.message)} — pastikan ` +
        `migration <code>0003_content.sql</code> sudah dijalankan.</p>` +
        `<button type="button" class="btn btn--primary" id="theme-retry">Coba lagi</button>`;
      document.getElementById("theme-retry").addEventListener("click", load);
      return;
    }
    theme = mergeTheme((data && data.content && data.content.theme) || {});
    // Foto contoh untuk kotak preview overlay — diambil SEKALI tiap tab
    // dibuka (blob upload lokal tidak bertahan lintas reload, itu OK).
    previewPhotoUrl = "";
    const path = await fetchPreviewPhoto();
    if (path) previewPhotoUrl = photoUrl(path);
    render();
  }

  /** Ambil SATU foto contoh dari Storage: folder cover dulu (umumnya selalu
   * ada), fallback foto pertama mana pun. Null kalau Storage kosong semua —
   * kotak preview tampil polos (background solid), bukan broken image. */
  async function fetchPreviewPhoto() {
    const queries = [
      sb.from("photos").select("storage_path").eq("folder", "cover")
        .order("sort_order", { ascending: true }).order("id", { ascending: true }).limit(1),
      sb.from("photos").select("storage_path").order("id", { ascending: true }).limit(1)
    ];
    for (const q of queries) {
      const { data, error } = await window.AdminAPI.query(q, "Permintaan foto preview");
      if (!error && data && data[0]) return data[0].storage_path;
    }
    return null;
  }

  /* ---------- Render ---------- */

  function render() {
    const root = document.getElementById("theme-root");

    const colorRows = Object.keys(DEFAULT_THEME.colors)
      .map((k) => {
        const label = COLOR_LABELS[k];
        return `
      <div class="theme-row">
        <span class="theme-label">${label}</span>
        <span class="color-row">
          <input type="color" value="${pickerHex(theme.colors[k])}" data-c-key="${k}"
                 aria-label="${label}">
          <input type="text" class="color-hex" value="${escAttr(theme.colors[k])}" data-c-hex="${k}"
                 maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off"
                 placeholder="#c9a668" aria-label="Kode hex ${label}">
          <button type="button" class="btn btn--tiny" data-c-reset="${k}"
                  title="Reset ${label} ke default" aria-label="Reset ${label} ke default">&#8634;</button>
        </span>
      </div>`;
      })
      .join("");

    const overlayRows = Object.keys(DEFAULT_THEME.overlays)
      .map((k) => {
        const label = OVERLAY_LABELS[k];
        const s = overlayStyle(k); // gaya awal kotak preview — ikut state form
        return `
      <div class="theme-row theme-row--overlay">
        <div class="theme-preview" data-preview="${k}">
          ${previewPhotoUrl ? `<img src="${escAttr(previewPhotoUrl)}" alt="Preview ${label}">` : ""}
          <div class="theme-preview__overlay" data-preview-overlay="${k}"
               style="background:${s.background}; opacity:${s.opacity}"></div>
        </div>
        <div class="theme-overlay-fields">
          <label class="theme-toggle">
            <input type="checkbox" data-o-key="${k}" ${theme.overlays[k].enabled ? "checked" : ""}>
            <span>${label}</span>
          </label>
          <span class="color-row">
            <input type="color" value="${pickerHex(theme.overlays[k].color)}" data-o-color="${k}"
                   aria-label="Warna ${label}">
            <input type="text" class="color-hex" value="${escAttr(theme.overlays[k].color)}" data-o-hex="${k}"
                   maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off"
                   placeholder="#0a0907" aria-label="Kode hex ${label}">
            <button type="button" class="btn btn--tiny" data-o-reset="${k}"
                    title="Reset ${label} ke default" aria-label="Reset ${label} ke default">&#8634;</button>
          </span>
        </div>
      </div>`;
      })
      .join("");

    root.innerHTML =
      `<p class="theme-title">Tampilan</p>` +
      `<p class="muted theme-hint">Warna halaman undangan (tamu). Panel admin tidak ` +
      `terpengaruh. Reset hanya mengubah form — klik <b>Simpan</b> untuk menyimpan ke situs.</p>` +
      `<label class="form-field">` +
      `<span>Tema siap pakai</span>` +
      `<select id="theme-preset" class="input">` +
      `<option value="">— pilih tema —</option>` +
      THEME_PRESETS.map((p) => `<option value="${escAttr(p.id)}">${esc(p.label)}</option>`).join("") +
      `</select>` +
      `</label>` +
      `<button type="button" class="btn btn--ghost" id="theme-reset-all">Reset semua ke default</button>` +
      `<p class="theme-title">Warna</p>` +
      `<div id="theme-colors">${colorRows}</div>` +
      `<p class="theme-title">Overlay</p>` +
      `<p class="muted theme-hint">Mati/hidup tiap layer; warna hanya mengubah hue — ` +
      `alpha & bentuk gradient tetap dari CSS. Kotak kecil di tiap baris = ` +
      `pratinjau efeknya langsung di sini.</p>` +
      `<label class="upload-wrap theme-preview-upload">` +
      `<span class="btn btn--ghost">Ganti foto preview</span>` +
      `<input type="file" id="theme-preview-file" accept="image/*" hidden>` +
      `</label>` +
      `<div id="theme-overlays">${overlayRows}</div>` +
      `<div class="theme-actions"><button type="button" class="btn btn--primary" id="theme-save">Simpan</button></div>`;

    // Warna solid — pola renderColors() dresscode di content.js: pemilih
    // visual & kotak hex saling tersinkron, hex tak sah ditandai is-invalid.
    root.querySelectorAll("input[type=color][data-c-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const k = input.dataset.cKey;
        theme.colors[k] = input.value;
        const hex = root.querySelector(`[data-c-hex="${k}"]`);
        if (hex) {
          hex.value = input.value;
          hex.classList.remove("is-invalid");
        }
      });
    });
    root.querySelectorAll("[data-c-hex]").forEach((input) => {
      input.addEventListener("input", () => {
        const k = input.dataset.cHex;
        let val = input.value.trim();
        if (val && !val.startsWith("#")) val = "#" + val;
        const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val);
        input.classList.toggle("is-invalid", !ok);
        if (!ok) return; // setengah jadi tidak ditulis ke state (pola dresscode)
        theme.colors[k] = val;
        const picker = root.querySelector(`[data-c-key="${k}"]`);
        if (picker) picker.value = pickerHex(val);
      });
      input.addEventListener("blur", () => {
        const k = input.dataset.cHex;
        input.value = theme.colors[k] || "";
        input.classList.remove("is-invalid");
      });
    });
    root.querySelectorAll("[data-c-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        theme.colors[btn.dataset.cReset] = DEFAULT_THEME.colors[btn.dataset.cReset];
        render();
      });
    });

    // Overlay: checkbox on/off + picker warna (sinkron, pola sama).
    root.querySelectorAll("[data-o-key]").forEach((box) => {
      box.addEventListener("change", () => {
        const k = box.dataset.oKey;
        theme.overlays[k].enabled = box.checked;
        updatePreview(k); // kotak preview ikut seketika, tanpa re-render
      });
    });
    root.querySelectorAll("input[type=color][data-o-color]").forEach((input) => {
      input.addEventListener("input", () => {
        const k = input.dataset.oColor;
        theme.overlays[k].color = input.value;
        const hex = root.querySelector(`[data-o-hex="${k}"]`);
        if (hex) {
          hex.value = input.value;
          hex.classList.remove("is-invalid");
        }
        updatePreview(k);
      });
    });
    root.querySelectorAll("[data-o-hex]").forEach((input) => {
      input.addEventListener("input", () => {
        const k = input.dataset.oHex;
        let val = input.value.trim();
        if (val && !val.startsWith("#")) val = "#" + val;
        const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val);
        input.classList.toggle("is-invalid", !ok);
        if (!ok) return;
        theme.overlays[k].color = val;
        const picker = root.querySelector(`[data-o-color="${k}"]`);
        if (picker) picker.value = pickerHex(val);
        updatePreview(k);
      });
      input.addEventListener("blur", () => {
        const k = input.dataset.oHex;
        input.value = theme.overlays[k].color || "";
        input.classList.remove("is-invalid");
      });
    });
    root.querySelectorAll("[data-o-reset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        theme.overlays[btn.dataset.oReset] = {
          ...DEFAULT_THEME.overlays[btn.dataset.oReset]
        };
        render();
      });
    });

    // Upload foto preview — blob lokal MURNI (URL.createObjectURL), TIDAK ada
    // sb.storage di jalur ini. Hilang saat halaman di-reload, itu disengaja.
    document.getElementById("theme-preview-file").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ""; // file yang sama boleh dipilih ulang
      if (!file) return;
      if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
      previewPhotoUrl = URL.createObjectURL(file);
      render(); // bangun ulang ke-4 kotak preview dengan foto baru
    });

    // Preset tema: isi form dengan warna preset — HANYA warna (7 solid + 4
    // overlay), enabled tiap overlay sengaja tidak disentuh. Setelah render()
    // dropdown balik ke "— pilih tema —" (value="" di HTML baru) — itu benar:
    // preset bukan mode tersimpan, admin tetap review lalu klik Simpan.
    document.getElementById("theme-preset").addEventListener("change", (e) => {
      const preset = THEME_PRESETS.find((p) => p.id === e.target.value);
      if (!preset) return; // opsi "— pilih tema —"
      Object.assign(theme.colors, preset.colors);
      Object.keys(preset.overlayColors).forEach((k) => {
        if (theme.overlays[k]) theme.overlays[k].color = preset.overlayColors[k];
      });
      render(); // form + kotak preview overlay ikut update (pola sama seperti reset)
    });

    document.getElementById("theme-reset-all").addEventListener("click", () => {
      theme = mergeTheme({});
      render();
    });
    document.getElementById("theme-save").addEventListener("click", saveTheme);
  }

  /* ---------- Simpan (pola saveLivestream di shared.js) ---------- */

  async function saveTheme() {
    const { data, error } = await window.AdminAPI.query(
      sb.from("site_content").select("content").eq("id", 1).maybeSingle(),
      "Permintaan teks"
    );
    // PGRST116 = baris belum ada — lanjut dengan starter dari config.js
    // supaya yang di-upsert objek utuh, bukan hanya { theme }.
    if (error && error.code !== "PGRST116") {
      toast("Gagal membaca isi situs: " + error.message, true);
      return;
    }
    const content =
      data && data.content
        ? JSON.parse(JSON.stringify(data.content))
        : window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);
    content.theme = JSON.parse(JSON.stringify(theme)); // salinan, bukan referensi state
    const res = await window.AdminAPI.query(
      sb.from("site_content").upsert(
        { id: 1, content, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      ),
      "Penyimpanan tema"
    );
    if (res.error) {
      toast("Gagal menyimpan tema: " + res.error.message, true);
      return;
    }
    toast("Tema disimpan.");
  }
})();
