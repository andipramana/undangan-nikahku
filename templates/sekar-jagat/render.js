/** Sekar Jagat — pengisian data + perilaku khas template ini.
 *
 * Modul bersama yang dipakai: rsvp.js, gift.js, qr-checkin.js (netral markup)
 * dan guest-overrides.js. Hitung mundur, tombol musik, toast, dan penanda
 * masuk-viewport memakai WeddingBehaviors.
 *
 * Yang ditulis sendiri di sini cuma parallax berlapis — gerak khas template
 * ini, dan tidak ada template lain yang memakainya.
 */
(function () {
  "use strict";

  window.WeddingTemplates = window.WeddingTemplates || {};

  const $ = (id) => document.getElementById(id);
  const cleanups = [];

  function setBg(el, photo) {
    if (!el || !photo) return;
    el.style.backgroundImage = `url("${photo.url}")`;
    el.style.setProperty("--fx", `${photo.focalX}%`);
    el.style.setProperty("--fy", `${photo.focalY}%`);
  }

  function setPhoto(img, photo) {
    if (!img || !photo) return;
    img.src = photo.url;
    img.alt = photo.alt || "";
    img.style.setProperty("--fx", `${photo.focalX}%`);
    img.style.setProperty("--fy", `${photo.focalY}%`);
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
    el.innerHTML = ig
      ? `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">${IG_ICON}<span>@${esc(ig)}</span></a>`
      : "";
  }

  /** Parallax berlapis: lapisan latar bergeser lebih lambat dari isinya.
   *
   * Dihitung di rAF dan hanya untuk lapisan yang sedang berada di sekitar
   * layar — kalau semua lapisan dihitung tiap kali scroll, HP membakar frame
   * budget untuk elemen yang tidak dilihat siapa pun. Dimatikan sepenuhnya
   * bila tamu meminta gerak minimal (CSS juga menetralkan transform-nya). */
  function setupParallax(root) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = [...root.querySelectorAll("[data-parallax]")];
    if (!layers.length) return;

    let ticking = false;
    const apply = () => {
      ticking = false;
      const vh = window.innerHeight;
      layers.forEach((layer) => {
        const box = layer.parentElement.getBoundingClientRect();
        if (box.bottom < -vh * 0.3 || box.top > vh * 1.3) return;
        const depth = parseFloat(layer.dataset.parallax) || 0.3;
        // Titik nol saat bagian berada tepat di tengah layar, jadi geserannya
        // simetris ke atas & bawah dan tidak pernah menyingkap tepi latar.
        const offset = (box.top + box.height / 2 - vh / 2) * depth;
        layer.style.setProperty("--p", `${offset.toFixed(1)}px`);
      });
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    apply();
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });
  }

  function setupMenu(root) {
    const parts = [...root.querySelectorAll(".sj-part[data-part]")];
    const menu = $("sj-menu");
    const btn = $("sj-menu-btn");

    menu.innerHTML = parts.map((p) =>
      `<a href="#${p.id}" data-go="${p.id}">${p.dataset.part}</a>`).join("");

    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => {
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", String(!menu.hidden));
    });
    menu.addEventListener("click", (e) => {
      const link = e.target.closest("[data-go]");
      if (!link) return;
      e.preventDefault();
      $(link.dataset.go).scrollIntoView({ behavior: "smooth" });
      close();
    });

    // Anak-anak diberi nomor urut supaya masuknya bertahap, bukan serentak.
    parts.forEach((part) => {
      const inner = part.querySelector(".sj-part__inner");
      if (inner) [...inner.children].forEach((el, i) => el.style.setProperty("--i", String(i)));
    });

    // Bagian Ucapan & Galeri jauh lebih tinggi dari layar; ambang rasio tidak
    // akan pernah tercapai di situ, jadi gerak masuk dan penyorotan menu
    // masing-masing memakai pemicu berbasis posisi.
    // Isi tiap bagian kini diurus mesin reveal per elemen (assets/js/reveal.js),
    // termasuk pemisah ornamen — jadi di sini tinggal penyorotan menu.
    cleanups.push(window.WeddingBehaviors.trackActive(parts, (part) => {
      menu.querySelectorAll("a").forEach((a) =>
        a.classList.toggle("is-active", a.dataset.go === part.id));
    }));
  }

  function setupModals(root) {
    root.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-close]");
      if (closer) { closer.closest(".sj-modal, .sj-lightbox").hidden = true; return; }
      if (e.target.classList.contains("sj-modal") || e.target.classList.contains("sj-lightbox")) {
        e.target.hidden = true;
      }
    });
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      root.querySelectorAll(".sj-modal:not([hidden]), .sj-lightbox:not([hidden])")
        .forEach((m) => { m.hidden = true; });
    };
    document.addEventListener("keydown", onEsc);
    cleanups.push(() => document.removeEventListener("keydown", onEsc));
  }

  window.WeddingTemplates["sekar-jagat"] = {
    async render(ctx) {
      const { data: cfg, esc, fmt, guest, photos } = ctx;
      const root = ctx.mount;
      const venueOf = (key) => (cfg.event[key] && cfg.event[key].venue) || cfg.event.venue || {};

      /* Sampul */
      coupleNames($("couple-names-cover"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      $("cover-date").textContent = [cfg.event.dayLabel, cfg.event.dateLabel].filter(Boolean).join(", ");
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
      setPhoto($("bride-photo"), photos("bride")[0]);

      $("groom-name").textContent = cfg.couple.groom.name;
      $("groom-parents").innerHTML =
        `Putra dari<br>Bapak ${esc(cfg.couple.groom.father)} &amp; Ibu ${esc(cfg.couple.groom.mother)}`;
      fillInstagram($("groom-instagram"), cfg.couple.groom.instagram, esc);
      setPhoto($("groom-photo"), photos("groom")[0]);

      /* Acara */
      $("event-date-line").textContent =
        [cfg.event.dayLabel, cfg.event.dateLabel].filter(Boolean).join(", ");
      setBg($("event-media"), photos("event")[0]);

      ["akad", "resepsi"].forEach((key) => {
        const ev = cfg.event[key] || {};
        const start = fmt.timeParts(ev.start), end = fmt.timeParts(ev.end);
        const venue = venueOf(key);
        $(`${key}-label`).textContent = ev.label || (key === "akad" ? "Akad" : "Resepsi");
        $(`${key}-time`).textContent =
          `${start.h}.${start.m}` + (end.h ? ` – ${end.h}.${end.m} WIB` : " WIB");
        $(`venue-name-${key}`).textContent = venue.name || "";
        $(`venue-address-${key}`).textContent = venue.address || "";
        const maps = $(`${key}-maps`);
        if (venue.mapsUrl) maps.href = venue.mapsUrl; else maps.hidden = true;
      });

      cleanups.push(window.WeddingBehaviors.countdown({
        days: $("cd-days"), hours: $("cd-hours"),
        minutes: $("cd-minutes"), seconds: $("cd-seconds")
      }, cfg.event.countdownTarget));

      const cal = fmt.calendarUrl(cfg);
      if (cal) $("btn-add-calendar").href = cal; else $("btn-add-calendar").hidden = true;

      const dress = cfg.dresscode || {};
      if (dress.text || (dress.colors || []).length) {
        $("sj-dress").hidden = false;
        $("dresscode-text").textContent = dress.text || "";
        $("dresscode-swatches").innerHTML =
          // Satu atribut style saja: HTML mengabaikan style kedua.
          (dress.colors || []).map((c, i) =>
            `<span style="background:${esc(c)}; --reveal-i:${i}" title="${esc(c)}" data-reveal="bloom"></span>`).join("");
      }

      /* Live streaming — bagiannya dibuang kalau tidak ada satu pun URL. */
      const live = cfg.livestream || {};
      const links = [["YouTube", live.youtube], ["Instagram", live.instagram], ["TikTok", live.tiktok]]
        .filter(([, url]) => url);
      if (links.length) {
        $("livestream-links").innerHTML = links
          .map(([label, url], i) =>
            `<a class="sj-btn" href="${esc(url)}" target="_blank" rel="noopener"
                data-reveal="hold" style="--reveal-i:${i}">${label}</a>`)
          .join("");
      } else {
        $("livestream").remove();
      }

      /* Cerita */
      const story = Array.isArray(cfg.loveStory) ? cfg.loveStory : [];
      $("love-story-list").innerHTML = story.map((item, i) => `
        <article class="sj-story__item" data-reveal="from-left" style="--reveal-i:${i % 4}">
          <span class="sj-story__date">${esc(item.date)}</span>
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.text)}</p>
        </article>`).join("");

      /* Galeri */
      const gal = photos("gallery");
      const grid = $("sj-gallery-grid");
      if (gal.length) {
        grid.innerHTML = gal.map((p, i) => `
          <button type="button" data-full="${esc(p.url)}" aria-label="Foto ${i + 1}"
                  data-reveal="unfurl" style="--reveal-i:${i % 4}">
            <img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"
                 style="--fx:${p.focalX}%; --fy:${p.focalY}%">
          </button>`).join("");
        grid.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-full]");
          if (!btn) return;
          $("sj-lightbox-img").src = btn.dataset.full;
          $("sj-lightbox").hidden = false;
        });
      } else {
        $("gallery").remove();
      }

      /* Penutup */
      $("closing-text").textContent = guest.closing;
      coupleNames($("couple-names-closing"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      setBg($("closing-media"), photos("closing")[0] || photos("cover")[0]);

      /* Perilaku */
      cleanups.push(window.WeddingBehaviors.toast($("toast")));
      const audio = window.WeddingBehaviors.audio($("bg-audio"), $("audio-toggle"), cfg);
      cleanups.push(audio.stop);
      setupModals(root);
      setupMenu(root);
      setupParallax(root);

      const main = $("sj-main");
      main.classList.add("is-locked");
      $("btn-open").addEventListener("click", () => {
        main.classList.remove("is-locked");
        document.documentElement.classList.remove("no-scroll");
        window.__invitationOpen = true;
        (window.__openCallbacks || []).forEach((fn) => fn());
        window.__openCallbacks = [];
        audio.play();
        $("sj-menu-btn").hidden = false;
        $("opening").scrollIntoView({ behavior: "smooth" });
      }, { once: true });

      // Mesin reveal dijalankan SETELAH markup terisi, supaya babak cerita &
      // foto galeri yang baru dibuat ikut terdaftar. rsvp.js dan gift.js
      // memanggil revealScan/revealNow sendiri untuk isi yang menyusul.
      if (window.initReveal) window.initReveal();

      if (window.initRsvp) window.initRsvp();
      if (window.initGift) window.initGift();
      if (window.initQrCheckin) window.initQrCheckin();
      if (window.applyVisualEditorOverrides) window.applyVisualEditorOverrides(cfg);

      requestAnimationFrame(() => $("cover").classList.add("is-live"));
    },

    destroy() {
      cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
    }
  };
})();
