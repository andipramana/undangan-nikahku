/** Kertas — pengisian data + perilaku khas template ini.
 *
 * Modul bersama yang dipakai: rsvp.js, gift.js, qr-checkin.js (netral markup,
 * memakai id semantik) dan guest-overrides.js. Hitung mundur, tombol musik,
 * toast, dan gerak masuk memakai WeddingBehaviors — elemennya diserahkan dari
 * sini, jadi penamaan & tata letaknya tetap milik Kertas.
 *
 * Yang khas template ini: daftar isi di tepi yang menyorot bab yang sedang
 * terbaca, foto full-bleed sebagai pemisah, dan galeri berirama majalah
 * (lebar kartu bergantian lewat CSS, bukan diatur di sini).
 */
(function () {
  "use strict";

  window.WeddingTemplates = window.WeddingTemplates || {};

  const $ = (id) => document.getElementById(id);
  const cleanups = [];

  function setPhoto(img, photo) {
    if (!img) return false;
    if (!photo) { const fig = img.closest("figure"); if (fig) fig.hidden = true; return false; }
    img.src = photo.url;
    img.alt = photo.alt || "";
    img.style.setProperty("--fx", `${photo.focalX}%`);
    img.style.setProperty("--fy", `${photo.focalY}%`);
    return true;
  }

  function coupleNames(el, a, b, esc) {
    if (!el) return;
    el.innerHTML = `${esc(a)}<span class="amp">dan</span>${esc(b)}`;
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

  /** Daftar isi dibangun dari bab yang BENAR-BENAR ada di halaman, jadi bab
   * yang dihapus (mis. live streaming tanpa URL) tidak meninggalkan entri mati. */
  function setupIndex(root) {
    const sheets = [...root.querySelectorAll(".kt-sheet[data-chapter]")];
    const index = $("kt-index");
    const btn = $("kt-index-btn");

    index.innerHTML = sheets.map((sheet) =>
      `<a href="#${sheet.id}" data-go="${sheet.id}"><span>${sheet.dataset.chapter}</span></a>`
    ).join("");

    const close = () => { index.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", () => {
      const open = index.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
    index.addEventListener("click", (e) => {
      const link = e.target.closest("[data-go]");
      if (!link) return;
      e.preventDefault();
      $(link.dataset.go).scrollIntoView({ behavior: "smooth" });
      close();
    });

    // Gerak masuk tiap lembar, lalu penyorotan entri daftar isi sebagai
    // pengamat terpisah — lembar yang lebih tinggi dari layar (galeri, kartu
    // balasan) tidak akan pernah memenuhi ambang rasio, jadi keduanya memakai
    // pemicu berbasis posisi, bukan rasio.
    const all = [...root.querySelectorAll(".kt-sheet")];
    cleanups.push(window.WeddingBehaviors.revealOnView(all));
    cleanups.push(window.WeddingBehaviors.trackActive(all, (sheet) => {
      index.querySelectorAll("a").forEach((a) =>
        a.classList.toggle("is-active", a.dataset.go === sheet.id));
    }));
  }

  function setupModals(root) {
    root.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-close]");
      if (closer) { closer.closest(".kt-modal, .kt-lightbox").hidden = true; return; }
      if (e.target.classList.contains("kt-modal") || e.target.classList.contains("kt-lightbox")) {
        e.target.hidden = true;
      }
    });
    const onEsc = (e) => {
      if (e.key !== "Escape") return;
      root.querySelectorAll(".kt-modal:not([hidden]), .kt-lightbox:not([hidden])")
        .forEach((m) => { m.hidden = true; });
    };
    document.addEventListener("keydown", onEsc);
    cleanups.push(() => document.removeEventListener("keydown", onEsc));
  }

  window.WeddingTemplates["kertas"] = {
    async render(ctx) {
      const { data: cfg, esc, fmt, guest, photos } = ctx;
      const root = ctx.mount;
      const venueOf = (key) => (cfg.event[key] && cfg.event[key].venue) || cfg.event.venue || {};

      /* Masthead */
      const names = `${cfg.couple.bride.nickname} & ${cfg.couple.groom.nickname}`;
      $("kt-masthead-names").textContent = names;
      const d = fmt.dateParts(cfg.event.dateLabel);
      $("kt-issue").textContent = d.year ? `Edisi ${d.year}` : "Undangan";

      /* Sampul */
      coupleNames($("couple-names-cover"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);
      $("cover-date").textContent = [cfg.event.dayLabel, cfg.event.dateLabel].filter(Boolean).join(", ");
      $("cover-venue").textContent = venueOf("resepsi").name || venueOf("akad").name || "";
      setPhoto($("cover-photo"), photos("cover")[0]);
      $("guest-label").textContent = guest.greeting;
      $("guest-name").textContent = guest.name;

      /* Ayat */
      $("opening-arabic").textContent = cfg.opening.arabicQuote || "";
      $("wfl-quote").textContent = cfg.opening.quote || "";
      $("wfl-source").textContent = cfg.opening.source || "";

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

      /* Pemisah full-bleed: pakai foto acara kalau ada, kalau tidak ada
         sama sekali blok-nya tetap tersembunyi (bukan kotak abu kosong). */
      const bleed = $("kt-bleed-1");
      const bleedPhoto = photos("event")[0] || photos("gallery")[0];
      if (bleedPhoto && setPhoto(bleed.querySelector("img"), bleedPhoto)) bleed.hidden = false;

      /* Acara */
      $("event-date-line").textContent =
        [cfg.event.dayLabel, cfg.event.dateLabel].filter(Boolean).join(", ");

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
        $("kt-dress").hidden = false;
        $("dresscode-text").textContent = dress.text || "";
        $("dresscode-swatches").innerHTML =
          (dress.colors || []).map((c) => `<span style="background:${esc(c)}" title="${esc(c)}"></span>`).join("");
      }

      /* Live streaming — babnya dibuang kalau tidak ada satu pun URL. */
      const live = cfg.livestream || {};
      const links = [["YouTube", live.youtube], ["Instagram", live.instagram], ["TikTok", live.tiktok]]
        .filter(([, url]) => url);
      if (links.length) {
        $("livestream-links").innerHTML = links
          .map(([label, url]) => `<a class="kt-btn" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`)
          .join("");
      } else {
        $("livestream").remove();
      }

      /* Cerita */
      const story = Array.isArray(cfg.loveStory) ? cfg.loveStory : [];
      $("love-story-list").innerHTML = story.map((item) => `
        <article class="kt-story__item">
          <span class="kt-story__date">${esc(item.date)}</span>
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.text)}</p>
        </article>`).join("");

      /* Galeri */
      const gal = photos("gallery");
      const grid = $("kt-gallery-grid");
      if (gal.length) {
        grid.innerHTML = gal.map((p, i) => `
          <button type="button" data-full="${esc(p.url)}" aria-label="Foto ${i + 1}">
            <img src="${esc(p.url)}" alt="${esc(p.alt)}" loading="lazy"
                 style="--fx:${p.focalX}%; --fy:${p.focalY}%">
          </button>`).join("");
        grid.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-full]");
          if (!btn) return;
          $("kt-lightbox-img").src = btn.dataset.full;
          $("kt-lightbox").hidden = false;
        });
      } else {
        $("gallery").remove();
      }

      /* Penutup */
      $("closing-text").textContent = guest.closing;
      coupleNames($("couple-names-closing"), cfg.couple.bride.nickname, cfg.couple.groom.nickname, esc);

      /* Perilaku */
      cleanups.push(window.WeddingBehaviors.toast($("toast")));
      const audio = window.WeddingBehaviors.audio($("bg-audio"), $("audio-toggle"), cfg);
      cleanups.push(audio.stop);
      setupModals(root);
      setupIndex(root);

      const paper = $("kt-paper");
      paper.classList.add("is-locked");
      // Isi undangan sudah ditahan oleh .is-locked (bagian lain di-display:none),
      // jadi kunci gulir dokumen dilepas sejak awal: kalau sampul sedikit
      // meluap di layar pendek, tamu tetap bisa menggeser untuk meraih tombol
      // Buka Undangan — bukan terjebak melihat tombol yang tak bisa disentuh.
      document.documentElement.classList.remove("no-scroll");
      $("btn-open").addEventListener("click", () => {
        paper.classList.remove("is-locked");
        document.documentElement.classList.remove("no-scroll");
        window.__invitationOpen = true;
        (window.__openCallbacks || []).forEach((fn) => fn());
        window.__openCallbacks = [];
        audio.play();
        // Masthead & daftar isi baru berguna setelah ada isi untuk dinavigasi —
        // sebelum itu keduanya cuma menutupi sampul (tombol daftar isi bahkan
        // sempat menindih tombol Buka Undangan).
        $("kt-masthead").hidden = false;
        $("kt-index-btn").hidden = false;
        $("opening").scrollIntoView({ behavior: "smooth" });
      }, { once: true });

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
