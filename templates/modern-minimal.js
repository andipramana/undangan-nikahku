/** Modern Minimal — JS behaviour overrides.
 *  Dijalankan SETELAH semua modul init (main.js + reveal.js + dll).
 *  Return cleanup function untuk switch template. */
return (function() {
  "use strict";

  /* ─── Reveal: ganti timing global ─── */
  // Lebih cepat dari default (0.7s vs 1.2s), lebih snappy
  const fastReveal = document.createElement("style");
  fastReveal.textContent = `
    .reveal-ready [data-reveal="up"]    { transition-duration: 0.55s !important; }
    .reveal-ready [data-reveal="down"]  { transition-duration: 0.55s !important; }
    .reveal-ready [data-reveal="pop"]   { transition-duration: 0.45s !important; }
    .reveal-ready [data-reveal="fade"]  { transition-duration: 0.5s !important; }
    .reveal-ready [data-reveal="slide-right"],
    .reveal-ready [data-reveal="slide-left"] { transition-duration: 0.6s !important; }
    .reveal-ready [data-reveal="zoom"]  { transition-duration: 0.7s !important; }
    .reveal-ready [data-reveal="enter-right"],
    .reveal-ready [data-reveal="enter-left"] { transition-duration: 1.8s !important; }
    /* Reveal delay: lebih pendek antar elemen */
    .reveal-ready [data-reveal] { --reveal-delay-ms: 50ms; }
  `;
  document.head.appendChild(fastReveal);

  /* ─── Swiper: autoplay lebih cepat ─── */
  // Override Swiper autoplay delay menjadi 3.5s (default 5s)
  const origInit = window.initWeFoundLove;
  if (origInit) {
    window.initWeFoundLove = function() {
      origInit();
      // Tunggu sebentar lalu set autoplay
      setTimeout(() => {
        document.querySelectorAll(".swiper").forEach(function(s) {
          if (s.swiper && s.swiper.params.autoplay) {
            s.swiper.params.autoplay.delay = 3500;
          }
        });
      }, 500);
    };
  }

  /* ─── Countdown: animasi lebih cepat ─── */
  // Override countdown layout spacing
  const cdStyle = document.createElement("style");
  cdStyle.textContent = `
    .countdown--plain .countdown__item { min-width: 48px; }
    .countdown--plain .countdown__item span { font-size: 2rem; font-weight: 200; }
  `;
  cdStyle.id = "modern-countdown-style";
  document.head.appendChild(cdStyle);

  /* ─── Gallery: grid 3-kolom (override 2-kolom CSS) ─── */
  const galleryStyle = document.createElement("style");
  galleryStyle.textContent = `
    @media (min-width: 431px) {
      .gallery-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 3px !important; }
    }
  `;
  galleryStyle.id = "modern-gallery-style";
  document.head.appendChild(galleryStyle);

  /* ─── Cleanup ─── */
  return function cleanup() {
    if (fastReveal.parentNode) fastReveal.remove();
    if (cdStyle.parentNode) cdStyle.remove();
    if (galleryStyle.parentNode) galleryStyle.remove();
    if (window.initWeFoundLove === window.initWeFoundLove) {
      window.initWeFoundLove = origInit;
    }
  };
})();
