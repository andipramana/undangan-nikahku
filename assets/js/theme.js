/**
 * Tema situs tamu (tab "Tampilan" di admin, key `theme` di site_content).
 * Di-apply dengan menimpa CSS custom properties di elemen <html>.
 *
 * Prinsip fallback: kalau tema tidak tersimpan (cfg.theme kosong/parsial),
 * var yang tidak disebut TIDAK disentuh sama sekali — CSS bawaan di
 * style.css yang jalan, jadi tanpa tema tersimpan situs tampil persis
 * seperti semula (prinsip yang sama dengan html.reveal-ready di reveal.js).
 *
 * Dipanggil di AWAL populateContent() (main.js) — sebelum elemen lain
 * diisi, supaya warna custom sudah aktif sedini mungkin, minim kedipan.
 */

/** "#c9a668" / "#fff" / "c9a668" -> "r,g,b" string; null kalau tak sah. */
function hexRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((ch) => ch + ch).join("") : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(",");
}

/** Alpha efektif layer overlay: state opacity (0–1) kalau tersimpan; kalau
 * kosong/undefined (data tema lama sebelum fitur opacity) fallback ke alpha
 * asli yang dulu hardcoded — jadi tema lama tetap tampil identik, TIDAK ADA
 * perubahan visual. Clamping & rumus SAMA PERSIS dengan preview admin
 * (admin/theme.js, overlayOpacity). */
function overlayOpacity(layer, fallback) {
  const o = typeof layer.opacity === "number" && isFinite(layer.opacity) ? layer.opacity : fallback;
  return Math.min(1, Math.max(0, o));
}

window.applyTheme = function (cfg) {
  const t = (cfg && cfg.theme) || {};
  const colors = t.colors || {};
  const root = document.documentElement.style;

  // 7 warna solid — setProperty langsung; kosong/undefined = biarkan CSS
  // fallback bawaan jalan (JANGAN set string kosong ke CSS var).
  const map = {
    bg: "--color-bg",
    dark: "--color-dark",
    dark2: "--color-dark-2",
    gold: "--color-gold",
    goldSoft: "--color-gold-soft",
    text: "--color-text",
    textLight: "--color-text-light"
  };
  Object.keys(map).forEach((k) => {
    if (colors[k]) root.setProperty(map[k], colors[k]);
  });

  // Tipografi per kelompok elemen dari tab Font admin. Font dimuat dari
  // Google Fonts bila belum ada, lalu diterapkan hanya ke selector miliknya.
  applyTypography((cfg && cfg.typography) || {});

  const ov = t.overlays || {};

  // Golden hour global (.app-frame::after — pseudo-element, tidak bisa
  // querySelector, jadi on/off lewat var opacity; mix-blend-mode tetap dari
  // CSS). Warna = hex solid, bukan rgba; opacity dari slider admin (fallback
  // .4 = alpha asli), bukan angka hardcoded.
  const g = ov.global;
  if (g) {
    const hex = String(g.color || "").trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      root.setProperty("--overlay-global-color", hex);
    }
    root.setProperty(
      "--overlay-global-opacity",
      g.enabled === false ? "0" : String(overlayOpacity(g, 0.4))
    );
  }

  // Overlay pada ELEMEN DOM (flat/closing/quote): warna diganti lewat var
  // CSS, alpha ikut opacity slider admin (fallback per layer = alpha asli
  // di style.css) — dan mati/hidup lewat display langsung ke elemen.
  // Skala proporsional: stop asli × (opacity_baru / basis) supaya bentuk
  // gradient (makin gelap ke bawah) tetap terjaga, cuma pekat/pudarnya
  // berubah. RUMUS SAMA PERSIS dengan overlayStyle() di admin/theme.js.
  applyOverlayDom(".hero-overlay--flat", "--overlay-flat", ov.flat, (rgb, o) => `rgba(${rgb},${o})`, 0.22);
  applyOverlayDom(".hero-overlay--closing", "--overlay-closing", ov.closing, (rgb, o) =>
    `linear-gradient(180deg, rgba(${rgb},${0.7 * (o / 0.78)}) 0%, rgba(${rgb},${0.78 * (o / 0.78)}) 50%, rgba(${rgb},${0.88 * (o / 0.78)}) 100%)`,
    0.78
  );
  applyOverlayDom(".quote-overlay", "--overlay-quote", ov.quote, (rgb, o) => {
    const [r, g2, b] = rgb.split(",");
    // Stop 2 = versi lebih gelap dari hex admin — meniru rasio gelap asli
    // (#30200d -> #140d05, kira-kira 40%) supaya hue berubah tapi kontras
    // antar stop tetap; alpha stop-2 diskala relatif .55 (basis stop-1).
    return `linear-gradient(180deg, rgba(${rgb},${o}) 0%, rgba(${Math.round(r * .4)},${Math.round(g2 * .4)},${Math.round(b * .4)},${0.62 * (o / 0.55)}) 100%)`;
  }, 0.55);

  /** Overlay pada elemen DOM asli: set var CSS kalau warna valid, toggle
   * display untuk on/off. Layer tidak disebut tema = biarkan CSS bawaan. */
  function applyOverlayDom(sel, varName, layer, transform, fallbackOpacity) {
    if (!layer) return;
    document.querySelectorAll(sel).forEach((el) => {
      if (layer.enabled === false) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      const rgb = hexRgb(layer.color);
      if (rgb) root.setProperty(varName, transform(rgb, overlayOpacity(layer, fallbackOpacity)));
    });
  }
};

