/**
 * Toolkit Motion: Scroll Scene & Parallax
 * Mengatur adegan berbasis scroll dalam satu loop requestAnimationFrame global.
 */
(function () {
  "use strict";

  function isReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  const scenes = [];
  let scheduled = false;
  let scrollContainer = null;
  let listenersAttached = false;

  function getScroller() {
    if (!scrollContainer || !scrollContainer.isConnected) {
      scrollContainer = document.querySelector(".app-frame__scroll");
    }
    return scrollContainer;
  }

  function updateScenes() {
    scheduled = false;
    if (isReducedMotion()) return;

    const scroller = getScroller();
    const scrollerRect = scroller ? scroller.getBoundingClientRect() : null;
    const vh = scrollerRect ? scrollerRect.height : (window.innerHeight || document.documentElement.clientHeight || 800);
    const scrollerTop = scrollerRect ? scrollerRect.top : 0;

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const el = s.el;
      if (!el || !el.isConnected) continue;

      const rect = el.getBoundingClientRect();
      const elTop = rect.top - scrollerTop;
      const elH = rect.height || 1;
      const travel = vh + elH;
      const progressRaw = (vh - elTop) / travel;
      const progress = Math.max(0, Math.min(1, progressRaw));
      const inView = rect.bottom >= scrollerTop && rect.top <= (scrollerTop + vh);

      if (inView) {
        if (!s.active) {
          s.active = true;
          el.style.willChange = "transform";
        }
      } else {
        if (s.active) {
          s.active = false;
          el.style.willChange = "auto";
        }
      }

      if (typeof s.callback === "function") {
        s.callback(progress, el);
      }
    }
  }

  function requestTick() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateScenes);
    }
  }

  function attachListeners() {
    if (listenersAttached || typeof window === "undefined") return;
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick, { passive: true });

    const scroller = getScroller();
    if (scroller) {
      scroller.addEventListener("scroll", requestTick, { passive: true });
    }
    listenersAttached = true;
  }

  function register(el, callback, options) {
    if (!el) return function () {};
    attachListeners();

    if (isReducedMotion()) {
      if (typeof callback === "function") callback(1, el);
      if (el.hasAttribute("data-scroll-mask")) {
        el.style.setProperty("--scroll-progress", "1");
      }
      return function () {};
    }

    const scene = {
      el: el,
      callback: callback,
      options: options || {},
      active: false
    };
    scenes.push(scene);
    requestTick();

    return function unregister() {
      const idx = scenes.indexOf(scene);
      if (idx !== -1) scenes.splice(idx, 1);
      el.style.willChange = "auto";
    };
  }

  function initScrollScenes(root) {
    attachListeners();
    const scope = root || document;

    if (isReducedMotion()) {
      const masks = scope.querySelectorAll("[data-scroll-mask]");
      masks.forEach(function (m) {
        m.style.setProperty("--scroll-progress", "1");
      });
      return;
    }

    // Parallax speed
    const parallaxEls = scope.querySelectorAll("[data-parallax-speed]");
    parallaxEls.forEach(function (el) {
      const speed = parseFloat(el.getAttribute("data-parallax-speed")) || 0.2;
      register(el, function (progress) {
        const offset = (progress - 0.5) * speed * 200;
        el.style.transform = "translate3d(0, " + offset.toFixed(2) + "px, 0)";
      });
    });

    // Scroll mask
    const maskEls = scope.querySelectorAll("[data-scroll-mask]");
    maskEls.forEach(function (el) {
      register(el, function (progress) {
        el.style.setProperty("--scroll-progress", progress.toFixed(3));
      });
    });

    // General scroll scenes
    const sceneEls = scope.querySelectorAll("[data-scroll-scene]");
    sceneEls.forEach(function (el) {
      if (!el.hasAttribute("data-parallax-speed") && !el.hasAttribute("data-scroll-mask")) {
        register(el, function (progress) {
          el.style.setProperty("--scroll-scene-progress", progress.toFixed(3));
        });
      }
    });
  }

  window.MotionScrollScene = {
    register: register,
    init: initScrollScenes,
    update: requestTick
  };
  window.initScrollScenes = initScrollScenes;
})();
