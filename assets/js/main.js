/** Orkestrasi utama: populate konten dari config.js, buka undangan, init semua modul. */
(function () {
  function populateContent() {
    const cfg = window.WEDDING_CONFIG;
    document.title = cfg.siteTitle;

    const params = new URLSearchParams(location.search);
    const rawGuest = params.get(cfg.guestParam);
    const guestName = rawGuest ? decodeURIComponent(rawGuest.replace(/\+/g, " ")) : cfg.defaultGuestName;
    document.getElementById("guest-name").textContent = guestName;

    document.getElementById("wfl-arabic").textContent = cfg.opening.arabicQuote;
    document.getElementById("wfl-quote").textContent = cfg.opening.quote;
    document.getElementById("wfl-source").textContent = `— ${cfg.opening.source} —`;

    document.getElementById("bride-name").textContent = cfg.couple.bride.name;
    document.getElementById("bride-parents").textContent =
      `Putri dari Bpk. ${cfg.couple.bride.father} & Ibu ${cfg.couple.bride.mother}`;

    document.getElementById("groom-name").textContent = cfg.couple.groom.name;
    document.getElementById("groom-parents").textContent =
      `Putra dari Bpk. ${cfg.couple.groom.father} & Ibu ${cfg.couple.groom.mother}`;

    document.getElementById("event-date-label").textContent = `${cfg.event.dayLabel}, ${cfg.event.dateLabel}`;
    setupCalendarLink(cfg);

    // Kartu event: tanggal (Selasa / 25 / Agustus 2026 / jam) + venue + tombol maps
    const parts = cfg.event.dateLabel.split(" ");
    const dayNum = parts[0];
    const monthYear = parts.slice(1).join(" ");
    const fmtTime = (t) => t.replace(".", ":");
    ["akad", "resepsi"].forEach((key) => {
      document.getElementById(`${key}-day`).textContent = cfg.event.dayLabel;
      document.getElementById(`${key}-date`).textContent = dayNum;
      document.getElementById(`${key}-month`).textContent = monthYear;
      document.getElementById(`${key}-time`).textContent = fmtTime(cfg.event[key].start);
      document.getElementById(`venue-name-${key}`).textContent = cfg.event.venue.name;
      document.getElementById(`venue-address-${key}`).textContent = cfg.event.venue.address;
      document.getElementById(`${key}-maps`).href = cfg.event.venue.mapsUrl;
    });

    // Kartu dresscode: teks + 5 bulatan warna dari config
    const dcText = document.getElementById("dresscode-text");
    const dcBox = document.getElementById("dresscode-swatches");
    if (dcText && dcBox && cfg.dresscode) {
      dcText.textContent = cfg.dresscode.text;
      cfg.dresscode.colors.forEach((c) => {
        const s = document.createElement("span");
        s.className = "dresscode-swatch";
        s.style.background = c;
        s.title = c;
        dcBox.appendChild(s);
      });
    }

    // Foto quote full-width: sumber dari config (webp + fallback jpg) + teks quote
    const qImg = document.getElementById("quote-img");
    const qWebp = document.getElementById("quote-webp");
    const qText = document.getElementById("quote-text");
    if (cfg.quotePhoto && qImg && qText) {
      if (cfg.quotePhoto.photo) {
        qImg.src = cfg.quotePhoto.photo;
        if (qWebp) qWebp.srcset = cfg.quotePhoto.photo.replace(/\.jpg$/, ".webp");
      }
      qText.textContent = cfg.quotePhoto.quote;
    }

    document.getElementById("love-story-list").innerHTML = cfg.loveStory
      .map(
        (item, i) => `
      <div class="timeline-item" data-aos="fade-up" data-aos-delay="${i * 100}">
        ${item.photo ? `<img class="timeline-item__photo" src="${item.photo}" alt="${item.title}">` : ""}
        <span class="timeline-date">${item.date}</span>
        <h4>${item.title}</h4>
        <p>${item.text}</p>
      </div>`
      )
      .join("");

    document.getElementById("closing-text").textContent = cfg.closing.text;
  }

  function setupCalendarLink(cfg) {
    const link = document.getElementById("btn-add-calendar");
    if (!link) return;
    const start = new Date(cfg.event.countdownTarget);
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `Pernikahan ${cfg.couple.bride.nickname} & ${cfg.couple.groom.nickname}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `${cfg.event.akad.label} & ${cfg.event.resepsi.label} di ${cfg.event.venue.name}`,
      location: cfg.event.venue.address
    });
    link.href = `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function setupOpenButton() {
    const btn = document.getElementById("btn-open");
    const invitation = document.getElementById("invitation");
    const cover = document.getElementById("cover");
    const opening = document.getElementById("opening");
    if (!btn || !invitation) return;

    function revealOpening() {
      if (opening) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => opening.classList.add("section-revealed"));
        });
        // Teks/tombol/countdown baru animasi masuk SETELAH foto section selesai
        // (durasi transisi section = 2.6s, lihat #opening.section-revealed di CSS).
        // Jeda slideshow section 2 juga baru dihitung mulai saat ini — foto
        // pertama tetap tampil dulu sebelum diganti.
        setTimeout(() => {
          opening.classList.add("text-revealed");
          // Slideshow opening baru distart setelah manifest foto selesai dimuat
          // (hero-slideshow.js async). Kalau belum siap, tandai queue — nanti
          // langsung jalan begitu fotonya ada.
          if (window.startOpeningSlideshow) window.startOpeningSlideshow();
          else window.__openingStartQueued = true;
        }, 2700);
      }
      if (window.refreshReveal) window.refreshReveal();
    }

    btn.addEventListener("click", () => {
      invitation.classList.remove("is-locked");
      document.documentElement.classList.remove("no-scroll");
      if (window.playBackgroundAudio) window.playBackgroundAudio();

      if (cover) {
        // Tunggu cover benar-benar selesai keluar layar (+ jeda sebentar,
        // background polos) sebelum section berikutnya mulai fade in.
        cover.addEventListener(
          "transitionend",
          () => setTimeout(revealOpening, 250),
          { once: true }
        );
        cover.classList.add("is-exiting");
      } else {
        revealOpening();
      }
    });
  }

  window.showToast = function (message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  };

  function hidePreloader() {
    const pre = document.getElementById("preloader");
    if (pre) pre.classList.add("hide");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.add("no-scroll");

    populateContent();
    setupOpenButton();
    if (window.initHeroSlideshows) window.initHeroSlideshows();

    if (window.initCountdown) window.initCountdown();
    if (window.initAudioPlayer) window.initAudioPlayer();
    if (window.initGift) window.initGift();
    if (window.initRsvp) window.initRsvp();
    if (window.initGallery) window.initGallery();
    if (window.initWeFoundLove) window.initWeFoundLove();
    if (window.initCoupleSliders) window.initCoupleSliders();
    if (window.initEventCards) window.initEventCards();
    if (window.initReveal) window.initReveal();

    window.addEventListener("load", hidePreloader);
    setTimeout(hidePreloader, 3000);

    const cover = document.getElementById("cover");
    if (cover) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => cover.classList.add("cover-visible"));
      });
    }
  });
})();