/** Terapkan font per tulisan/elemen dari tab Font admin. Tanpa setting
 * tersimpan, CSS awal tidak disentuh sehingga desain bawaan tetap identik. */
function applyTypography(typography) {
  const selectors = {
    "cover-eyebrow": ".cover-eyebrow", "cover-names": ".cover-names, #couple-names-cover",
    "cover-guest": ".guest-label, .guest-name", "cover-button": ".btn-open",
    "opening-eyebrow": "#opening .eyebrow", "opening-names": "#couple-names-opening",
    "opening-date": ".save-date, .cover-countdown__date", "opening-quote": ".opening-quote",
    "couple-eyebrow": "#couple .section-eyebrow", "couple-title": "#couple .section-title--script",
    "couple-name": ".couple-info__name", "couple-label": ".couple-info__label, .couple-info__parents",
    "event-eyebrow": "#event .section-eyebrow", "event-title": "#event .section-title",
    "event-label": ".event-label", "event-date": ".event-num, .event-day, .event-month, .event-year, .event-time",
    "event-venue": ".event-place h3, .event-place p", "dresscode": ".dresscode-label, .dresscode-text",
    "story-title": "#love-story .section-title--script", "story-content": ".timeline-item h4, .timeline-item p",
    "gallery-title": "#gallery .section-title--script", "quote": ".quote-text",
    "gift-title": "#gift .section-title", "gift-content": ".gift-account__bank, .gift-account__number, .gift-rec-card__name, .gift-rec-card__price",
    "gift-button": "#gift .btn-primary, #gift .btn-outline, #gift .btn-text", "rsvp-title": "#rsvp .section-title",
    "rsvp-form": ".rsvp-form label, .rsvp-form input, .rsvp-form select, .rsvp-form textarea, .rsvp-pill, #rsvp-submit",
    "wishes": ".wishes-heading p, .wishes-intro, .wish-card__name, .wish-card__status, .wish-card__message",
    "closing-text": ".closing-text, footer", "closing-names": "#couple-names-closing"
  };
  const values = (typography && typography.elements) || {};
  Object.entries(values).forEach(([key, setting]) => {
    const selector = selectors[key];
    if (!selector || !setting) return;
    const family = String(setting.family || "").trim();
    if (family) loadTypographyFont(family);
    document.querySelectorAll(selector).forEach((el) => {
      if (family) el.style.fontFamily = `"${family.replace(/"/g, "")}", sans-serif`;
      if (setting.size !== "" && Number(setting.size) > 0) el.style.fontSize = `${Number(setting.size)}px`;
      if (setting.weight !== "" && Number(setting.weight) >= 100) el.style.fontWeight = String(Number(setting.weight));
      if (setting.color) el.style.color = String(setting.color);
    });
  });
}

function loadTypographyFont(family) {
  const id = "dynamic-font-" + encodeURIComponent(family).replace(/%/g, "");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(family).replace(/%20/g, "+") + ":wght@300;400;500;600;700&display=swap";
  document.head.appendChild(link);
}
