/**
 * Toolkit Motion: Reveal
 * Pewaris assets/js/reveal.js dengan dukungan varian baru (mask-wipe, clip-up,
 * clip-left, char-stagger) dan optimasi will-change dinamis.
 */
(function () {
  "use strict";

  const HIDDEN = "[data-reveal]:not(.is-revealed)";
  const GROUP = "[data-reveal-group]";
  const STEP_MS = 40;
  const MAX_CLIMB = 30;
  const seen = new WeakSet();
  let observer = null;
  let early = null;
  let fullyVisible = null;
  let started = false;
  let animate = true;

  const UNIT_MAX = { date: 31, hour: 24, minute: 60, second: 60 };

  function isReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function countUp(el) {
    const raw = el.textContent.trim();
    if (!/^\d+$/.test(raw)) return;
    const target = parseInt(raw, 10);
    if (!Number.isFinite(target) || target <= 1) return;
    const maxVal = UNIT_MAX[el.dataset.count] ?? null;
    let lo = maxVal != null ? 1 : Math.max(1, target - MAX_CLIMB);
    const top = maxVal != null ? Math.min(maxVal, target + 6) : target + 5;
    if (top - lo > MAX_CLIMB) lo = top - MAX_CLIMB;
    const upSteps = top - lo;
    const downSteps = top - target;
    const total = upSteps + downSteps;
    const t0 = performance.now();
    let lastK = -1;
    (function frame(now) {
      const k = Math.floor((now - t0) / STEP_MS);
      if (k >= total) {
        el.textContent = String(target);
        return;
      }
      if (k !== lastK) {
        lastK = k;
        el.textContent = String(k < upSteps ? lo + k : top - (k - upSteps));
      }
      requestAnimationFrame(frame);
    })(t0);
  }

  function reveal(el) {
    if (el.classList.contains("is-revealed")) return;

    if (animate) {
      el.style.willChange = "transform, opacity";
      const cleanWillChange = function () {
        el.style.willChange = "";
        el.removeEventListener("transitionend", cleanWillChange);
      };
      el.addEventListener("transitionend", cleanWillChange);
      setTimeout(cleanWillChange, 1600);
    }

    const variant = el.getAttribute("data-reveal");
    if (variant === "char-stagger" && window.MotionSplitText && typeof window.MotionSplitText.split === "function") {
      window.MotionSplitText.split(el);
    }

    el.classList.add("is-revealed");
    if (animate && el.hasAttribute("data-count")) countUp(el);
  }

  function revealGroup(el) {
    if (el.hasAttribute("data-reveal")) reveal(el);
    el.querySelectorAll(HIDDEN).forEach(reveal);
  }

  function revealAll(root) {
    const r = root || document;
    if (r.matches && r.matches(HIDDEN)) reveal(r);
    r.querySelectorAll(HIDDEN).forEach(reveal);
  }

  function insideGroup(el) {
    const g = el.closest(GROUP);
    return !!g && g !== el;
  }

  function fire(el) {
    if (el.matches(GROUP)) revealGroup(el);
    else reveal(el);
    if (observer) observer.unobserve(el);
    if (early) early.unobserve(el);
    if (fullyVisible) fullyVisible.unobserve(el);
  }

  function register(el) {
    if (seen.has(el)) return;
    seen.add(el);
    (el.hasAttribute("data-reveal-early") ? early : observer).observe(el);
    fullyVisible.observe(el);
  }

  window.revealScan = function (root) {
    if (!started) return;
    if (!observer) {
      revealAll(root);
      return;
    }
    const r = root || document;
    if (r.matches && r.matches(GROUP)) register(r);
    r.querySelectorAll(GROUP).forEach(register);
    r.querySelectorAll(HIDDEN).forEach(function (el) {
      if (!insideGroup(el)) register(el);
    });
  };

  window.revealNow = function (root) {
    const r = root || document;
    if (!observer) {
      revealAll(r);
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (r.matches && r.matches(GROUP)) fire(r);
        r.querySelectorAll(GROUP).forEach(fire);
        r.querySelectorAll(HIDDEN).forEach(function (el) {
          if (!insideGroup(el)) fire(el);
        });
      });
    });
  };

  window.refreshReveal = window.revealScan;

  window.initReveal = function () {
    if (window.AOS) {
      AOS.init({ duration: 1600, once: true, offset: 60, easing: "ease" });
    }

    document.documentElement.classList.add("reveal-ready");
    started = true;

    if (isReducedMotion() || !("IntersectionObserver" in window)) {
      animate = false;
      revealAll();
      return;
    }

    const onIntersect = function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) fire(entry.target);
      });
    };

    observer = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px -45% 0px",
      threshold: 0
    });

    early = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px -5% 0px",
      threshold: 0
    });

    fullyVisible = new IntersectionObserver(onIntersect, { threshold: 0.99 });

    window.revealScan();
  };
})();
