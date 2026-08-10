/** Template Engine — memuat definisi template, menerapkan tema, mengelola
 * transisi/reveal/parallax, dan menyesuaikan tampilan shell.
 *
 * Template = JSON statis di /templates/. Engine membaca satu template,
 * meng-override CSS variable, mengaktifkan/menyembunyikan section, dan
 * memasang behaviour transisi (default reveal CSS + parallax 3D opsional).
 *
 * Reveal per-elemen: tetap memakai sistem reveal.js yang sudah ada
 * (data-reveal + IntersectionObserver + CSS transition). Template hanya
 * menentukan varian default per section — elemen individual tetap bisa
 * memakai data-reveal spesifik.
 *
 * Parallax 3D: scroll-based depth murni. Tidak ada rotasi. Tidak ada
 * mouse-tracking. Layer bergerak pada sumbu Z dengan perspective tetap;
 * kecepatan berbeda per layer menghasilkan ilusi kedalaman. */
(function () {
  "use strict";

  let _definition = null;
  let _parallaxActive = false;
  let _parallaxRaf = null;

  /* ─── Section → HTML id mapping ─── */
  const SECTION_IDS = {
    cover: "#cover",
    opening: "#opening",
    "we-found-love": "#we-found-love",
    couple: "#couple",
    event: "#event",
    livestream: "#livestream",
    quote: "#quote",
    "love-story": "#love-story",
    gallery: "#gallery",
    gift: "#gift",
    rsvp: "#rsvp",
    closing: "#closing",
  };

  /** Terapkan CSS variable tema. Dipanggil PALING AWAL — sebelum elemen lain
   *  dirender, supaya tidak ada kedipan warna default. */
  function applyTheme(theme) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme)) {
      if (key.startsWith("--")) root.style.setProperty(key, value);
    }
    // Simpan referensi untuk theme.js admin
    window.__ACTIVE_THEME = theme;
  }

  /** Aktifkan/sembunyikan section sesuai template definition. Urutan
   *  section di DOM tidak diubah (re-ordering full terlalu invasif);
   *  sebagai gantinya section yang TIDAK dipakai di-hidden, dan
   *  feature flag (countdown, livestream, etc.) diterapkan. */
  function applySections(sections, features) {
    const active = new Set(sections);
    // Cover SELALU tampil — safety net. Tanpa cover, halaman terlihat blank.
    active.add("cover");
    for (const [key, selector] of Object.entries(SECTION_IDS)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (active.has(key)) {
        el.removeAttribute("hidden");
        el.style.display = "";
      } else {
        el.setAttribute("hidden", "");
      }
    }

    // Feature flags — fitur yang dimatikan di template disembunyikan.
    if (features) {
      if (!features.countdown) {
        const cd = document.querySelector(".countdown");
        if (cd) cd.setAttribute("hidden", "");
      }
      if (!features.calendar) {
        const cal = document.getElementById("btn-add-calendar");
        if (cal) cal.setAttribute("hidden", "");
      }
      if (!features.dresscode) {
        const dc = document.querySelector(".dresscode-card");
        if (dc) dc.setAttribute("hidden", "");
      }
      if (!features.qr_checkin) {
        const qr = document.getElementById("btn-qr-checkin");
        if (qr) qr.setAttribute("hidden", "");
      }
      // livestream: section sudah di-handle applySections; langsung hapus
      // dari DOM kalau dimatikan, supaya initLivestream tidak memprosesnya.
      if (!features.livestream) {
        const ls = document.getElementById("livestream");
        if (ls) ls.remove();
      }
    }
  }

  /* ─── Parallax 3D — scroll-based depth ───
   *
   *  Formula: translate3d(0, scrollTop * speed, z)
   *  Speed dikalikan ke delta scroll aktual. Layer punya speed 0–0.25.
   *  Perspective: 300–500px (subtle, tidak agresif).
   *  Tidak ada rotasi — rotasi menciptakan efek "game" yang murahan.
   *  Hanya translateZ + translateY pada sumbu Y.

   *  PENTING: scrollTop dibaca dari .app-frame__scroll (kolom HP yang
   *  sebenarnya discroll), bukan window. */
  function initParallax3D(config) {
    if (!config || !config.enabled || config.type !== "scroll-3d") return;

    const scroller = document.querySelector(".app-frame__scroll");
    if (!scroller) return;

    const perspective = config.perspective || 400;
    const wrap = document.getElementById("invitation");
    if (wrap) {
      wrap.style.perspective = `${perspective}px`;
      wrap.style.perspectiveOrigin = "center top";
      wrap.style.transformStyle = "preserve-3d";
    }

    const layers = (config.layers || []).map((l) => {
      const els = document.querySelectorAll(l.selector);
      return { els, speed: l.speed || 0, z: l.z || 0 };
    });

    function tick() {
      const scrollTop = scroller.scrollTop;
      for (const layer of layers) {
        const y = scrollTop * layer.speed;
        const z = layer.z;
        for (const el of layer.els) {
          el.style.transform = `translate3d(0, ${-y}px, ${z}px)`;
        }
      }
      _parallaxRaf = requestAnimationFrame(tick);
    }

    _parallaxActive = true;
    _parallaxRaf = requestAnimationFrame(tick);
  }

  function destroyParallax() {
    if (_parallaxRaf) cancelAnimationFrame(_parallaxRaf);
    _parallaxActive = false;
  }

  /* ─── Reveal per-elemen — integrasi dengan reveal.js ───
   *
   *  Template menentukan varian reveal default per section; elemen
   *  individual tetap memakai data-reveal spesifik dari HTML.
   *  Engine hanya memastikan `reveal-ready` class sudah ada. */
  function applyRevealDefaults(transitions) {
    // reveal.js menangani data-reveal + IntersectionObserver.
    // Template menyediakan map transisi default; tidak perlu
    // mengubah data-reveal di DOM karena HTML sudah memilikinya.
    window.__TEMPLATE_TRANSITIONS = transitions || {};
  }

  /* ─── Public API ─── */

  /** Muat template dari URL path (string) atau definisi inline (object).
   *  @param {string|object|null} source — path seperti "/templates/modern-minimal.json"
   *         atau object definisi, atau null untuk fallback ke classic-elegance. */
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
    // Fallback: template bawaan classic-elegance
    if (!_definition) {
      try {
        const res = await fetch("/templates/classic-elegance.json");
        _definition = await res.json();
      } catch {
        console.warn("Template engine: tidak dapat memuat template, pakai default kosong.");
        _definition = { theme: {}, sections: [], transitions: {}, parallax: { enabled: false }, features: {} };
      }
    }
    const tpl = _definition;
    applyTheme(tpl.theme || {});
    applySections(tpl.sections || [], tpl.features || {});
    applyRevealDefaults(tpl.transitions || {});
    if (tpl.parallax && tpl.parallax.enabled) {
      initParallax3D(tpl.parallax);
    }
    window.__TEMPLATE_ACTIVE = _definition;
    return _definition;
  };

  /** Ganti template saat runtime (preview switch di admin). */
  window.switchTemplate = async function (definition) {
    destroyParallax();
    _definition = definition;
    await window.loadTemplate(definition);
    // Re-scan reveal observer untuk section yang baru tampil
    if (window.revealScan) window.revealScan();
  };

  /** Dapatkan definisi template yang sedang aktif. */
  window.getActiveTemplate = function () {
    return _definition;
  };

  /** Cek apakah parallax 3D sedang aktif. */
  window.isParallaxActive = function () {
    return _parallaxActive;
  };
})();
