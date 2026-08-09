(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealItems = [...document.querySelectorAll(".reveal")];
  const parallaxItems = [...document.querySelectorAll("[data-parallax]")];

  function showEverything() {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    parallaxItems.forEach((item) => { item.style.transform = ""; });
  }

  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    showEverything();
    return;
  }

  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.01, rootMargin: "0px 0px 0px 0px" });
  revealItems.forEach((item) => observer.observe(item));

  let frame = 0;
  function updateParallax() {
    frame = 0;
    const viewportMid = window.innerHeight / 2;
    parallaxItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const speed = Number(item.dataset.parallax || 0);
      const offset = Math.max(-18, Math.min(18, (rect.top + rect.height / 2 - viewportMid) * speed));
      item.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    });
  }
  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(updateParallax);
  }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  requestUpdate();

  reduceMotion.addEventListener?.("change", (event) => {
    if (!event.matches) return;
    showEverything();
    window.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("resize", requestUpdate);
  });
})();
