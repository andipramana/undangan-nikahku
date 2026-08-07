/** Scroll-reveal animation (AOS) — inisialisasi & refresh setelah konten dinamis dimuat. */
window.initReveal = function () {
  if (window.AOS) {
    AOS.init({ duration: 1600, once: true, offset: 60, easing: "ease" });
  }
};

window.refreshReveal = function () {
  if (window.AOS) AOS.refresh();
};
