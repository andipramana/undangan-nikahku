/** Modern Minimal — complete JS behaviour override.
 *  Runs AFTER all default modules. Patches cover, reveal,
 *  slider, parallax. Returns cleanup.
 *
 *  SECTION ORDER: Classic DOM order preserved.
 *  cover → opening → we-found-love → couple → event →
 *  livestream → quote → love-story → gallery → gift → rsvp → closing
 */
return (function() {
  "use strict";

  /* ─── 1. INJECTED STYLES (track for cleanup) ─── */
  var injected = [];

  function injectStyle(id, css) {
    var el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
    injected.push(el);
    return el;
  }

  /* ─── 2. COVER: position fixed, slide LEFT exit ─── */
  injectStyle("mm-cover",
    "#cover { position: fixed !important; inset: 0; z-index: 100; }" +
    "#cover.cover-visible { transform: translateX(0); opacity: 1; }" +
    "#cover.is-exiting { transform: translateX(-105%) !important; opacity: 1; transition: transform 0.85s cubic-bezier(0.5,0,0.75,0); pointer-events: none; }" +
    "#invitation.is-locked .invitation-body { display: none; }" +
    /* Opening visible immediately behind cover */
    "#opening { opacity: 1 !important; transform: none !important; }" +
    "#opening .hero-media img { transform: none !important; }" +
    "#opening .hero-content { opacity: 1 !important; }"
  );

  /* Override setupOpenButton from main.js — slide left, opening reveal langsung */
  function patchOpenButton() {
    var btn = document.getElementById("btn-open");
    var invitation = document.getElementById("invitation");
    var cover = document.getElementById("cover");
    var opening = document.getElementById("opening");
    if (!btn || !cover) return;

    /* Remove existing listener by cloning */
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    btn = newBtn;

    btn.addEventListener("click", function() {
      invitation.classList.remove("is-locked");
      document.documentElement.classList.remove("no-scroll");
      window.__invitationOpen = true;
      (window.__openCallbacks || []).forEach(function(fn) { fn(); });
      window.__openCallbacks = [];
      if (window.playBackgroundAudio) window.playBackgroundAudio();

      /* Opening langsung tampil, animasi text-enter */
      if (opening) {
        opening.classList.add("section-revealed");
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            opening.classList.add("text-revealed");
          });
        });
        /* Queue opening slideshow */
        setTimeout(function() {
          if (window.startOpeningSlideshow) window.startOpeningSlideshow();
          else window.__openingStartQueued = true;
        }, 800);
      }

      /* Cover slide keluar kiri */
      cover.classList.add("is-exiting");
      cover.addEventListener("transitionend", function() {
        if (window.revealScan) window.revealScan();
      }, { once: true });
    });
  }

  /* ─── 3. PARALLAX 3D — scroll-depth berlapis (perspective + translateZ) ───
   *  Bukan sekadar geser 28px: wrapper diberi perspective, tiap layer gambar
   *  digeser dengan kecepatan berbeda (depth), sehingga scroll terasa punya
   *  kedalaman. Hanya 2-5 layer kunci (cover/opening/closing/quote) — tidak
   *  semua elemen. Hormati prefers-reduced-motion. */
  var parallaxRaf = null;
  var depthLayers = [];
  function registerParallaxLayers() {
    /* Foto slideshow di-inject ASYNC oleh hero-slideshow.js setelah payload
       Supabase termuat — jangan daftarkan layer sebelum gambar ada. */
    var layerDefs = [
      { sel: "#cover .hero-media img", speed: 0.18, z: 18 },
      { sel: "#opening .hero-media img", speed: 0.22, z: 26 },
      { sel: "#closing .hero-media img", speed: 0.18, z: 18 },
      { sel: ".quote-section", speed: 0.10, z: 12 }
    ];
    depthLayers = [];
    layerDefs.forEach(function(def) {
      var els = document.querySelectorAll(def.sel);
      els.forEach(function(el) {
        if (el.classList.contains("parallax-layer")) return;
        el.classList.add("parallax-layer");
        el.style.willChange = "transform";
        el.style.backfaceVisibility = "hidden";
        depthLayers.push({ el: el, speed: def.speed, z: def.z });
      });
    });
  }

  function startParallax() {
    var scroller = document.querySelector(".app-frame__scroll");
    if (!scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var wrap = document.getElementById("invitation");
    if (wrap) {
      wrap.style.perspective = "420px";
      wrap.style.perspectiveOrigin = "50% 50%";
    }

    registerParallaxLayers();

    function tick() {
      var scrollTop = scroller.scrollTop;
      depthLayers.forEach(function(layer) {
        var section = layer.el.closest("section, .quote-section");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        /* Animasikan hanya saat section di layar (plus sedikit buffer) */
        if (rect.bottom > -120 && rect.top < window.innerHeight + 120) {
          var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          if (progress < 0) progress = 0;
          if (progress > 1) progress = 1;
          /* Gerakan depth: makin cepat layer, makin besar jarak — tetap halus */
          var y = (progress - 0.5) * layer.speed * 220;
          layer.el.style.transform =
            "translate3d(0," + y.toFixed(1) + "px,0) translateZ(" + layer.z + "px)";
        }
      });
      parallaxRaf = requestAnimationFrame(tick);
    }
    parallaxRaf = requestAnimationFrame(tick);
  }

  /* ─── 4. REVEAL OVERRIDE — cinematic timing ─── */
  injectStyle("mm-reveal",
    /* Longer, more cinematic durations */
    ".reveal-ready [data-reveal] { transition-duration: 0.8s; }" +
    ".reveal-ready [data-reveal=\"enter-right\"], " +
    ".reveal-ready [data-reveal=\"enter-left\"] { transition-duration: 1.6s !important; }" +
    ".reveal-ready [data-reveal=\"tilt-left\"], " +
    ".reveal-ready [data-reveal=\"tilt-right\"] { transition-duration: 1.1s !important; }" +
    /* Gallery items: alternate slide-in from left/right */
    ".reveal-ready .gallery-item[data-reveal=\"slide-left\"] { transform: translateX(-30px); }" +
    ".reveal-ready .gallery-item[data-reveal=\"slide-right\"] { transform: translateX(30px); }" +
    ".reveal-ready .gallery-item[data-reveal=\"slide-left\"].is-revealed," +
    ".reveal-ready .gallery-item[data-reveal=\"slide-right\"].is-revealed { transform: translateX(0) !important; }" +
    /* Story items: more dramatic */
    ".reveal-ready .timeline-item[data-reveal=\"slide-left\"] { transform: translateX(-60px); }" +
    ".reveal-ready .timeline-item[data-reveal=\"slide-right\"] { transform: translateX(60px); }" +
    /* Event cards: slower rise */
    ".reveal-ready .event-card[data-reveal=\"tilt-left\"] { transform: translateY(36px) rotate(-1deg); }" +
    ".reveal-ready .event-card[data-reveal=\"tilt-right\"] { transform: translateY(36px) rotate(1deg); }"
  );

  /* ─── 5. SWIPER/SLIDER: fade effect, slower speed ─── */
  var swiperPatched = false;
  function patchSwipers() {
    if (swiperPatched) return;
    swiperPatched = true;
    try {
      document.querySelectorAll(".swiper").forEach(function(el) {
        if (!el.swiper) return;
        var s = el.swiper;
        /* Slower autoplay for all — 1 foto tampil penuh dulu */
        if (s.params.autoplay) {
          s.params.autoplay.delay = 7000;
          if (typeof s.autoplay !== "undefined" && s.autoplay.running) {
            s.autoplay.stop();
          }
        }
        s.params.speed = 1800;
        /* Fade transition for smoother look */
        s.params.effect = "fade";
        s.params.fadeEffect = { crossFade: true };
        if (s.params.autoplay && s.autoplay.start) {
          s.autoplay.start();
        }
      });
    } catch(e) { /* Swiper not ready, ignore */ }
  }

  /* ─── 6. COUNTDOWN: cinematic lighter weight ─── */
  injectStyle("mm-cd",
    ".countdown--plain .countdown__item span { font-weight: 200; }" +
    ".countdown--plain { gap: 1.6rem; }"
  );

  /* ─── 7. MODAL: subtle slide-up ─── */
  injectStyle("mm-modal",
    ".modal:not([hidden]) .modal__panel {" +
    "  animation: mmModalIn 0.38s cubic-bezier(0.16,1,0.3,1);" +
    "}" +
    "@keyframes mmModalIn {" +
    "  from { transform: translateY(36px); opacity: 0; }" +
    "  to { transform: translateY(0); opacity: 1; }" +
    "}"
  );

  /* ─── 8. GALLERY: staggered reveal ─── */
  injectStyle("mm-gallery",
    ".reveal-ready .gallery-item[data-reveal] {" +
    "  transition-delay: calc(var(--reveal-i, 0) * 55ms + 0.15s);" +
    "}" +
    ".reveal-ready .gallery-item[data-reveal=\"pop\"] { transition-delay: calc(var(--reveal-i, 0) * 55ms + 0.1s); }"
  );

  /* ─── 9. COUPLE SLIDERS: ensure image visibility ─── */
  injectStyle("mm-couple",
    ".couple-slider .swiper-slide img { display: block; width: 100%; height: 100%; object-fit: cover; }"
  );

  /* ─── INIT ─── */
  function init() {
    /* NOTE: NO reorderSections() — classic DOM order is the canonical order.
       cover → opening → we-found-love → couple → event →
       livestream → quote → love-story → gallery → gift → rsvp → closing */

    patchOpenButton();
    startParallax();

    /* Foto hero di-inject async setelah payload Supabase; daftarkan ulang
       layer parallax begitu undangan dibuka (foto sudah pasti ada).
       __openCallbacks mungkin belum dibuat main.js saat template init —
       jangan asumsi, buat array dulu kalau belum ada. */
    if (!window.__openCallbacks) window.__openCallbacks = [];
    window.__openCallbacks.push(function() {
      setTimeout(function() {
        registerParallaxLayers();
        setTimeout(patchSwipers, 400);
      }, 600);
    });

    /* Also try patching after DOM settles */
    setTimeout(patchSwipers, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ─── CLEANUP ─── */
  return function cleanup() {
    if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
    /* Remove injected styles */
    injected.forEach(function(el) {
      if (el && el.parentNode) el.remove();
    });
    /* Reset parallax images + perspective wrapper */
    document.querySelectorAll(".parallax-layer").forEach(function(img) {
      img.style.transform = "";
      img.style.transition = "";
      img.style.willChange = "";
      img.style.backfaceVisibility = "";
      img.classList.remove("parallax-layer");
    });
    var wrap = document.getElementById("invitation");
    if (wrap) {
      wrap.style.perspective = "";
      wrap.style.perspectiveOrigin = "";
    }
    depthLayers = [];
  };
})();
