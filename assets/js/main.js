/** Orkestrasi utama: populate konten dari config.js, buka undangan, init semua modul. */
(function () {
  function populateContent() {
    const cfg = window.WEDDING_CONFIG;
    document.title = cfg.siteTitle;

    const params = new URLSearchParams(location.search);
    const rawGuest = params.get(cfg.guestParam);
    const guestName = rawGuest ? decodeURIComponent(rawGuest.replace(/\+/g, " ")) : cfg.defaultGuestName;
    document.getElementById("guest-name").textContent = guestName;

    document.getElementById("opening-arabic").textContent = cfg.opening.arabicQuote;
    document.getElementById("opening-quote").textContent = cfg.opening.quote;
    document.getElementById("opening-source").textContent = `— ${cfg.opening.source} —`;

    document.getElementById("bride-photo").src = cfg.couple.bride.photo;
    document.getElementById("bride-name").textContent = cfg.couple.bride.name;
    document.getElementById("bride-parents").textContent =
      `Putri dari Bpk. ${cfg.couple.bride.father} & Ibu ${cfg.couple.bride.mother}`;

    document.getElementById("groom-photo").src = cfg.couple.groom.photo;
    document.getElementById("groom-name").textContent = cfg.couple.groom.name;
    document.getElementById("groom-parents").textContent =
      `Putra dari Bpk. ${cfg.couple.groom.father} & Ibu ${cfg.couple.groom.mother}`;

    document.getElementById("event-date-label").textContent = `${cfg.event.dayLabel}, ${cfg.event.dateLabel}`;
    setupCalendarLink(cfg);
    document.getElementById("akad-label").textContent = cfg.event.akad.label;
    document.getElementById("akad-time").textContent = `${cfg.event.akad.start} – ${cfg.event.akad.end} WIB`;
    document.getElementById("resepsi-label").textContent = cfg.event.resepsi.label;
    document.getElementById("resepsi-time").textContent = `${cfg.event.resepsi.start} – ${cfg.event.resepsi.end} WIB`;
    document.getElementById("venue-name").textContent = cfg.event.venue.name;
    document.getElementById("venue-address").textContent = cfg.event.venue.address;
    document.getElementById("venue-maps-link").href = cfg.event.venue.mapsUrl;

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
        setTimeout(() => opening.classList.add("text-revealed"), 2700);
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
    if (window.initShare) window.initShare();
    if (window.initGallery) window.initGallery();
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
