/** Template Engine v3 — template CSS REPLACES style.css entirely.
 *
 * Classic Elegance: css=null → style.css tetap aktif (default HTML).
 * Template lain: css="/templates/xxx.css" → style.css DISABLE,
 *   template CSS inject. Template CSS harus comprehensive (app-frame,
 *   modal, FAB, semua section).
 */
(function () {
  "use strict";

  // Classic Elegance INLINE (bukan fetch) — satu-satunya template yang benar-benar
  // dipakai sekarang (lihat panel/pages/template.js: cuma satu opsi di picker).
  // Isinya harus tetap identik dengan templates/classic-elegance.json (dipertahankan
  // untuk jalur eksplisit ?template=classic-elegance & preview admin). Sengaja
  // di-inline: performa — sebelumnya SETIAP load undangan default menunggu satu
  // request jaringan ekstra ("/templates/classic-elegance.json") di jalur render
  // paling kritis (sebelum foto cover mulai diunduh), padahal seluruh isinya
  // (--color-*/--font-* & font Google Fonts) sudah jadi default di :root style.css
  // dan <link> statis index.html — fetch itu tidak pernah mengubah apa pun untuk
  // tenant yang belum memilih template kustom (mayoritas kasus).
  const CLASSIC_ELEGANCE = {
    id: "classic-elegance",
    name: "Classic Elegance",
    version: 2,
    fonts: [
      "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Alegreya+Sans:wght@400;500;700&family=Cormorant+Garamond:wght@400&family=Italianno&display=swap"
    ],
    theme: {
      "--color-bg": "#f7f3ea",
      "--color-dark": "#14120f",
      "--color-dark-2": "#1c1914",
      "--color-gold": "#c9a668",
      "--color-gold-soft": "#e6d7b3",
      "--color-text": "#2b2620",
      "--color-text-light": "#f7f3ea",
      "--font-serif": "\"Poppins\", \"Segoe UI\", sans-serif",
      "--font-script": "\"EB Garamond\", sans-serif",
      "--font-sans": "\"Poppins\", \"Segoe UI\", sans-serif",
      "--font-label": "\"Alegreya Sans\", \"Segoe UI\", sans-serif",
      "--overlay-closing": "linear-gradient(180deg, rgba(10,9,7,.7) 0%, rgba(10,9,7,.78) 50%, rgba(10,9,7,.88) 100%)"
    }
  };

  let _definition = null;
  let _cssLink = null;
  let _styleDisabled = false;
  let _jsCleanup = null;

  /* ─── CSS management ─── */
  const STYLE_CSS_SEL = 'link[href$="style.css"]';

  function disableStyleCSS() {
    if (_styleDisabled) return;
    const el = document.querySelector(STYLE_CSS_SEL);
    if (el) { el.disabled = true; _styleDisabled = true; }
  }
  function enableStyleCSS() {
    if (!_styleDisabled) return;
    const el = document.querySelector(STYLE_CSS_SEL);
    if (el) { el.disabled = false; _styleDisabled = false; }
  }

  function injectCSS(url) {
    if (_cssLink) { _cssLink.remove(); _cssLink = null; }
    if (!url) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.templateCss = "1";
    document.head.appendChild(link);
    _cssLink = link;
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme || {})) {
      if (key.startsWith("--")) root.style.setProperty(key, value);
    }
  }

  /* ─── Public API ─── */

  window.loadTemplate = async function (source) {
    _definition = null;

    if (typeof source === "string") {
      try { const res = await fetch(source); if (res.ok) _definition = await res.json(); } catch {}
    } else if (source && typeof source === "object") {
      _definition = source;
    }

    if (!_definition) _definition = CLASSIC_ELEGANCE;

    const tpl = _definition;

    // 1) CSS: disable style.css, inject template CSS
    if (tpl.css) {
      disableStyleCSS();
      injectCSS(tpl.css);
    } else {
      enableStyleCSS();
      injectCSS(null);
    }

    // 2) JS
    if (_jsCleanup) { try { _jsCleanup(); } catch {}; _jsCleanup = null; }
    if (tpl.js) {
      try {
        const jsRes = await fetch(tpl.js);
        if (jsRes.ok) {
          const code = await jsRes.text();
          const fn = new Function("return (function(){" + code + "})()");
          const result = fn();
          if (typeof result === "function") _jsCleanup = result;
        }
      } catch {}
    }

    // 3) Theme
    applyTheme(tpl.theme || {});

    window.__TEMPLATE_ACTIVE = tpl;
    return tpl;
  };

  window.getActiveTemplate = function () { return _definition; };
})();
