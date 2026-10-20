(function () {
  "use strict";

  function isReduced() {
    return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getMaxParticles() {
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 480px)").matches;
    const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
    return (isMobile || cores <= 4) ? 18 : 35;
  }

  function createParticle(w, h, type) {
    return {
      x: Math.random() * w,
      y: Math.random() * h - 20,
      size: Math.random() * 5 + 4,
      vx: (Math.random() - 0.5) * 0.8,
      vy: Math.random() * 0.9 + 0.6,
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 1.5,
      alpha: Math.random() * 0.6 + 0.3,
      type: type || "petals",
      color: type === "confetti" ? ["#d4af37", "#f3e5ab", "#c5a059", "#e8c39e"][Math.floor(Math.random() * 4)] : "rgba(225, 185, 175, "
    };
  }

  function drawParticle(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rot * Math.PI) / 180);
    if (p.type === "confetti") {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (p.type === "dust") {
      ctx.fillStyle = "rgba(255, 235, 190, " + p.alpha + ")";
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color + p.alpha + ")";
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  let activeInstance = null;

  function start(canvasOrContainer, opts) {
    if (isReduced() || !canvasOrContainer) {
      return { stop() {}, resume() {}, burst() {} };
    }

    opts = opts || {};
    let canvas = canvasOrContainer;
    if (canvas.tagName !== "CANVAS") {
      const existing = canvas.querySelector("canvas");
      if (existing) {
        canvas = existing;
      } else {
        canvas = document.createElement("canvas");
        Object.assign(canvas.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1" });
        canvasOrContainer.appendChild(canvas);
      }
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return { stop() {}, resume() {}, burst() {} };

    let width = 0, height = 0, running = false, isVisible = true, rafId = null;
    const maxCount = Math.min(opts.maxParticles || Infinity, getMaxParticles());
    const particles = [];
    const type = opts.type || "petals";

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = canvas.width = rect.width || window.innerWidth || 360;
      height = canvas.height = rect.height || window.innerHeight || 640;
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    for (let i = 0; i < maxCount; i++) particles.push(createParticle(width, height, type));

    function render() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.rot += p.vRot;
        if (p.y > height + 20) { p.y = -20; p.x = Math.random() * width; }
        if (p.x < -20) p.x = width + 20; else if (p.x > width + 20) p.x = -20;
        drawParticle(ctx, p);
      }
      rafId = requestAnimationFrame(render);
    }

    function play() {
      if (running || isReduced()) return;
      running = true;
      rafId = requestAnimationFrame(render);
    }

    function pause() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function onVisibility() {
      if (document.hidden) pause();
      else if (isVisible && !isReduced()) play();
    }
    document.addEventListener("visibilitychange", onVisibility);

    let observer = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          isVisible = e.isIntersecting;
          if (isVisible && !document.hidden && !isReduced()) play();
          else pause();
        });
      }, { threshold: 0.01 });
      observer.observe(canvas);
    } else {
      play();
    }

    function burst(x, y, bOpts) {
      if (isReduced() || !ctx) return;
      bOpts = bOpts || {};
      const count = Math.min(bOpts.count || 12, 16);
      const bType = bOpts.type || type;
      const ox = typeof x === "number" ? x : width / 2;
      const oy = typeof y === "number" ? y : height / 2;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
        const spd = Math.random() * 4 + 2;
        particles.push({
          x: ox, y: oy, size: Math.random() * 6 + 4,
          vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.5,
          rot: Math.random() * 360, vRot: (Math.random() - 0.5) * 4,
          alpha: 1, type: bType,
          color: bType === "confetti" ? ["#d4af37", "#f3e5ab", "#c5a059"][i % 3] : "rgba(225, 185, 175, "
        });
      }
      setTimeout(() => { while (particles.length > maxCount) particles.shift(); }, 3000);
    }

    const instance = {
      stop() {
        pause();
        if (observer) observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", resize);
      },
      resume: play,
      burst
    };

    activeInstance = instance;
    return instance;
  }

  function burstGlobal(x, y, opts) {
    if (isReduced() || !activeInstance) return;
    activeInstance.burst(x, y, opts);
  }

  window.MotionParticles = { start, burst: burstGlobal };
})();
