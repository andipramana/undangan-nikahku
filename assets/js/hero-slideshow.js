/** Cover/opening/closing: slideshow foto bergilir dengan efek Ken Burns +
 * crossfade (foto lama fade out bersamaan foto baru fade in, keduanya
 * overlap — diatur CSS .hero-slide per template).
 *
 * Foto diambil dari payload Supabase (folder cover/opening/closing) dengan
 * cadangan manifest lokal. Zoom per foto (--zoom) diterapkan lewat keyframe
 * Ken Burns di CSS — transform biasa akan ditimpa animasi (lihat style.css).
 *
 * Timing: foto tampil penuh selama `interval`, lalu transisi pelan (SLIDE_TRANSITION_MS),
 * lalu jeda penuh lagi sebelum foto berikutnya diganti. Section 2 (opening) tidak mulai
 * menghitung dari page load — slideshow-nya baru distart main.js saat foto pertamanya
 * sudah masuk, supaya foto pertama tetap bisa dilihat dulu. */
window.initHeroSlideshows = async function () {
  const cfg = window.WEDDING_CONFIG;
  const interval = cfg.heroSlideInterval || 7000;
  const SLIDE_TRANSITION_MS = 3200;

  // Muat foto ketiga slideshow sekaligus
  const [coverSlides, openingSlides, closingSlides] = await Promise.all([
    window.getPhotos("cover"),
    window.getPhotos("opening"),
    window.getPhotos("closing")
  ]);

  [
    ["cover", coverSlides],
    ["opening", openingSlides],
    ["closing", closingSlides]
  ].forEach(([key, slides]) => {
    const container = document.getElementById(`${key}-media`);
    const overlay = container && container.querySelector(".hero-overlay");
    if (!container || !(slides && slides.length)) return;

    slides.forEach((slide, i) => {
      const wrap = document.createElement("picture");
      wrap.className = "hero-slide" + (i === 0 ? " active" : "");
      const rawSrc = slide.path && !slide.webp ? window.photoUrl(slide.path) : slide.webp || slide.jpg;
      const src = rawSrc && rawSrc.startsWith("assets/img/") ? rawSrc.replace(/\.(jpe?g|png)$/i, ".webp") : rawSrc;
      const srcset = slide.path && window.photoSrcset ? window.photoSrcset(slide.path) : "";
      const srcsetAttr = srcset ? ` srcset="${srcset}" sizes="(max-width: 480px) 100vw, 430px"` : "";
      // --zoom di baca keyframe kenburns (scale dari --zoom ke --zoom*1.15)
      const fx = slide.focalX ?? 50;
      const fy = slide.focalY ?? 50;
      const zoom = slide.zoom ?? 1;
      // Cuma foto cover PERTAMA yang boleh eager + fetchpriority=high + decoding=sync
      // (kandidat LCP). Semua foto lainnya wajib loading="lazy" decoding="async".
      const eager = key === "cover" && i === 0;
      const loadAttrs = eager
        ? ' fetchpriority="high" loading="eager" decoding="sync"'
        : ' loading="lazy" decoding="async"';
      wrap.innerHTML = `
        <source srcset="${srcset || src}" type="image/webp">
        <img class="kenburns" src="${src}"${srcsetAttr} alt=""${loadAttrs} width="430" height="764"
             style="--fx:${fx}%; --fy:${fy}%; --zoom:${zoom}">
      `;
      container.insertBefore(wrap, overlay);
    });

    if (slides.length > 1) {
      const items = container.querySelectorAll(".hero-slide");
      let index = 0;
      const cycleInterval = key === "opening"
        ? (cfg.heroSlideIntervalOpening || 2200)
        : interval;
      const transitionMs = key === "opening"
        ? (cfg.heroSlideTransitionOpening || 1200)
        : SLIDE_TRANSITION_MS;

      let awake = key === "opening";
      let awakeSince = 0;
      const setAwake = (on) => {
        if (on && !awake) awakeSince = performance.now();
        awake = on;
        container.classList.toggle("hero-media--paused", !on);
      };

      if (key === "closing" && "IntersectionObserver" in window) {
        setAwake(false);
        new IntersectionObserver(
          (entries) => entries.forEach((e) => setAwake(e.isIntersecting)),
          { rootMargin: "25% 0px 25% 0px" }
        ).observe(document.getElementById("closing"));
      } else if (key === "cover") {
        const coverEl = document.getElementById("cover");
        setAwake(true);
        if (coverEl) {
          coverEl.addEventListener("transitionend", () => {
            if (coverEl.classList.contains("is-exiting")) setAwake(false);
          });
        }
      } else {
        setAwake(true);
      }

      function cycle() {
        if (!awake) {
          setTimeout(cycle, 1000);
          return;
        }
        const held = performance.now() - awakeSince;
        if (held < cycleInterval) {
          setTimeout(cycle, cycleInterval - held);
          return;
        }
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
          current.offsetHeight;
          current.style.transition = "";
        }, transitionMs);

        index = nextIndex;
        setTimeout(cycle, cycleInterval + transitionMs);
      }

      function start(firstDelay) {
        setTimeout(cycle, firstDelay);
      }

      if (key === "opening") {
        const OPENING_FIRST_DELAY = 1500;
        window.startOpeningSlideshow = () => start(OPENING_FIRST_DELAY);
        if (window.__openingStartQueued) start(OPENING_FIRST_DELAY);
      } else {
        start(interval);
      }
    }
  });

  const std2Media = document.getElementById("save-the-date-2-media");
  if (std2Media) {
    const std2Slides = await window.getPhotos("std2");
    const slide = (std2Slides && std2Slides[0]) ||
      (openingSlides && openingSlides.length && openingSlides[openingSlides.length - 1]);
    if (slide) {
      const rawSrc = slide.path && !slide.webp ? window.photoUrl(slide.path) : slide.webp || slide.jpg;
      const src = rawSrc && rawSrc.startsWith("assets/img/") ? rawSrc.replace(/\.(jpe?g|png)$/i, ".webp") : rawSrc;
      std2Media.style.backgroundImage = `url("${src}")`;
    }
  }
};
