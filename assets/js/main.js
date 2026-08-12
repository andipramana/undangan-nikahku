/** Orkestrasi utama: populate konten (dari payload Supabase bila ada, fallback
 * ke config.js), buka undangan, init semua modul.
 *
 * Urutan wajib: seluruh konten dirender dulu, BARU initReveal() di paling
 * akhir — kalau tidak, elemen yang belum ada saat pemindaian tidak akan
 * pernah dapat animasi masuk (jebakan #8 rencana admin panel). */
(function () {
  /** Gabungkan konten remote (dari Supabase) DI ATAS config lokal: objek
   * digabung rekursif, array diganti. loveStory ditangani per-indeks supaya
   * field `photo` lokal tetap bertahan — itu satu-satunya foto yang masih
   * hidup di dalam config, dipakai kalau payload foto tidak tersedia. */
  function mergeInvitationContent(local, remote) {
    if (!remote) return local;
    const out = { ...local };
    for (const [key, value] of Object.entries(remote)) {
      if (key === "loveStory" && Array.isArray(value) && Array.isArray(local[key])) {
        out[key] = value.map((item, i) =>
          local[key][i] ? mergeInvitationContent(local[key][i], item) : item
        );
      } else if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        local[key] &&
        typeof local[key] === "object" &&
        !Array.isArray(local[key])
      ) {
        out[key] = mergeInvitationContent(local[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  /** Cocokkan nama tamu ke kelompok sapaan (case-insensitive, match PERSIS,
   * bukan substring). Kembalikan kelompok yang cocok atau null. Dipakai
   * resolveGreeting (sapaan) DAN closing statement — panggil SEKALI lalu
   * pakai hasilnya untuk keduanya, jangan menelusuri dua kali. */
  function matchGreetingGroup(cfg, guestName) {
    const groups = Array.isArray(cfg.guestGreetings) ? cfg.guestGreetings : [];
    const needle = guestName.trim().toLowerCase();
    return groups.find(
      (g) => Array.isArray(g.names) && g.names.some((n) => String(n).trim().toLowerCase() === needle)
    ) || null;
  }

  /** Sapaan tamu: label kelompok yang cocok, fallback defaultGuestGreeting
   * ("Kepada Yth."). `matchedGroup` opsional — kalau pemanggil sudah
   * menghitungnya (untuk closing juga), kirim lewat sini supaya tidak
   * menelusuri daftar kelompok dua kali. */
  function resolveGreeting(cfg, guestName, matchedGroup) {
    const matched = matchedGroup || matchGreetingGroup(cfg, guestName);
    return (matched && matched.label) || cfg.defaultGuestGreeting || "Kepada Yth.";
  }

  /** Ganti token di closing statement — pola SAMA dengan template pesan WA
   * di gift.js (buildMessage): replace STRING biasa via split/join, bukan
   * regex/eval, aman dari karakter spesial di nama/label. Token yang dikenal:
   * `${tamu}` nama tamu, `${CPP}` panggilan mempelai pria, `${CPW}` panggilan
   * mempelai wanita. */
  function fillTemplate(text, cfg, guestName) {
    const values = {
      "${tamu}": guestName,
      "${CPP}": cfg.couple.groom.nickname,
      "${CPW}": cfg.couple.bride.nickname
    };
    return Object.keys(values).reduce(
      (s, token) => s.split(token).join(values[token]),
      String(text ?? "")
    );
  }

  async function populateContent() {
    const cfg = window.WEDDING_CONFIG;
    // Tema custom (tab "Tampilan" di admin) — JANGAN dipanggil kalau template
    // engine sudah aktif. Template engine mengatur semua CSS variable; theme.js
    // menulis inline style yang akan mengalahkan CSS variable template.
    if (!window.getActiveTemplate || !window.getActiveTemplate()) {
      if (window.applyTheme) window.applyTheme(cfg);
    }
    document.title = cfg.siteTitle;
    // Meta share (pratinjau WhatsApp/sosmed) ikut dinamis — kalau nama atau
    // tanggal diubah lewat admin, tautan yang dibagikan tidak menampilkan
    // nama/tanggal lama dari HTML statis.
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        "content",
        `Undangan pernikahan digital ${cfg.couple.bride.name} & ${cfg.couple.groom.name}, ${cfg.event.dateLabel}`
      );
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", cfg.siteTitle);

    // Escape HTML — dipakai konten yang bisa diedit admin (nama, cerita, dsb.).
    // Didefinisikan di atas karena dipakai blok nama pasangan di bawah.
    const esc = (v) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const params = new URLSearchParams(location.search);
    const rawGuest = params.get(cfg.guestParam);
    const guestName = rawGuest ? decodeURIComponent(rawGuest.replace(/\+/g, " ")) : cfg.defaultGuestName;
    // Sapaan & closing statement dinamis per kelompok nama (diatur admin di
    // tab Teks): kalau nama tamu cocok persis dengan salah satu kelompok, teks
    // kelompok itulah yang dipakai — bukan default statis. Match dihitung
    // SEKALI, dipakai untuk sapaan di sini dan closing di bawah.
    const matchedGroup = matchGreetingGroup(cfg, guestName);
    document.getElementById("guest-name").textContent = guestName;
    document.getElementById("guest-label").textContent = resolveGreeting(cfg, guestName, matchedGroup);

    document.getElementById("wfl-quote").textContent = cfg.opening.quote;
    document.getElementById("wfl-source").textContent = `— ${cfg.opening.source} —`;

    document.getElementById("bride-name").textContent = cfg.couple.bride.name;
    document.getElementById("bride-parents").textContent =
      `Putri dari Bpk. ${cfg.couple.bride.father} & Ibu ${cfg.couple.bride.mother}`;

    document.getElementById("groom-name").textContent = cfg.couple.groom.name;
    document.getElementById("groom-parents").textContent =
      `Putra dari Bpk. ${cfg.couple.groom.father} & Ibu ${cfg.couple.groom.mother}`;

    // Nama panggilan pasangan di cover / Save The Date / closing — diisi dari
    // config/Supabase (couple.*.nickname), TIDAK hardcoded. Span .amp dijaga
    // supaya gaya ampersand (font script) tetap seperti sebelumnya.
    const fillCoupleNames = (el, useFullName) => {
      if (!el) return;
      const bride = useFullName ? cfg.couple.bride.name : cfg.couple.bride.nickname;
      const groom = useFullName ? cfg.couple.groom.name : cfg.couple.groom.nickname;
      el.innerHTML = `${esc(bride)} <span class="amp">&amp;</span> ${esc(groom)}`;
    };
    fillCoupleNames(document.getElementById("couple-names-cover"));
    fillCoupleNames(document.getElementById("couple-names-opening"));
    fillCoupleNames(document.getElementById("couple-names-closing"));

    setupCalendarLink(cfg);

    // Kartu event: tanggal (Selasa / 25 / Agustus / 2026 / jam) + venue +
    // tombol maps. dateLabel mis. "25 Agustus 2026" dipecah jadi hari "25",
    // bulan "Agustus", tahun "2026" — tahun dianimasikan count-up sendiri
    // (#event-year-label, data-count tanpa nilai).
    const parts = cfg.event.dateLabel.split(" ");
    const dayNum = parts[0];
    const month = parts[1] || "";
    const year = parts[2] || "";

    // Baris tanggal di Save The Date (#event-date-label) diisi utuh — tanggal
    // & tahunnya sengaja TANPA animasi angka (kurang cocok di sana).
    document.getElementById("event-date-label").textContent = `${cfg.event.dayLabel}, ${cfg.event.dateLabel}`;

    // Header tanggal besar #event (SATU untuk akad+resepsi: cfg.event cuma
    // punya SATU tanggal — akad & resepsi beda jam saja, lihat config.js).
    document.getElementById("event-day-label").textContent = cfg.event.dayLabel;
    document.getElementById("event-date-num").textContent = dayNum;
    document.getElementById("event-month-label").textContent = month;
    document.getElementById("event-year-label").textContent = year;

    ["akad", "resepsi"].forEach((key) => {
      // Jam & menit diisi ke span terpisah (#akad-time-h/m) — tiap angka
      // count-up sendiri (overshoot jam ke 24, menit ke 60). Format config
      // "HH.MM", dinormalisasi dulu ke "HH:MM" lalu dipecah.
      const t = String(cfg.event[key].start || "").replace(".", ":").split(":");
      document.getElementById(`${key}-time-h`).textContent = t[0] || "";
      document.getElementById(`${key}-time-m`).textContent = t[1] || "";
      // Venue per event (event.akad.venue / event.resepsi.venue, lihat
      // seedDefaults di content.js) — data lama yang belum disimpan ulang
      // hanya punya event.venue tunggal: fallback ke situ supaya venue
      // tidak tiba-tiba kosong.
      const venue = (cfg.event[key] && cfg.event[key].venue) || cfg.event.venue;
      document.getElementById(`venue-name-${key}`).textContent = venue.name;
      document.getElementById(`venue-address-${key}`).textContent = venue.address;
      document.getElementById(`${key}-maps`).href = venue.mapsUrl;
    });

    // Kartu dresscode: teks + 5 bulatan warna dari config
    const dcText = document.getElementById("dresscode-text");
    const dcBox = document.getElementById("dresscode-swatches");
    if (dcText && dcBox && cfg.dresscode) {
      dcText.textContent = cfg.dresscode.text;
      cfg.dresscode.colors.forEach((c, i) => {
        const s = document.createElement("span");
        s.className = "dresscode-swatch";
        s.style.background = c;
        s.title = c;
        s.dataset.reveal = "pop"; // mengembang satu per satu, seperti manik berjajar
        s.style.setProperty("--reveal-i", String(i + 3)); // menyusul label & teks
        dcBox.appendChild(s);
      });
    }

    // Foto quote full-width: dari payload Supabase (folder 'quote') bila ada,
    // fallback ke config lokal (webp + jpg). Pan/zoom diterapkan seperti foto lain.
    const qImg = document.getElementById("quote-img");
    const qWebp = document.getElementById("quote-webp");
    const qText = document.getElementById("quote-text");
    const quotePhotos = await window.getPhotos("quote");
    const qp = quotePhotos && quotePhotos[0];
    if (cfg.quotePhoto && qImg && qText) {
      if (qp) {
        const src = window.photoUrl(qp.path);
        qImg.src = src;
        if (qWebp) qWebp.srcset = src;
        qImg.style.setProperty("--fx", `${qp.focalX ?? 50}%`);
        qImg.style.setProperty("--fy", `${qp.focalY ?? 50}%`);
        qImg.style.setProperty("--zoom", String(qp.zoom ?? 1));
      } else if (cfg.quotePhoto.photo) {
        qImg.src = cfg.quotePhoto.photo;
        if (qWebp) qWebp.srcset = cfg.quotePhoto.photo.replace(/\.jpg$/, ".webp");
      }
      qText.textContent = cfg.quotePhoto.quote;
    }

    // Tiap babak cerita masuk bergantian dari kanan lalu kiri — terasa seperti
    // langkah bergantian menyusuri perjalanan, bukan daftar yang naik seragam.
    //
    // Satu babak = satu paket (data-reveal-group): dipicu bersamaan, tapi isinya
    // punya gerak sendiri-sendiri — tahun turun seperti penanda babak, judulnya
    // mengembang, ceritanya naik menyusul.
    //
    // Fotonya sengaja TIDAK diberi data-reveal: ia ikut terbawa bersama itemnya.
    // Kalau semua isi disembunyikan, yang meluncur masuk cuma kotak kosong —
    // .timeline-item sendiri tidak punya latar maupun garis, jadi tak ada yang
    // terlihat bergerak. Foto inilah yang membuat luncurannya kelihatan.
    // Foto babak diambil dari payload Supabase (folder 'story', urut = indeks
    // babak); kalau tidak ada, pakai foto lokal di config. Konten babak
    // di-escape — kini bisa diedit lewat admin, bukan file yang dipegang sendiri.
    const storyPhotos = await window.getPhotos("story");
    document.getElementById("love-story-list").innerHTML = cfg.loveStory
      .map((item, i) => {
        const p = storyPhotos && storyPhotos[i];
        const imgSrc = p ? window.photoUrl(p.path) : item.photo;
        const pan = p
          ? ` style="--fx:${p.focalX ?? 50}%; --fy:${p.focalY ?? 50}%; --zoom:${p.zoom ?? 1}"`
          : "";
        return `
      <div class="timeline-item" data-reveal="${i % 2 ? "slide-left" : "slide-right"}" data-reveal-group>
        ${imgSrc ? `<img class="timeline-item__photo" src="${esc(imgSrc)}" alt="${esc(item.title)}"${pan}>` : ""}
        <span class="timeline-date" data-reveal="down" data-count style="--reveal-i:1">${esc(item.date)}</span>
        <h4 data-reveal="pop" style="--reveal-i:2">${esc(item.title)}</h4>
        <p data-reveal="up" style="--reveal-i:3">${esc(item.text)}</p>
      </div>`;
      })
      .join("");

    // Closing: khusus kelompok yang cocok kalau ada (dan tidak kosong),
    // selain itu fallback ke default admin. Token ${tamu}/${CPP}/${CPW} di
    // teksnya diganti dengan nilai sebenarnya — diisi admin di tab Teks.
    document.getElementById("closing-text").textContent = fillTemplate(
      (matchedGroup && matchedGroup.closing && matchedGroup.closing.trim()) || cfg.closing.text,
      cfg,
      guestName
    );

    // Jalankan paling akhir: teks closing dan elemen dinamis sudah tersedia.
    if (window.applyVisualEditorOverrides) window.applyVisualEditorOverrides(cfg);
  }

  function setupCalendarLink(cfg) {
    const link = document.getElementById("btn-add-calendar");
    if (!link) return;
    const start = new Date(cfg.event.countdownTarget);
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    // Kalender menggabung akad & resepsi jadi satu agenda — pakai venue AKAD
    // sebagai wakilnya; data lama tanpa venue per-event di-fallback ke
    // event.venue tunggal (backward compat, lihat loop venue di atas).
    const venue = (cfg.event.akad && cfg.event.akad.venue) || cfg.event.venue;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `Pernikahan ${cfg.couple.bride.nickname} & ${cfg.couple.groom.nickname}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `${cfg.event.akad.label} & ${cfg.event.resepsi.label} di ${venue.name}`,
      location: venue.address
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
        // Teks/tombol/countdown masuk saat slide-in foto (transform 1.8s, lihat
        // #opening di CSS) tinggal menyisakan sedikit sisa gerak — sengaja
        // sedikit tumpang tindih, bukan menunggu benar-benar selesai, supaya
        // tidak terasa ada jeda kosong sebelum teksnya muncul. Fade opacity foto
        // masih lanjut sampai ~2.4s, jadi teks tetap menyusul sambil foto fade-in.
        // Jangan turunkan jauh di bawah ~1.2s: teks akan muncul saat fotonya
        // masih jelas bergerak dan dua gerakan itu jadi saling berebut.
        // Jeda slideshow section 2 juga baru dihitung mulai saat ini — foto
        // pertama tetap tampil dulu sebelum diganti.
        setTimeout(() => {
          opening.classList.add("text-revealed");
          // Slideshow opening baru distart setelah manifest foto selesai dimuat
          // (hero-slideshow.js async). Kalau belum siap, tandai queue — nanti
          // langsung jalan begitu fotonya ada.
          if (window.startOpeningSlideshow) window.startOpeningSlideshow();
          else window.__openingStartQueued = true;
        }, 1400);
      }
      // Isi undangan baru keluar dari display:none — pastikan semua elemen
      // data-reveal di dalamnya sudah terdaftar ke observer.
      if (window.revealScan) window.revealScan();
    }

    btn.addEventListener("click", () => {
      invitation.classList.remove("is-locked");
      // Slider (Swiper) baru boleh dibuat sekarang — saat terkunci, kontainer
      // display:none berukuran 0 sehingga autoplay macet sampai disentuh.
      window.__invitationOpen = true;
      (window.__openCallbacks || []).forEach((fn) => fn());
      window.__openCallbacks = [];
      document.documentElement.classList.remove("no-scroll");
      if (window.playBackgroundAudio) window.playBackgroundAudio();

      if (cover) {
        // Tunggu cover benar-benar selesai keluar layar (+ jeda sebentar,
        // background polos) sebelum section berikutnya mulai fade in.
        cover.addEventListener(
          "transitionend",
          () => setTimeout(revealOpening, 150),
          { once: true }
        );
        cover.classList.add("is-exiting");
      } else {
        revealOpening();
      }
    });
  }

  // Rail snap hanya mencakup urutan section penuh layar sampai Event. Begitu
  // tamu bergerak melewati Event, mandatory dilepas agar section panjang
  // sesudahnya tidak ditarik kembali ke Event. Saat kembali tepat ke Event,
  // rail langsung aktif lagi sehingga rasa snap antar halaman penuh tetap kuat.
  function setupSnapRail() {
    const scroller = document.querySelector(".app-frame__scroll");
    const railSections = document.querySelectorAll("[data-snap-rail]");
    const lastRail = railSections[railSections.length - 1];
    if (!scroller || !lastRail) return;

    const setMode = (target) => {
      const isRail = !!(target && target.matches && target.matches("[data-snap-rail]"));
      scroller.classList.toggle("is-snap-rail", isRail);
    };
    window.setInvitationSnapMode = setMode;
    setMode(lastRail);

    const releaseAfterLastRail = () => {
      const lastRailTop = lastRail.offsetTop;
      if (scroller.scrollTop > lastRailTop + 2) {
        scroller.classList.remove("is-snap-rail");
      } else if (scroller.scrollTop <= lastRailTop + 2) {
        scroller.classList.add("is-snap-rail");
      }
    };

    scroller.addEventListener("scroll", releaseAfterLastRail, { passive: true });
    scroller.addEventListener("wheel", (event) => {
      const rect = lastRail.getBoundingClientRect();
      if (event.deltaY > 0 && rect.top <= 2 && rect.bottom >= window.innerHeight - 2) {
        scroller.classList.remove("is-snap-rail");
      }
    }, { passive: true });

    let touchY = null;
    scroller.addEventListener("touchstart", (event) => {
      touchY = event.touches[0] && event.touches[0].clientY;
    }, { passive: true });
    scroller.addEventListener("touchmove", (event) => {
      const y = event.touches[0] && event.touches[0].clientY;
      const rect = lastRail.getBoundingClientRect();
      if (touchY !== null && y < touchY && rect.top <= 2 && rect.bottom >= window.innerHeight - 2) {
        scroller.classList.remove("is-snap-rail");
      }
    }, { passive: true });
  }

  // Save The Date 2 ada jauh di bawah (setelah #couple) — beda dari #opening
  // yang dipicu sekali saat amplop dibuka (revealOpening di atas), section ini
  // baru boleh reveal saat benar-benar discroll ke layar, supaya animasi
  // slide-in-nya tidak "kepakai habis" duluan sebelum tamu sampai di sana.
  function setupSaveTheDate2Reveal() {
    const std2 = document.getElementById("save-the-date-2");
    const saveDateEl = std2 && std2.querySelector(".save-date");
    const scroller = document.querySelector(".app-frame__scroll");
    if (!std2 || !("IntersectionObserver" in window)) return;

    let textRevealed = false;
    // Reveal teks "SAVE the DATE" — satu-satunya yang sengaja di-delay
    // sampai section mendarat penuh; reveal foto/section (section-revealed)
    // tetap langsung di callback observer di bawah.
    const revealText = () => {
      if (textRevealed) return;
      textRevealed = true;
      if (saveDateEl) saveDateEl.classList.add("is-visible");
      setTimeout(() => std2.classList.add("text-revealed"), 1400);
    };
    // Section dianggap "full screen" kalau tepi atasnya sudah lewat viewport
    // atas. Kalau section setinggi viewport ATAU lebih, tepi bawahnya juga
    // harus melewati batas bawah viewport; kalau section lebih PENDEK dari
    // viewport (tingginya cuma kontennya saja — #save-the-date-2 tidak punya
    // min-height 100dvh), posisi snap start (top <= 0) sudah dianggap penuh.
    // Kalau tidak, isFullScreen() tidak akan pernah true dan teks tidak akan
    // pernah muncul walau user sudah diam di section itu.
    const isFullScreen = () => {
      const r = std2.getBoundingClientRect();
      if (r.top > 0) return false;
      return r.height >= window.innerHeight - 1
        ? r.bottom >= window.innerHeight - 1
        : true;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        // 1) Foto/section reveal LANGSUNG begitu section mulai masuk layar
        //    (perilaku asli — jangan di-delay, user minta yang delay cuma
        //    teksnya).
        requestAnimationFrame(() => {
          requestAnimationFrame(() => std2.classList.add("section-revealed"));
        });

        // 2) Teks "SAVE the DATE" menunggu sampai section benar-benar
        //    mendarat PENUH (scroll-snap mandatory) + jeda 150ms biar
        //    "settle" dulu — supaya user bener-bener lihat teksnya full
        //    screen baru mask membuka. scrollend fire setelah scroll
        //    (termasuk snap) selesai; kalau user berhenti di section lain,
        //    cek isFullScreen gagal dan tunggu gesture berikutnya.
        const startWhenFull = () => {
          if (!isFullScreen()) return;
          setTimeout(revealText, 150);
        };
        // Polling cadangan jalan untuk SEMUA browser, bukan cuma yang tanpa
        // scrollend: scrollend hanya cek SATU KALI — kalau cek pertama gagal
        // (mis. address bar HP masih bergerak saat scrollend fire, atau snap
        // belum selesai), tidak ada retry dan teks tidak pernah muncul walau
        // user sudah diam di section. Polling mengecek terus sampai reveal
        // (tiap frame saat scroll/snap masih bergerak, tiap 400ms setelah
        // itu — getBoundingClientRect murah kalau layout tidak berubah).
        const t0 = performance.now();
        const tick = () => {
          if (textRevealed) return;
          if (isFullScreen()) { setTimeout(revealText, 150); return; }
          const r = std2.getBoundingClientRect();
          const visible = r.bottom > 0 && r.top < window.innerHeight;
          // Cadangan: section kelihatan tapi lama tidak pernah penuh (mis.
          // lebih tinggi dari viewport) → reveal saja supaya teks tidak
          // hilang selamanya.
          if (visible && performance.now() - t0 > 4000) { revealText(); return; }
          setTimeout(tick, performance.now() - t0 < 1500 ? 0 : 400);
        };
        setTimeout(tick, 0);
      },
      { threshold: 0.25 }
    );
    observer.observe(std2);
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

  document.addEventListener("DOMContentLoaded", async () => {
    document.documentElement.classList.add("no-scroll");

    // 0) Template engine — fallback ke classic-elegance dulu supaya warna
    //    tidak kedip, lalu periksa payload Supabase untuk template pilihan
    //    client (site_content.template). Kalau berbeda, switch ke template
    //    yang benar setelah payload tiba.
    const urlTpl = (new URLSearchParams(location.search).get("template") || "").replace(/\/+$/, "");
    let tpl = await window.loadTemplate(
      urlTpl ? `/templates/${encodeURIComponent(urlTpl)}.json` : null
    );
    if (tpl && tpl.fonts) {
      tpl.fonts.forEach((url) => {
        if (!document.querySelector(`link[href="${url}"]`)) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          link.dataset.templateFont = "1";
          document.head.appendChild(link);
        }
      });
    }

    // 1) Satu fetch payload dari Supabase (teks + foto). Gagal → pakai
    //    localStorage; kosong semua → undangan tetap jalan dari config.js +
    //    manifest lokal (jaring pengaman hari-H, lihat §2.3 rencana admin).
    const payload = await window.fetchInvitation();
    if (payload && payload.content) {
      window.WEDDING_CONFIG = mergeInvitationContent(window.WEDDING_CONFIG, payload.content);
    }
    window.__PHOTO_PAYLOAD = payload && payload.photos ? payload.photos : null;

    // Kalau client sudah memilih template berbeda (site_content.template),
    // switch sekarang — setelah payload tiba, sebelum konten diisi.
    // KECUALI: kalau ?template=... di URL, URL yang menang (admin preview).
    const savedTpl = ((payload && payload.content && payload.content.template)
      || (window.WEDDING_CONFIG && window.WEDDING_CONFIG.template) || "")
      .replace(/\/+$/, ""); // strip trailing slash
    if (!urlTpl && savedTpl) {
      const active = window.getActiveTemplate();
      if (!active || active.id !== savedTpl) {
        try {
          const fontLinks = document.querySelectorAll('link[data-template-font]');
          fontLinks.forEach((l) => l.remove());
          await window.loadTemplate(`/templates/${encodeURIComponent(savedTpl)}.json`);
          tpl = window.getActiveTemplate();
          if (tpl && tpl.fonts) {
            tpl.fonts.forEach((url) => {
              if (!document.querySelector(`link[href="${url}"]`)) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = url;
                link.dataset.templateFont = "1";
                document.head.appendChild(link);
              }
            });
          }
        } catch (err) {
          console.warn("Template switch gagal, tetap pakai fallback:", err);
        }
      }
    }

    await populateContent();
    setupSnapRail();
    setupOpenButton();
    setupSaveTheDate2Reveal();
    if (window.initHeroSlideshows) window.initHeroSlideshows();

    if (window.initCountdown) window.initCountdown();
    if (window.initAudioPlayer) window.initAudioPlayer();
    if (window.initGift) window.initGift();
    if (window.initRsvp) window.initRsvp();
    if (window.initGallery) window.initGallery();
    if (window.initCoupleSliders) window.initCoupleSliders();
    // Modul yang merender/menghapus elemen (livestream, QR check-in) WAJIB
    // sebelum initReveal: tombol/section yang baru dibuat harus ikut
    // terdaftar ke observer reveal pada pemindaian awal.
    if (window.initLivestream) window.initLivestream();
    // Menu navigasi harus dibangun SETELAH initLivestream: ia mengecek apakah
    // #livestream masih ada di DOM (livestream.js menghapusnya kalau semua URL
    // kosong) — kalau terlalu awal, link Live Streaming salah muncul/menghilang.
    if (window.initNavMenu) window.initNavMenu();
    if (window.initQrCheckin) window.initQrCheckin();
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
