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

  const ov = t.overlays || {};

  // Golden hour global (.app-frame::after — pseudo-element, tidak bisa
  // querySelector, jadi on/off lewat var opacity; alpha & mix-blend-mode
  // tetap dari CSS). Warna = hex solid, bukan rgba.
  const g = ov.global;
  if (g) {
    const hex = String(g.color || "").trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      root.setProperty("--overlay-global-color", hex);
    }
    root.setProperty("--overlay-global-opacity", g.enabled === false ? "0" : "");
  }

  // Overlay pada ELEMEN DOM (flat/closing/quote): warna diganti lewat var
  // CSS — alpha & jumlah stop gradient TETAP dari style.css, cuma hue yang
  // berubah — dan mati/hidup lewat display langsung ke elemen.
  applyOverlayDom(".hero-overlay--flat", "--overlay-flat", ov.flat, (rgb) => `rgba(${rgb},.22)`);
  applyOverlayDom(".hero-overlay--closing", "--overlay-closing", ov.closing, (rgb) =>
    `linear-gradient(180deg, rgba(${rgb},.7) 0%, rgba(${rgb},.78) 50%, rgba(${rgb},.88) 100%)`
  );
  applyOverlayDom(".quote-overlay", "--overlay-quote", ov.quote, (rgb) => {
    const [r, g2, b] = rgb.split(",");
    // Stop 2 = versi lebih gelap dari hex admin — meniru rasio gelap asli
    // (#30200d -> #140d05, kira-kira 40%) supaya hue berubah tapi kontras
    // antar stop tetap. Alpha .55/.62 PERSIS dari CSS asli.
    return `linear-gradient(180deg, rgba(${rgb},.55) 0%, rgba(${Math.round(r * .4)},${Math.round(g2 * .4)},${Math.round(b * .4)},.62) 100%)`;
  });

  /** Overlay pada elemen DOM asli: set var CSS kalau warna valid, toggle
   * display untuk on/off. Layer tidak disebut tema = biarkan CSS bawaan. */
  function applyOverlayDom(sel, varName, layer, transform) {
    if (!layer) return;
    document.querySelectorAll(sel).forEach((el) => {
      if (layer.enabled === false) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      const rgb = hexRgb(layer.color);
      if (rgb) root.setProperty(varName, transform(rgb));
    });
  }
};
