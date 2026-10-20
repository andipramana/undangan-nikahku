/**
 * Toolkit Motion: Drag & Swipe Gesture
 * Mengatur gestur seret dan lempeng kartu menggunakan Pointer Events dengan inersia halus.
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

  function bind(el, opts) {
    if (!el) return function () {};
    opts = opts || {};
    el.style.touchAction = "pan-y";

    if (isReducedMotion()) {
      return function () {};
    }

    let active = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let vx = 0;
    let vy = 0;
    let pointerId = null;
    const threshold = opts.threshold || 90;

    function onPointerDown(e) {
      if (isReducedMotion()) return;
      if (e.button !== undefined && e.button !== 0) return;
      active = true;
      pointerId = e.pointerId;
      try {
        el.setPointerCapture(pointerId);
      } catch (err) {}

      el.style.willChange = "transform";
      el.style.transition = "none";

      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = performance.now();
      vx = 0;
      vy = 0;

      if (typeof opts.onStart === "function") {
        opts.onStart({ el: el, x: startX, y: startY });
      }
    }

    function onPointerMove(e) {
      if (!active || e.pointerId !== pointerId) return;
      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 10) {
        vx = (e.clientX - lastX) / dt;
        vy = (e.clientY - lastY) / dt;
        lastX = e.clientX;
        lastY = e.clientY;
        lastTime = now;
      }

      const dx = e.clientX - startX;
      const dy = opts.axis === "x" ? 0 : e.clientY - startY;
      const rot = (dx * 0.06).toFixed(2);

      el.style.transform = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px, 0) rotate(" + rot + "deg)";

      if (typeof opts.onDrag === "function") {
        opts.onDrag({ el: el, dx: dx, dy: dy, vx: vx, vy: vy });
      }
    }

    function endDrag(e) {
      if (!active || (e && e.pointerId !== pointerId)) return;
      active = false;
      try {
        if (pointerId !== null) el.releasePointerCapture(pointerId);
      } catch (err) {}
      pointerId = null;

      const dx = (e ? e.clientX : lastX) - startX;
      const isFling = Math.abs(vx) > 0.45 || Math.abs(dx) > threshold;

      if (isFling && typeof opts.onDismiss === "function") {
        const dir = vx > 0 || (vx === 0 && dx > 0) ? "right" : "left";
        const flyX = dir === "right" ? window.innerWidth + 200 : -window.innerWidth - 200;
        el.style.transition = "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease";
        el.style.transform = "translate3d(" + flyX + "px, 0, 0) rotate(" + (dir === "right" ? 25 : -25) + "deg)";
        el.style.opacity = "0";

        const onFlyEnd = function () {
          el.removeEventListener("transitionend", onFlyEnd);
          el.style.willChange = "";
          opts.onDismiss(el, dir);
        };
        el.addEventListener("transitionend", onFlyEnd);
        setTimeout(onFlyEnd, 400);
        return;
      }

      // Snap back dengan inersia
      el.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)";
      el.style.transform = "translate3d(0, 0, 0) rotate(0deg)";

      const onSnapEnd = function () {
        el.removeEventListener("transitionend", onSnapEnd);
        el.style.transition = "";
        el.style.willChange = "";
        if (typeof opts.onRelease === "function") {
          opts.onRelease({ el: el, dx: dx, vx: vx });
        }
      };
      el.addEventListener("transitionend", onSnapEnd);
      setTimeout(onSnapEnd, 450);
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    return function unbind() {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.style.touchAction = "";
      el.style.willChange = "";
      el.style.transform = "";
      el.style.transition = "";
    };
  }

  function initDeck(container, opts) {
    if (!container) return;
    opts = opts || {};
    const cardSelector = opts.cardSelector || "[data-drag-card]";
    const cards = Array.from(container.querySelectorAll(cardSelector));
    if (cards.length === 0) return;

    let currentIndex = 0;
    function setupTopCard() {
      if (currentIndex >= cards.length) {
        if (opts.loop) {
          currentIndex = 0;
          cards.forEach(function (c) {
            c.style.opacity = "1";
            c.style.transform = "translate3d(0,0,0)";
            c.style.zIndex = "1";
          });
        } else {
          return;
        }
      }

      cards.forEach(function (c, idx) {
        c.style.zIndex = String(cards.length - idx);
      });

      const topCard = cards[currentIndex];
      bind(topCard, {
        axis: opts.axis || "x",
        threshold: opts.threshold || 90,
        onDismiss: function (card, dir) {
          currentIndex++;
          if (typeof opts.onCardDismiss === "function") {
            opts.onCardDismiss(card, dir, currentIndex);
          }
          setupTopCard();
        }
      });
    }

    setupTopCard();
  }

  window.MotionDrag = {
    bind: bind,
    initDeck: initDeck
  };
})();
