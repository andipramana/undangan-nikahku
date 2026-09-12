/** Nocturne — pengisian data + perilaku khas template ini.
 *
 * Sengaja TIDAK memakai modul perilaku milik template klasik (hero-slideshow,
 * couple-sliders, nav-menu, reveal, countdown, audio-player): semuanya terikat
 * pada markup & kelas klasik. Yang dipakai bersama hanya modul yang benar-benar
 * netral markup dan memakai ID semantik — rsvp.js, gift.js, qr-checkin.js —
 * plus guest-overrides.js untuk override editor visual.
 *
 * Hitung mundur, tombol musik, dan toast memakai WeddingBehaviors
 * (assets/js/core/behaviors.js): elemennya diserahkan dari sini, jadi
 * penamaan & tata letaknya tetap milik template ini.
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
      // Sengaja TIDAK ditampilkan di sini. Selama sampul, tamu belum punya
      // apa pun untuk dinavigasi — titiknya cuma mengambang mengganggu foto.
      // Dimunculkan handler tombol "Buka Undangan".
      dots.innerHTML = scenes.map((sc) =>
        `<button type="button" data-go="${sc.id}" aria-label="${sc.dataset.scene || sc.id}"></button>`).join("");
      dots.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-go]");
        if (btn) $(btn.dataset.go).scrollIntoView({ behavior: "smooth" });
      });
    }

    // Dua pengamat dengan tugas berbeda: yang satu menghidupkan adegan begitu
    // tepinya masuk layar, yang satu menyorot titik navigasi milik adegan yang
    // sedang dibaca. Keduanya tidak memakai ambang rasio — adegan galeri &
    // ucapan jauh lebih tinggi dari layar dan tidak akan pernah mencapainya.
    cleanups.push(window.WeddingBehaviors.revealOnView(scenes));
    if (dots) {
      cleanups.push(window.WeddingBehaviors.trackActive(scenes, (scene) => {
        dots.querySelectorAll("button").forEach((b) =>
          b.classList.toggle("is-active", b.dataset.go === scene.id));
      }));
    }
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
          // Satu atribut style saja: HTML mengabaikan style kedua, jadi
          // warna dan urutan reveal harus digabung dalam satu deklarasi.
          (dress.colors || []).map((c, i) =>
            `<span style="background:${esc(c)}; --reveal-i:${i}" title="${esc(c)}" data-reveal="bloom"></span>`).join("");
      }

      cleanups.push(window.WeddingBehaviors.countdown({
        days: $("cd-days"), hours: $("cd-hours"),
        minutes: $("cd-minutes"), seconds: $("cd-seconds")
      }, cfg.event.countdownTarget));

      /* Live streaming — sectionnya dibuang kalau tidak ada satu pun URL,
         supaya tidak menyisakan adegan kosong yang tetap kena snap. */
      const live = cfg.livestream || {};
      const liveLinks = [
        ["YouTube", live.youtube], ["Instagram", live.instagram], ["TikTok", live.tiktok]
      ].filter(([, url]) => url);
      if (liveLinks.length) {
        $("livestream-links").innerHTML = liveLinks
          .map(([label, url], i) =>
            `<a class="nc-btn" href="${esc(url)}" target="_blank" rel="noopener"
                data-reveal="hold" style="--reveal-i:${i}">${label}</a>`)
          .join("");
      } else {
        $("livestream").remove();
      }

      /* Cerita */
      const story = Array.isArray(cfg.loveStory) ? cfg.loveStory : [];
      $("love-story-list").innerHTML = story.map((item, i) => `
        <article class="nc-story__item" data-reveal="pan-left" style="--reveal-i:${i % 4}">
          <span class="nc-story__date">${esc(item.date)}</span>
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.text)}</p>
        </article>`).join("");

      /* Galeri + lightbox */
      const gal = photos("gallery");
      const grid = $("nc-gallery-grid");
      if (gal.length) {
        grid.innerHTML = gal.map((p, i) => `
          <button type="button" data-full="${esc(p.url)}" aria-label="Foto ${i + 1}"
                  data-reveal="iris" style="--reveal-i:${i % 4}">
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

      /* Tanda kasih: latar foto dipakai ulang dari slot penutup/sampul —
         adegan ini tidak punya slot fotonya sendiri di admin, dan latar polos
         membuatnya terasa seperti halaman sisipan, bukan bagian utama. */
      setBg($("gift-media"), photos("closing")[0] || photos("cover")[0]);

      /* Penutup */
      $("closing-text").textContent = guest.closing;
      coupleNames($("couple-names-closing"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      setBg($("closing-media"), photos("closing")[0]);

      /* Perilaku */
      cleanups.push(window.WeddingBehaviors.toast($("toast")));
      const audio = window.WeddingBehaviors.audio($("bg-audio"), $("audio-toggle"), cfg);
      cleanups.push(audio.stop);
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
        audio.play();
        $("cover").classList.add("is-live");
        const dots = $("nc-dots");
        if (dots) dots.hidden = false;
        // Bawa tamu ke adegan berikutnya, supaya jelas undangannya benar-benar
        // terbuka — tanpa ini layar tidak berubah sama sekali setelah ditekan.
        $("opening").scrollIntoView({ behavior: "smooth" });
      }, { once: true });

      // Modul bersama yang netral markup (memakai ID semantik yang sudah
      // disediakan markup.html di atas).
      // Mesin reveal dijalankan SETELAH markup terisi, supaya elemen yang baru
      // dibuat (babak cerita, foto galeri) ikut terdaftar. rsvp.js & gift.js
      // memanggil revealScan/revealNow sendiri untuk isi yang menyusul.
      if (window.initReveal) window.initReveal();

      if (window.initRsvp) window.initRsvp();
      if (window.initGift) window.initGift();
      // WAJIB setelah initGift: gift.js hanya mendaftarkan markup rekening &
      // alamat yang dibuatnya ke mesin reveal DI DALAM handler tombol toggle
      // (revealNow/revealScan di assets/js/gift.js). Template ini membiarkan
      // panelnya selalu terbuka, jadi tombol itu tidak pernah diklik — tanpa
      // baris ini kartu rekening ada di DOM tapi tinggal transparan selamanya.
      if (window.revealScan) window.revealScan(document.getElementById("gift-panel"));
      if (window.initQrCheckin) window.initQrCheckin();
      if (window.applyVisualEditorOverrides) window.applyVisualEditorOverrides(cfg);
      // Nama mempelai dipecah per huruf lalu dimunculkan bergantian. Dipanggil
      // PALING AKHIR: applyVisualEditorOverrides menulis ulang textContent,
      // yang akan menghapus span-span ini kalau urutannya dibalik.
      if (window.splitChars) {
        [$("couple-names-cover"), $("couple-names-closing")].forEach((el) => window.splitChars(el));
      }


      // Sampul langsung hidup — adegan lain menunggu discroll.
      requestAnimationFrame(() => $("cover").classList.add("is-live"));
    },

    destroy() {
      cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
    }
  };
})();
