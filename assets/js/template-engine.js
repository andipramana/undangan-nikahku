/** Template Engine v3 — template CSS REPLACES style.css entirely.
 *
 * Classic Elegance: css=null → style.css tetap aktif (default HTML).
 * Template lain: css="/templates/xxx.css" → style.css DISABLE,
 *   template CSS inject. Template CSS harus comprehensive (app-frame,
 *   modal, FAB, semua section).
 */
(function () {
  "use strict";

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

    if (!_definition) {
      try { const res = await fetch("/templates/classic-elegance.json"); _definition = await res.json(); } catch {
        _definition = { id: "classic-elegance", name: "Classic Elegance" };
      }
    }

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
