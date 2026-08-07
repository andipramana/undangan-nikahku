/** Cover/opening/closing: slideshow foto bergilir dengan efek Ken Burns + crossfade. */
window.initHeroSlideshows = function () {
  const cfg = window.WEDDING_CONFIG;
  const interval = cfg.heroSlideInterval || 4500;

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
        items[index].classList.remove("active");
        index = (index + 1) % items.length;
        items[index].classList.add("active");
      }, interval);
    }
  });
};
