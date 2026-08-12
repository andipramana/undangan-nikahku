/** Cover/opening/closing: slideshow foto bergilir dengan efek Ken Burns +
 * crossfade (foto lama fade out bersamaan foto baru fade in, keduanya
 * overlap — diatur CSS .hero-slide per template).
 *
 * Foto diambil dari payload Supabase (folder cover/opening/closing) dengan
 * cadangan manifest lokal. Zoom per foto (--zoom) diterapkan lewat keyframe
 * Ken Burns di CSS — transform biasa akan ditimpa animasi (lihat style.css).
 *
 * Timing: foto tampil penuh selama `interval`, lalu transisi pelan (SLIDE_TRANSITION_MS),
 * lalu jeda penuh lagi sebelum foto berikutnya diganti. Section 2 (opening) tidak mulai
 * menghitung dari page load — slideshow-nya baru distart main.js saat foto pertamanya
 * sudah masuk, supaya foto pertama tetap bisa dilihat dulu. */
window.initHeroSlideshows = async function () {
  const cfg = window.WEDDING_CONFIG;
  // Satu foto tampil PENUH sebelum diganti: jeda 7 detik, transisi 3.2 detik.
  // WAJIB SAMA PERSIS dengan durasi transition .hero-slide di assets/css/style.css
  // (classic-elegance) — kalau angka ini lebih PENDEK dari transition CSS-nya,
  // reset inline style di bawah (baris ~109-112) memotong animasi CSS yang
  // masih berjalan: foto yang keluar snap ke posisi akhir sebelum benar-benar
  // selesai bergeser, dan foto yang masuk belum tiba di posisinya — celah
  // kosong sesaat di antara keduanya. Bug ini nyata terjadi 2026-08-11 saat
  // durasi CSS dinaikkan (dulu 1.8s) tanpa ikut menaikkan angka ini.
  const interval = cfg.heroSlideInterval || 7000;
  const SLIDE_TRANSITION_MS = 3200;

  // Muat foto ketiga slideshow sekaligus
  const [coverSlides, openingSlides, closingSlides] = await Promise.all([
    window.getPhotos("cover"),
    window.getPhotos("opening"),
    window.getPhotos("closing")
  ]);

  [
    ["cover", coverSlides],
    ["opening", openingSlides],
    ["closing", closingSlides]
  ].forEach(([key, slides]) => {
    const container = document.getElementById(`${key}-media`);
    const overlay = container && container.querySelector(".hero-overlay");
    if (!container || !(slides && slides.length)) return;

    slides.forEach((slide, i) => {
      const wrap = document.createElement("picture");
      wrap.className = "hero-slide" + (i === 0 ? " active" : "");
      const src = slide.path && !slide.webp ? window.photoUrl(slide.path) : slide.webp || slide.jpg;
      // --zoom di baca keyframe kenburns (scale dari --zoom ke --zoom*1.15)
      const fx = slide.focalX ?? 50;
      const fy = slide.focalY ?? 50;
      const zoom = slide.zoom ?? 1;
      wrap.innerHTML = `
        <source srcset="${src}" type="image/webp">
        <img class="kenburns" src="${src}" alt=""
             style="--fx:${fx}%; --fy:${fy}%; --zoom:${zoom}">
      `;
      container.insertBefore(wrap, overlay);
    });

    if (slides.length > 1) {
      const items = container.querySelectorAll(".hero-slide");
      let index = 0;

      // Slideshow yang tidak sedang dilihat tidak perlu berjalan. #closing ada
      // jauh di bawah halaman, dan #cover tetap tinggal di DOM (position: fixed,
      // digeser keluar layar) setelah undangan dibuka — keduanya kalau dibiarkan
      // akan terus berganti slide + menjalankan Ken Burns sampai tab ditutup.
      let awake = key === "opening";
      let awakeSince = 0;
      const setAwake = (on) => {
        if (on && !awake) awakeSince = performance.now();
        awake = on;
        container.classList.toggle("hero-media--paused", !on);
      };

      if (key === "closing" && "IntersectionObserver" in window) {
        setAwake(false);
        new IntersectionObserver(
          (entries) => entries.forEach((e) => setAwake(e.isIntersecting)),
          { rootMargin: "25% 0px 25% 0px" }
        ).observe(document.getElementById("closing"));
      } else if (key === "cover") {
        const coverEl = document.getElementById("cover");
        // Cover jalan sejak awal, lalu berhenti begitu ia keluar layar.
        setAwake(true);
        if (coverEl) {
          coverEl.addEventListener("transitionend", () => {
            if (coverEl.classList.contains("is-exiting")) setAwake(false);
          });
        }
      } else {
        setAwake(true);
      }

      function cycle() {
        if (!awake) {
          setTimeout(cycle, 1000); // cek lagi nanti, jangan ganti slide dulu
          return;
        }
        // Baru saja terlihat lagi: biarkan foto yang sedang tampil dilihat penuh
        // dulu, jangan langsung berganti begitu tamu sampai di section ini.
        const held = performance.now() - awakeSince;
        if (held < interval) {
          setTimeout(cycle, interval - held);
          return;
        }
        const current = items[index];
        const nextIndex = (index + 1) % items.length;
        const next = items[nextIndex];

        current.classList.remove("active");
        current.classList.add("exiting");
        next.classList.add("active");

        setTimeout(() => {
          current.classList.remove("exiting");
          current.style.transition = "none";
          // eslint-disable-next-line no-unused-expressions
          current.offsetHeight; // force reflow supaya reset posisi tidak animasi/terlihat
          current.style.transition = "";
        }, SLIDE_TRANSITION_MS);

        index = nextIndex;
        // Jeda penuh dulu untuk melihat foto yang baru masuk, BARU transisi berikutnya
        // (tidak pakai setInterval agar pergantian tidak pernah menumpuk).
        setTimeout(cycle, interval + SLIDE_TRANSITION_MS);
      }

      function start(firstDelay) {
        // Foto pertama tampil dulu sebelum transisi pertama berjalan.
        // Opening memakai jeda awal lebih pendek (lihat bawah) supaya foto
        // cepat berganti setelah section direveal — jeda full `interval`
        // terasa lama karena perhitungannya dimulai belakangan.
        setTimeout(cycle, firstDelay);
      }

      if (key === "opening") {
        // Slideshow section 2 baru berjalan saat foto pertamanya sudah tampil
        // (dipicu dari main.js lewat window.startOpeningSlideshow). Kalau main.js
        // sudah minta start lebih dulu (fetch manifest masih jalan), langsung jalan.
        // Foto pertama tampil PENUH dulu (~6.5s) sebelum berganti — tidak buru-buru.
        const OPENING_FIRST_DELAY = 6500;
        window.startOpeningSlideshow = () => start(OPENING_FIRST_DELAY);
        if (window.__openingStartQueued) start(OPENING_FIRST_DELAY);
      } else {
        start(interval);
      }
    }
  });

  // Save The Date 2: 1 foto statis dari folder 'opening' yang sama, TANPA
  // slideshow/Ken Burns — di-set sebagai inline background-image (CSS
  // .section-hero--static-bg yang atur cover/center-nya). Ambil foto TERAKHIR
  // (bukan pertama) di folder itu — Save The Date 1 (#opening) tetap mulai
  // dari slide pertama, foto khusus Save The Date 2 sengaja ditambahkan di
  // urutan paling akhir supaya keduanya tidak berebut foto yang sama.
  const std2Media = document.getElementById("save-the-date-2-media");
  if (std2Media && openingSlides && openingSlides.length) {
    const slide = openingSlides[openingSlides.length - 1];
    const src = slide.path && !slide.webp ? window.photoUrl(slide.path) : slide.webp || slide.jpg;
    std2Media.style.backgroundImage = `url("${src}")`;
  }
};
