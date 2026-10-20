(function () {
  "use strict";

  function isReduced() {
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function animate(el, opts) {
    if (!el) return;
    opts = opts || {};
    const raw = (el.dataset.countTarget || el.getAttribute("data-count") || el.getAttribute("data-counter") || el.textContent || "").trim();
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return;
    const target = parseFloat(match[0]);
    if (!Number.isFinite(target)) return;

    if (isReduced() || opts.immediate) {
      el.textContent = String(target);
      if (typeof opts.onComplete === "function") opts.onComplete(target);
      return;
    }

    const duration = typeof opts.duration === "number" ? opts.duration : 1200;
    const start = typeof opts.start === "number" ? opts.start : 0;
    const decimals = opts.decimals !== undefined ? opts.decimals : (match[0].includes(".") ? match[0].split(".")[1].length : 0);
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * ease;
      el.textContent = current.toFixed(decimals);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = String(target);
        if (typeof opts.onComplete === "function") opts.onComplete(target);
      }
    }

    requestAnimationFrame(update);
  }

  function init(root) {
    const scope = root || document;
    const els = scope.querySelectorAll("[data-count], [data-counter]");
    for (let i = 0; i < els.length; i++) animate(els[i]);
  }

  window.MotionCounter = { animate, init };
})();
