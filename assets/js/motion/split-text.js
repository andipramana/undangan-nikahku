/**
 * Toolkit Motion: Split Text
 * Memecah teks untuk animasi tipografi dengan aksesibilitas terjamin.
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

  function split(el, mode) {
    if (!el || el.dataset.splitDone === "true") return;
    const raw = el.textContent || "";
    const clean = raw.trim();
    if (!clean) return;

    if (isReducedMotion()) {
      el.dataset.splitDone = "true";
      return;
    }

    el.setAttribute("aria-label", clean);
    el.textContent = "";

    const chars = Array.from(raw);
    chars.forEach(function (ch, i) {
      const span = document.createElement("span");
      span.className = ch === " " ? "char char--space" : "char";
      span.textContent = ch === " " ? "\u00A0" : ch;
      span.style.setProperty("--char-i", String(i));
      span.setAttribute("aria-hidden", "true");
      el.appendChild(span);
    });

    el.dataset.splitDone = "true";
  }

  function init(root) {
    if (isReducedMotion()) return;
    const scope = root || document;
    if (scope.matches && scope.matches("[data-split-text]")) {
      split(scope);
    }
    const els = scope.querySelectorAll("[data-split-text]");
    for (let i = 0; i < els.length; i++) {
      split(els[i]);
    }
  }

  window.MotionSplitText = {
    split: split,
    init: init
  };
})();
