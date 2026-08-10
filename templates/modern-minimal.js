/** Modern Minimal — complete JS behaviour override.
 *  Runs AFTER all default modules. Patches cover, reveal,
 *  slider, parallax. Returns cleanup for template switch. */
return (function() {
  "use strict";

  /* ─── 1. COVER EXIT: slide LEFT (bukan up), buka Save The Date di belakang ─── */
  const coverStyle = document.createElement("style");
  coverStyle.id = "modern-cover";
  coverStyle.textContent = `
    #cover { position: fixed !important; inset: 0; z-index: 100; }
    #cover.cover-visible { transform: translateX(0); opacity: 1; }
    #cover.is-exiting { transform: translateX(-105%) !important; opacity: 1; transition: transform 0.85s cubic-bezier(0.5,0,0.75,0), opacity 0.3s ease; pointer-events: none; }
    #invitation.is-locked .invitation-body { display: none; }
    .is-locked { overflow: hidden; }
    /* Opening langsung terlihat — di belakang cover */
    #opening { opacity: 1 !important; transform: none !important; }
    #opening .hero-media img { transform: none !important; }
    #opening .hero-content { opacity: 1 !important; }
  `;
  document.head.appendChild(coverStyle);

  /* Override setupOpenButton di main.js — slide left, langsung reveal opening */
  function patchOpenButton() {
    var btn = document.getElementById("btn-open");
    var invitation = document.getElementById("invitation");
    var cover = document.getElementById("cover");
    var opening = document.getElementById("opening");
    if (!btn || !cover) return;

    // Remove old listener (clone node)
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

      // Opening: langsung tampil, fade in cepat
      if (opening) {
        opening.style.opacity = "1";
        opening.style.transition = "opacity 0.4s ease";
        opening.querySelectorAll(".text-enter").forEach(function(el) {
          el.style.opacity = "1";
          el.style.transform = "none";
          el.style.transition = "opacity 0.6s ease, transform 0.6s cubic-bezier(.16,1,.3,1)";
        });
        if (window.startOpeningSlideshow) window.startOpeningSlideshow();
        else window.__openingStartQueued = true;
      }

      // Cover: slide keluar kiri
      cover.classList.add("is-exiting");
      cover.addEventListener("transitionend", function() {
        if (window.revealScan) window.revealScan();
      }, { once: true });
    });
  }

  /* ─── 2. PARALLAX SCROLL — depth via translateY per layer ─── */
  var parallaxRaf = null;
  function startParallax() {
    var scroller = document.querySelector(".app-frame__scroll");
    if (!scroller) return;

    // Add depth to hero images
    var heroImgs = document.querySelectorAll(".hero-media img");
    heroImgs.forEach(function(img) {
      img.style.willChange = "transform";
    });

    function tick() {
      var st = scroller.scrollTop;
      heroImgs.forEach(function(img) {
        var section = img.closest("section");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        // Only transform if section is visible
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          var y = progress * 40; // subtle 40px parallax
          img.style.transform = "translate3d(0," + y + "px,0)";
          img.style.transition = "none";
        }
      });
      parallaxRaf = requestAnimationFrame(tick);
    }
    parallaxRaf = requestAnimationFrame(tick);
  }

  /* ─── 3. REVEAL OVERRIDE — per element custom animations ─── */
  var revealStyle = document.createElement("style");
  revealStyle.id = "modern-reveal-js";
  revealStyle.textContent = `
    /* Staggered delay — lebih lambat, cinematic */
    .reveal-ready [data-reveal] { --reveal-delay-ms: 100ms; }
    /* Couple section — slide dari kiri-kanan */
    .reveal-ready [data-reveal="enter-right"] { transition-duration: 2s !important; }
    .reveal-ready [data-reveal="enter-left"] { transition-duration: 2s !important; }
    /* Event cards — slow rise */
    .reveal-ready [data-reveal="tilt-left"],
    .reveal-ready [data-reveal="tilt-right"] { transition-duration: 1.3s !important; }
    /* Gallery items — each unique */
    .reveal-ready .gallery-item[data-reveal] { transition-duration: 0.7s !important; }
    .reveal-ready .gallery-item[data-reveal]:nth-child(odd) { transform: translateX(-25px); }
    .reveal-ready .gallery-item[data-reveal]:nth-child(even) { transform: translateX(25px); }
    .reveal-ready .gallery-item[data-reveal].is-revealed { transform: translateX(0) !important; }
  `;
  document.head.appendChild(revealStyle);

  /* ─── 4. SWIPER: slow fade transition ─── */
  setTimeout(function() {
    document.querySelectorAll(".swiper").forEach(function(s) {
      if (s.swiper && s.swiper.params.autoplay) {
        s.swiper.params.autoplay.delay = 5000;
        s.swiper.params.speed = 1500; /* slower */
        s.swiper.params.effect = "fade";
        s.swiper.params.fadeEffect = { crossFade: true };
        s.swiper.autoplay.start();
      }
    });
  }, 600);

  /* ─── 5. COUNTDOWN: lighter, cinematic ─── */
  var cdStyle = document.createElement("style");
  cdStyle.id = "modern-cd";
  cdStyle.textContent = `
    .countdown--plain .countdown__item span { font-weight: 200; font-size: 2.5rem; }
    .countdown--plain .countdown__item { min-width: 50px; }
  `;
  document.head.appendChild(cdStyle);

  /* ─── 6. MODAL: slide-in from bottom ─── */
  var modalStyle = document.createElement("style");
  modalStyle.id = "modern-modal";
  modalStyle.textContent = `
    .modal:not([hidden]) .modal__panel {
      animation: modalSlideUp 0.4s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes modalSlideUp {
      from { transform: translateY(40px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(modalStyle);

  /* ─── INIT: tunggu DOM siap ─── */
  function init() {
    patchOpenButton();
    startParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ─── CLEANUP ─── */
  return function cleanup() {
    if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
    [coverStyle, revealStyle, cdStyle, modalStyle].forEach(function(el) {
      if (el && el.parentNode) el.remove();
    });
    // Reset parallax images
    document.querySelectorAll(".hero-media img").forEach(function(img) {
      img.style.transform = "";
      img.style.willChange = "";
    });
  };
})();
