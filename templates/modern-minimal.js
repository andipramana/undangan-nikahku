/** Modern Minimal — complete JS behaviour override.
 *  Runs AFTER all default modules. Patches cover, reveal,
 *  slider, parallax, section order. Returns cleanup. */
return (function() {
  "use strict";

  /* ─── 1. COVER EXIT: slide LEFT, opening langsung terlihat ─── */
  var coverStyle = document.createElement("style");
  coverStyle.id = "mm-cover";
  coverStyle.textContent =
    "#cover { position: fixed !important; inset: 0; z-index: 100; }" +
    "#cover.cover-visible { transform: translateX(0); opacity: 1; }" +
    "#cover.is-exiting { transform: translateX(-105%) !important; opacity: 1; transition: transform 0.85s cubic-bezier(0.5,0,0.75,0); pointer-events: none; }" +
    "#invitation.is-locked .invitation-body { display: none; }" +
    "#opening { opacity: 1 !important; transform: none !important; }" +
    "#opening .hero-media img { transform: none !important; }" +
    "#opening .hero-content { opacity: 1 !important; }";
  document.head.appendChild(coverStyle);

  /* Override setupOpenButton dari main.js — slide left, opening reveal langsung */
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

  /* ─── 2. SECTION REORDER — different from classic ─── */
  function reorderSections() {
    var body = document.querySelector(".invitation-body");
    if (!body) return;
    /* Must include ALL sections including closing, or appendChild
       leaves unmoved elements BEFORE moved ones (since original
       closing is the last child, appendChild puts moved elements
       after it). */
    var order = [
      "opening",
      "we-found-love",
      "gallery",       /* gallery right after wfl */
      "event",         /* event before couple */
      "couple",
      "livestream",
      "quote",
      "love-story",
      "gift",
      "rsvp",
      "closing"        /* always last */
    ];
    order.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) body.appendChild(el);
    });
  }

  /* ─── 3. PARALLAX SCROLL — subtle depth via translateY per hero image ─── */
  var parallaxRaf = null;
  function startParallax() {
    var scroller = document.querySelector(".app-frame__scroll");
    if (!scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var heroImgs = document.querySelectorAll(".hero-media img, .quote-section img");
    heroImgs.forEach(function(img) {
      img.style.willChange = "transform";
      img.style.backfaceVisibility = "hidden";
    });

    function tick() {
      heroImgs.forEach(function(img) {
        var section = img.closest("section, .quote-section");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          var y = progress * 35; /* subtle 35px max parallax */
          img.style.transform = "translate3d(0," + y + "px,0)";
          img.style.transition = "none";
        }
      });
      parallaxRaf = requestAnimationFrame(tick);
    }
    parallaxRaf = requestAnimationFrame(tick);
  }

  /* ─── 4. REVEAL OVERRIDE — cinematic timing per element ─── */
  var revealStyle = document.createElement("style");
  revealStyle.id = "mm-reveal";
  revealStyle.textContent =
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
    ".reveal-ready .event-card[data-reveal=\"tilt-right\"] { transform: translateY(36px) rotate(1deg); }";
  document.head.appendChild(revealStyle);

  /* ─── 5. SWIPER/SLIDER: slower, fade effect ─── */
  var swiperPatched = false;
  function patchSwipers() {
    if (swiperPatched) return;
    swiperPatched = true;
    try {
      document.querySelectorAll(".swiper").forEach(function(el) {
        if (!el.swiper) return;
        var s = el.swiper;
        /* Override existing params */
        if (s.params.autoplay) {
          s.params.autoplay.delay = 5000;
          if (typeof s.autoplay !== "undefined" && s.autoplay.running) {
            s.autoplay.stop();
          }
        }
        s.params.speed = 1500;
        s.params.effect = "fade";
        s.params.fadeEffect = { crossFade: true };
        if (s.params.autoplay && s.autoplay.start) {
          s.autoplay.start();
        }
      });
    } catch(e) { /* Swiper not ready, ignore */ }
  }

  /* ─── 6. COUNTDOWN: cinematic lighter weight ─── */
  var cdStyle = document.createElement("style");
  cdStyle.id = "mm-cd";
  cdStyle.textContent =
    ".countdown--plain .countdown__item span { font-weight: 200; }" +
    ".countdown--plain { gap: 1.6rem; }";
  document.head.appendChild(cdStyle);

  /* ─── 7. MODAL: subtle slide-up ─── */
  var modalStyle = document.createElement("style");
  modalStyle.id = "mm-modal";
  modalStyle.textContent =
    ".modal:not([hidden]) .modal__panel {" +
    "  animation: mmModalIn 0.38s cubic-bezier(0.16,1,0.3,1);" +
    "}" +
    "@keyframes mmModalIn {" +
    "  from { transform: translateY(36px); opacity: 0; }" +
    "  to { transform: translateY(0); opacity: 1; }" +
    "}";
  document.head.appendChild(modalStyle);

  /* ─── 8. GALLERY: staggered reveal ─── */
  var galleryStyle = document.createElement("style");
  galleryStyle.id = "mm-gallery";
  galleryStyle.textContent =
    ".reveal-ready .gallery-item[data-reveal] {" +
    "  transition-delay: calc(var(--reveal-i, 0) * 55ms + 0.15s);" +
    "}";
  document.head.appendChild(galleryStyle);

  /* ─── INIT ─── */
  function init() {
    reorderSections();
    patchOpenButton();
    startParallax();

    /* Patch swipers after they initialize (they're created on open click or
       via __openCallbacks) */
    var origPush = (window.__openCallbacks || []).push;
    if (window.__openCallbacks) {
      window.__openCallbacks.push(function() {
        setTimeout(patchSwipers, 400);
      });
    }

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
    [coverStyle, revealStyle, cdStyle, modalStyle, galleryStyle].forEach(function(el) {
      if (el && el.parentNode) el.remove();
    });
    /* Reset parallax images */
    document.querySelectorAll(".hero-media img, .quote-section img").forEach(function(img) {
      img.style.transform = "";
      img.style.willChange = "";
      img.style.backfaceVisibility = "";
    });
  };
})();
