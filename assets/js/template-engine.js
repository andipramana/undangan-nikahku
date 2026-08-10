/** Template Engine v2 — setiap template adalah CSS stylesheet UTUH.
 *
 * Template = JSON metadata + CSS file + optional JS file. Engine:
 * 1. Load JSON → ambil nama, theme vars, font list, path CSS, path JS
 * 2. Inject <link> CSS template → override total layout/style
 * 3. Jalankan JS template (kalau ada) → override behaviour
 * 4. Apply CSS variables dari theme (untuk yang pakai var)
 *
 * Saat switch template: CSS/JS lama dihapus, CSS/JS baru di-inject.
 * Style.css tetap sebagai base/reset.
 */
(function () {
  "use strict";

  let _definition = null;
  let _cssLink = null;
  let _jsCleanup = null;

  /* ─── CSS injection ─── */
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

  /* ─── Theme CSS variables ─── */
  function applyTheme(theme) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme || {})) {
      if (key.startsWith("--")) root.style.setProperty(key, value);
    }
    window.__ACTIVE_THEME = theme;
  }

  /* ─── Public API ─── */

  window.loadTemplate = async function (source) {
    _definition = null;

    if (typeof source === "string") {
      try {
        const res = await fetch(source);
        if (res.ok) _definition = await res.json();
      } catch {}
    } else if (source && typeof source === "object") {
      _definition = source;
    }

    if (!_definition) {
      try {
        const res = await fetch("/templates/classic-elegance.json");
        _definition = await res.json();
      } catch {
        _definition = { id: "classic-elegance", name: "Classic Elegance", theme: {} };
      }
    }

    const tpl = _definition;

    // 1) Inject CSS
    injectCSS(tpl.css || `/templates/${tpl.id}.css`);

    // 2) JS template — cleanup dulu, lalu load kalau tpl.js ada
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
      } catch {} // JS optional
    }

    // 3) Theme CSS variables
    applyTheme(tpl.theme || {});

    window.__TEMPLATE_ACTIVE = tpl;
    return tpl;
  };

  window.getActiveTemplate = function () { return _definition; };
})();
