/** Nocturne — pengisian data + perilaku khas template ini.
 *
 * Sengaja TIDAK memakai modul perilaku milik template klasik (hero-slideshow,
 * couple-sliders, nav-menu, reveal, countdown, audio-player): semuanya terikat
 * pada markup & kelas klasik. Yang dipakai bersama hanya modul yang benar-benar
 * netral markup dan memakai ID semantik — rsvp.js, gift.js, qr-checkin.js —
 * plus guest-overrides.js untuk override editor visual.
 *
 * Countdown dan tombol musik ditulis pendek di sini (masing-masing ~20 baris)
 * karena versi bersama menuntut elemen khas klasik (#save-the-date-2,
 * #audio-toggle-icon) yang tidak ada di template ini.
 */
(function () {
  "use strict";

  window.WeddingTemplates = window.WeddingTemplates || {};

  const $ = (id) => document.getElementById(id);
  const cleanups = [];

  /* ── Toast: dipanggil rsvp.js & gift.js lewat window.showToast ─────────── */
  window.showToast = function (message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(window.__ncToast);
    window.__ncToast = setTimeout(() => el.classList.remove("show"), 2400);
  };

  function setBg(el, photo) {
    if (!el || !photo) return;
    el.style.backgroundImage = `url("${photo.url}")`;
    el.style.setProperty("--fx", `${photo.focalX}%`);
    el.style.setProperty("--fy", `${photo.focalY}%`);
    el.style.setProperty("--zoom", String(photo.zoom || 1));
  }

  function coupleNames(el, a, b, esc) {
    if (!el) return;
    el.innerHTML = `${esc(a)}<span class="amp">&amp;</span>${esc(b)}`;
  }

  const IG_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>';

  function fillInstagram(el, handle, esc) {
    if (!el) return;
    const ig = String(handle || "").trim().replace(/^@/, "");
    if (!ig) { el.innerHTML = ""; return; }
    el.innerHTML = `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">${IG_ICON}<span>@${esc(ig)}</span></a>`;
  }

  /* ── Countdown sendiri (versi bersama terikat markup klasik) ───────────── */
  function startCountdown(targetISO) {
    const days = $("cd-days"), hours = $("cd-hours"), mins = $("cd-minutes"), secs = $("cd-seconds");
    if (!days) return;
    const target = new Date(targetISO).getTime();
    if (isNaN(target)) return;
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const s = Math.floor(diff / 1000);
      days.textContent = String(Math.floor(s / 86400));
      hours.textContent = pad(Math.floor(s / 3600) % 24);
      mins.textContent = pad(Math.floor(s / 60) % 60);
      secs.textContent = pad(s % 60);
    };
    tick();
    const timer = setInterval(tick, 1000);
    cleanups.push(() => clearInterval(timer));
  }

  /* ── Tombol musik sendiri (bar equalizer, bukan ikon Font Awesome) ─────── */
  function setupAudio(cfg) {
    const audio = $("bg-audio"), btn = $("audio-toggle");
    if (!audio || !btn) return;
    const src = (cfg.audio && (cfg.audio.path ? window.audioUrl(cfg.audio.path) : cfg.audio.src)) || "";
    if (!src) return;
    audio.src = src;
    btn.hidden = false;
    const sync = () => btn.classList.toggle("is-playing", !audio.paused);
    btn.addEventListener("click", () => { audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    // Autoplay hanya boleh setelah gestur tamu (kebijakan browser) — dipicu
    // tombol "Buka Undangan", bukan saat halaman dimuat.
    window.__ncPlayAudio = () => audio.play().catch(() => {});
  }

  /* ── Adegan hidup + titik navigasi ─────────────────────────────────────── */
  function setupScenes(root) {
    const scenes = [...root.querySelectorAll(".nc-scene")];
    // Stagger tiap anak adegan: makin ke bawah, makin belakangan munculnya.
    scenes.forEach((sc) => {
      const inner = sc.querySelector(".nc-scene__inner");
      if (inner) [...inner.children].forEach((el, i) => el.style.setProperty("--i", String(i)));
    });

    const dots = $("nc-dots");
    if (dots) {
      dots.hidden = false;
      dots.innerHTML = scenes.map((sc) =>
        `<button type="button" data-go="${sc.id}" aria-label="${sc.dataset.scene || sc.id}"></button>`).join("");
      dots.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-go]");
        if (btn) $(btn.dataset.go).scrollIntoView({ behavior: "smooth" });
      });
    }

    if (!("IntersectionObserver" in window)) {
      scenes.forEach((sc) => sc.classList.add("is-live"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-live");
        if (dots) {
          dots.querySelectorAll("button").forEach((b) =>
            b.classList.toggle("is-active", b.dataset.go === entry.target.id));
        }
      });
    }, { threshold: 0.45 });
    scenes.forEach((sc) => io.observe(sc));
    cleanups.push(() => io.disconnect());
  }

  function setupModals(root) {
    root.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-close]");
      if (closer) { closer.closest(".nc-modal, .nc-lightbox").hidden = true; return; }
      // Klik latar gelap ikut menutup — ekspektasi umum di HP.
      if (e.target.classList.contains("nc-modal") || e.target.classList.contains("nc-lightbox")) {
        e.target.hidden = true;
      }
    });
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      root.querySelectorAll(".nc-modal:not([hidden]), .nc-lightbox:not([hidden])")
        .forEach((m) => { m.hidden = true; });
    };
    document.addEventListener("keydown", onEsc);
    cleanups.push(() => document.removeEventListener("keydown", onEsc));
  }

  window.WeddingTemplates["nocturne"] = {
    async render(ctx) {
      const { data: cfg, esc, fmt, guest, photos } = ctx;
      const root = ctx.mount;

      /* Sampul */
      coupleNames($("couple-names-cover"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      $("cover-date").textContent = cfg.event.dateLabel || "";
      $("guest-label").textContent = guest.greeting;
      $("guest-name").textContent = guest.name;
      setBg($("cover-media"), photos("cover")[0]);

      /* Ayat */
      $("opening-arabic").textContent = cfg.opening.arabicQuote || "";
      $("wfl-quote").textContent = cfg.opening.quote || "";
      $("wfl-source").textContent = cfg.opening.source ? `— ${cfg.opening.source} —` : "";

      /* Mempelai */
      $("bride-name").textContent = cfg.couple.bride.name;
      $("bride-parents").innerHTML =
        `Putri dari<br>Bapak ${esc(cfg.couple.bride.father)} &amp; Ibu ${esc(cfg.couple.bride.mother)}`;
      fillInstagram($("bride-instagram"), cfg.couple.bride.instagram, esc);
      setBg($("bride-media"), photos("bride")[0]);

      $("groom-name").textContent = cfg.couple.groom.name;
      $("groom-parents").innerHTML =
        `Putra dari<br>Bapak ${esc(cfg.couple.groom.father)} &amp; Ibu ${esc(cfg.couple.groom.mother)}`;
      fillInstagram($("groom-instagram"), cfg.couple.groom.instagram, esc);
      setBg($("groom-media"), photos("groom")[0]);

      /* Acara */
      const d = fmt.dateParts(cfg.event.dateLabel);
      $("event-day-label").textContent = cfg.event.dayLabel || "";
      $("event-date-num").textContent = d.day;
      $("event-month-label").textContent = d.month;
      $("event-year-label").textContent = d.year;
      setBg($("event-media"), photos("event")[0]);

      ["akad", "resepsi"].forEach((key) => {
        const ev = cfg.event[key] || {};
        const start = fmt.timeParts(ev.start), end = fmt.timeParts(ev.end);
        const venue = ev.venue || cfg.event.venue || {};
        $(`${key}-label`).textContent = ev.label || (key === "akad" ? "Akad" : "Resepsi");
        $(`${key}-time-h`).textContent = start.h;
        $(`${key}-time-m`).textContent = start.m;
        $(`${key}-time-end-h`).textContent = end.h;
        $(`${key}-time-end-m`).textContent = end.m;
        $(`venue-name-${key}`).textContent = venue.name || "";
        $(`venue-address-${key}`).textContent = venue.address || "";
        const maps = $(`${key}-maps`);
        if (venue.mapsUrl) maps.href = venue.mapsUrl; else maps.hidden = true;
      });

      const cal = fmt.calendarUrl(cfg);
      if (cal) $("btn-add-calendar").href = cal; else $("btn-add-calendar").hidden = true;

      const dress = cfg.dresscode || {};
      if (dress.text || (dress.colors || []).length) {
        $("nc-dress").hidden = false;
        $("dresscode-text").textContent = dress.text || "";
        $("dresscode-swatches").innerHTML =
          (dress.colors || []).map((c) => `<span style="background:${esc(c)}" title="${esc(c)}"></span>`).join("");
      }

      startCountdown(cfg.event.countdownTarget);

      /* Live streaming — sectionnya dibuang kalau tidak ada satu pun URL,
         supaya tidak menyisakan adegan kosong yang tetap kena snap. */
      const live = cfg.livestream || {};
      const liveLinks = [
        ["YouTube", live.youtube], ["Instagram", live.instagram], ["TikTok", live.tiktok]
      ].filter(([, url]) => url);
      if (liveLinks.length) {
        $("livestream-links").innerHTML = liveLinks
          .map(([label, url]) => `<a class="nc-btn" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`)
          .join("");
      } else {
        $("livestream").remove();
      }

      /* Cerita */
      const story = Array.isArray(cfg.loveStory) ? cfg.loveStory : [];
      $("love-story-list").innerHTML = story.map((item) => `
        <article class="nc-story__item">
          <span class="nc-story__date">${esc(item.date)}</span>
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.text)}</p>
        </article>`).join("");

      /* Galeri + lightbox */
      const gal = photos("gallery");
      const grid = $("nc-gallery-grid");
      if (gal.length) {
        grid.innerHTML = gal.map((p, i) => `
          <button type="button" data-full="${esc(p.url)}" aria-label="Foto ${i + 1}">
            <img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"
                 style="--fx:${p.focalX}%; --fy:${p.focalY}%">
          </button>`).join("");
        grid.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-full]");
          if (!btn) return;
          $("nc-lightbox-img").src = btn.dataset.full;
          $("nc-lightbox").hidden = false;
        });
      } else {
        $("gallery").remove();
      }

      /* Penutup */
      $("closing-text").textContent = guest.closing;
      coupleNames($("couple-names-closing"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      setBg($("closing-media"), photos("closing")[0]);

      /* Perilaku */
      setupAudio(cfg);
      setupModals(root);
      setupScenes(root);

      const scroller = $("nc-scroll");
      scroller.classList.add("is-locked");
      $("btn-open").addEventListener("click", () => {
        scroller.classList.remove("is-locked");
        document.documentElement.classList.remove("no-scroll");
        window.__invitationOpen = true;
        (window.__openCallbacks || []).forEach((fn) => fn());
        window.__openCallbacks = [];
        if (window.__ncPlayAudio) window.__ncPlayAudio();
        $("cover").classList.add("is-live");
      }, { once: true });

      // Modul bersama yang netral markup (memakai ID semantik yang sudah
      // disediakan markup.html di atas).
      if (window.initRsvp) window.initRsvp();
      if (window.initGift) window.initGift();
      if (window.initQrCheckin) window.initQrCheckin();
      if (window.applyVisualEditorOverrides) window.applyVisualEditorOverrides(cfg);

      // Sampul langsung hidup — adegan lain menunggu discroll.
      requestAnimationFrame(() => $("cover").classList.add("is-live"));
    },

    destroy() {
      cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
    }
  };
})();
