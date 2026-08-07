/** Cover/opening/closing: slideshow foto bergilir dengan efek Ken Burns + slide filmstrip
 * (foto lama geser keluar ke kiri, foto baru masuk dari kanan — sempat kelihatan
 * bersebelahan saat transisi, bukan crossfade opacity). */
window.initHeroSlideshows = function () {
  const cfg = window.WEDDING_CONFIG;
  const interval = cfg.heroSlideInterval || 4500;
  const SLIDE_TRANSITION_MS = 3200;

  ["cover", "opening", "closing"].forEach((key) => {
    const container = document.getElementById(`${key}-media`);
    const overlay = container && container.querySelector(".hero-overlay");
    const slides = (cfg.hero && cfg.hero[key]) || [];
    if (!container || !slides.length) return;

    slides.forEach((slide, i) => {
      const wrap = document.createElement("picture");
      wrap.className = "hero-slide" + (i === 0 ? " active" : "");
      wrap.innerHTML = `
        <source srcset="${slide.webp}" type="image/webp">
        <img class="kenburns" src="${slide.jpg}" alt="">
      `;
      container.insertBefore(wrap, overlay);
    });

    if (slides.length > 1) {
      let index = 0;
      setInterval(() => {
        const items = container.querySelectorAll(".hero-slide");
        const current = items[index];
        const nextIndex = (index + 1) % items.length;
        const next = items[nextIndex];

        current.classList.remove("active");
        current.classList.add("exiting");
        next.classList.add("active");

        setTimeout(() => {
          current.classList.remove("exiting");
          current.style.transition = "none";
          // eslint-disable-next-line no-unused-expressions
          current.offsetHeight; // force reflow supaya reset posisi tidak animasi/terlihat
          current.style.transition = "";
        }, SLIDE_TRANSITION_MS);

        index = nextIndex;
      }, interval);
    }
  });
};
