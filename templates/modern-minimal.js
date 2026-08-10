/** Modern Minimal — JS behaviour (Goodchoice-inspired)
 *  Dark cinematic, slow elegant reveals, smooth transitions.
 *  Return cleanup function untuk switch template. */
return (function() {
  "use strict";

  /* ─── Reveal timing — slow & elegant ─── */
  const revealCSS = document.createElement("style");
  revealCSS.id = "modern-reveal-timing";
  revealCSS.textContent = `
    .reveal-ready [data-reveal] { --reveal-delay-ms: 80ms; }
    .reveal-ready [data-reveal="up"].is-revealed { transition-duration: 0.9s; }
    .reveal-ready [data-reveal="zoom"].is-revealed { transition-duration: 1s; }
    .reveal-ready [data-reveal="pop"].is-revealed { transition-duration: 0.65s; }
    .reveal-ready [data-reveal="slide-right"],
    .reveal-ready [data-reveal="slide-left"] { transition-duration: 0.85s; }
    .reveal-ready [data-reveal="enter-right"],
    .reveal-ready [data-reveal="enter-left"] { transition-duration: 2.2s; }
  `;
  document.head.appendChild(revealCSS);

  /* ─── Swiper — slow autoplay, fade effect ─── */
  const swiperCSS = document.createElement("style");
  swiperCSS.id = "modern-swiper";
  swiperCSS.textContent = `
    .swiper-wrapper { transition-timing-function: cubic-bezier(0.16,1,0.3,1) !important; }
  `;
  document.head.appendChild(swiperCSS);

  setTimeout(function() {
    document.querySelectorAll(".swiper").forEach(function(s) {
      if (s.swiper && s.swiper.params.autoplay) {
        s.swiper.params.autoplay.delay = 4500; /* slower, more cinematic */
        s.swiper.params.speed = 1200; /* slower transition */
        s.swiper.autoplay.start();
      }
    });
  }, 800);

  /* ─── Gallery — single column + natural gap ─── */
  const galleryEl = document.getElementById("gallery-wrapper");
  if (galleryEl) {
    galleryEl.style.display = "flex";
    galleryEl.style.flexDirection = "column";
    galleryEl.style.gap = "2px";
    galleryEl.style.background = "#1a1816";
  }

  /* ─── Event card — remove section padding, full-bleed ─── */
  const eventSection = document.getElementById("event");
  if (eventSection) {
    eventSection.style.padding = "0";
  }

  /* ─── Countdown — clean spacing ─── */
  const cdCSS = document.createElement("style");
  cdCSS.id = "modern-countdown";
  cdCSS.textContent = `
    .countdown__item { min-width: 44px; }
    .countdown__item span { font-weight: 200; }
  `;
  document.head.appendChild(cdCSS);

  /* ─── Cleanup ─── */
  return function cleanup() {
    [revealCSS, swiperCSS, cdCSS].forEach(function(el) {
      if (el && el.parentNode) el.remove();
    });
    if (galleryEl) {
      galleryEl.style.display = "";
      galleryEl.style.flexDirection = "";
      galleryEl.style.gap = "";
      galleryEl.style.background = "";
    }
    if (eventSection) {
      eventSection.style.padding = "";
    }
  };
})();
