(function () {
  "use strict";

  function isReduced() {
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  let gyroBound = false;

  function bind(el, opts) {
    if (!el || isReduced()) return function () {};
    const max = (opts && opts.max) || 15;
    const layers = el.querySelectorAll("[data-tilt-layer]");

    function update(xr, yr) {
      el.style.setProperty("--tilt-x", (yr * -max).toFixed(2) + "deg");
      el.style.setProperty("--tilt-y", (xr * max).toFixed(2) + "deg");
      layers.forEach((l) => {
        const d = parseFloat(l.dataset.tiltDepth || "1");
        l.style.transform = "translate3d(" + (xr * d * 10).toFixed(1) + "px," + (yr * d * 10).toFixed(1) + "px,0)";
      });
    }

    function reset() {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      layers.forEach((l) => { l.style.transform = ""; });
    }

    function onMove(e) {
      if (isReduced()) return;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) {
        update(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
      }
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);

    return function () {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      reset();
    };
  }

  function handleOrientation(e) {
    if (isReduced() || e.gamma === null || e.beta === null) return;
    const xr = Math.max(-1, Math.min(1, e.gamma / 45));
    const yr = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
    document.documentElement.style.setProperty("--tilt-gyro-x", (xr * 15).toFixed(2) + "deg");
    document.documentElement.style.setProperty("--tilt-gyro-y", (yr * 15).toFixed(2) + "deg");
  }

  function setupGyro() {
    if (gyroBound || typeof window === "undefined" || isReduced()) return;
    try {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
      gyroBound = true;
    } catch (e) {}
  }

  function requestGyroPermission() {
    if (isReduced() || typeof window === "undefined") return Promise.resolve(false);
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      return DeviceOrientationEvent.requestPermission()
        .then((s) => {
          if (s === "granted") {
            setupGyro();
            return true;
          }
          return false;
        })
        .catch(() => false);
    }
    setupGyro();
    return Promise.resolve(true);
  }

  function init(root) {
    if (isReduced()) return;
    (root || document).querySelectorAll("[data-tilt]").forEach((el) => bind(el));
  }

  window.MotionTilt = { bind, init, requestGyroPermission };
})();
