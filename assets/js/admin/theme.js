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
 * Butuh migration 0003+ (tabel site_content) — sama seperti tab Teks.
 */
(function () {
  const { sb, toast } = window.AdminAPI;

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

  // State form — hasil merge tema tersimpan (kalau ada) di atas default.
  let theme = null;

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
    render();
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
        return `
      <div class="theme-row">
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
      </div>`;
      })
      .join("");

    root.innerHTML =
      `<p class="theme-title">Tampilan</p>` +
      `<p class="muted theme-hint">Warna halaman undangan (tamu). Panel admin tidak ` +
      `terpengaruh. Reset hanya mengubah form — klik <b>Simpan</b> untuk menyimpan ke situs.</p>` +
      `<button type="button" class="btn btn--ghost" id="theme-reset-all">Reset semua ke default</button>` +
      `<p class="theme-title">Warna</p>` +
      `<div id="theme-colors">${colorRows}</div>` +
      `<p class="theme-title">Overlay</p>` +
      `<p class="muted theme-hint">Mati/hidup tiap layer; warna hanya mengubah hue — ` +
      `alpha & bentuk gradient tetap dari CSS.</p>` +
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
        theme.overlays[box.dataset.oKey].enabled = box.checked;
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
