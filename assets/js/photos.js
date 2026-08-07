/** Helper foto: sumber foto dari payload Supabase (satu fetch get_invitation,
 * lihat supabase-client.js), dengan cadangan manifest.json lokal kalau
 * Supabase/localStorage tidak tersedia. Urutan foto di tabel `photos`
 * ditentukan sort_order — bukan nama file. */

/** Foto per folder dari payload — atau null kalau tidak tersedia (modul
 * pemanggil punya fallback sendiri untuk story/quote, atau tetap dapat
 * fallback manifest lokal untuk folder berslider lewat LEGACY_MANIFESTS). */
window.getPhotos = async function (folder) {
  const payload = window.__PHOTO_PAYLOAD;
  if (payload && Array.isArray(payload[folder]) && payload[folder].length) {
    return payload[folder];
  }

  // Cadangan: folder lama yang masih punya manifest.json di repo
  const cfg = window.WEDDING_CONFIG;
  const legacy = {
    cover: cfg.hero && cfg.hero.coverManifest,
    opening: cfg.hero && cfg.hero.openingManifest,
    closing: cfg.hero && cfg.hero.closingManifest,
    bride: cfg.coupleSlides && cfg.coupleSlides.brideManifest,
    groom: cfg.coupleSlides && cfg.coupleSlides.groomManifest,
    wfl: cfg.weFoundLove && cfg.weFoundLove.manifest,
    event: cfg.event && cfg.event.manifest,
    gallery: cfg.gallery && cfg.gallery.manifest
  };
  if (!legacy[folder]) return null;

  try {
    const res = await fetch(legacy[folder]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return (Array.isArray(list) ? list : []).sort((a, b) =>
      (a.jpg || "").localeCompare(b.jpg || "")
    );
  } catch (err) {
    console.error("Gagal memuat manifest foto:", legacy[folder], err);
    return null;
  }
};

/** Panggil fn begitu undangan "dibuka" (klik Buka Undangan). Dipakai untuk
 * init Swiper: kalau di-init saat #invitation masih display:none, kontainer
 * berukuran 0 → autoplay tidak jalan sampai user menyentuh slider. */
window.whenInvitationOpen = function (fn) {
  if (window.__invitationOpen) fn();
  else (window.__openCallbacks = window.__openCallbacks || []).push(fn);
};

/** Jalankan `cb` setelah animasi masuk (data-reveal) elemen ini benar-benar
 * tuntas. Kalau elemennya tidak berada di dalam elemen ber-reveal, `cb` jalan
 * seketika.
 *
 * Dipakai untuk menahan autoplay slider: foto yang sedang meluncur masuk sambil
 * berganti slide membuat dua gerakan berebut perhatian — luncurannya jadi tidak
 * terbaca. */
window.afterReveal = function (el, cb) {
  const target = el && el.closest && el.closest("[data-reveal]");
  if (!target) {
    cb();
    return;
  }

  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    cb();
  };

  function waitTransition() {
    const cs = getComputedStyle(target);
    // parseFloat mengambil angka pertama dari daftar (opacity & transform
    // memakai durasi yang sama, jadi cukup satu).
    const dur = parseFloat(cs.transitionDuration) || 0;
    const delay = parseFloat(cs.transitionDelay) || 0;

    // Tanpa transisi sama sekali — mis. saat prefers-reduced-motion aktif,
    // reveal.js langsung menandai semuanya tampil dan CSS mematikan transisi.
    // transitionend TIDAK akan pernah menyala di kasus ini, jadi jangan
    // menunggunya: kalau ditunggu, autoplay tidak akan pernah jalan.
    if (dur === 0) {
      run();
      return;
    }

    const onEnd = (e) => {
      if (e.target !== target) return; // abaikan transisi elemen anak
      target.removeEventListener("transitionend", onEnd);
      run();
    };
    target.addEventListener("transitionend", onEnd);
    // Jaring pengaman: transitionend bisa hangus kalau tab disembunyikan tepat
    // saat animasi berjalan.
    setTimeout(() => {
      target.removeEventListener("transitionend", onEnd);
      run();
    }, (dur + delay) * 1000 + 80);
  }

  if (target.classList.contains("is-revealed")) {
    waitTransition();
    return;
  }
  const mo = new MutationObserver(() => {
    if (!target.classList.contains("is-revealed")) return;
    mo.disconnect();
    waitTransition();
  });
  mo.observe(target, { attributes: true, attributeFilter: ["class"] });
};

/** Autoplay slider hanya berjalan kalau DUA syarat terpenuhi:
 *   1. animasi masuk fotonya sudah selesai — supaya luncuran/miringnya terbaca
 *      utuh tanpa slide ikut berganti di tengah gerakan;
 *   2. slidernya sedang di sekitar layar — ada 5 slider di halaman ini, kalau
 *      semuanya autoplay terus, HP membakar frame budget untuk transisi yang
 *      tidak dilihat siapa pun.
 * Karena stop() lalu start() mengulang hitungan `delay` dari nol, pergantian
 * slide pertama otomatis jatuh satu `delay` penuh setelah animasi masuk kelar. */
window.pauseAutoplayOffscreen = function (swiper, el) {
  if (!swiper || !swiper.autoplay || !el || !("IntersectionObserver" in window)) return;

  let revealed = false;
  let nearScreen = false;
  const sync = () => {
    if (revealed && nearScreen) swiper.autoplay.start();
    else swiper.autoplay.stop();
  };

  // Swiper menyalakan autoplay sejak init — diamkan dulu sampai syaratnya penuh.
  swiper.autoplay.stop();

  window.afterReveal(el, () => {
    revealed = true;
    // IntersectionObserver melapor asinkron. Untuk slider yang animasi masuknya
    // MEMINDAHKAN elemen (foto mempelai meluncur dari luar layar), laporan
    // terakhir bisa masih "di luar layar" tepat saat luncurannya baru berhenti —
    // autoplay lalu diam sampai tamu menggulir lagi. Periksa langsung di sini.
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < (window.innerHeight || 0)) nearScreen = true;
    sync();
  });

  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        nearScreen = entry.isIntersecting;
        sync();
      });
    },
    // Margin longgar: slider sudah siap sebelum benar-benar terlihat, jadi tamu
    // tidak pernah memergoki slide dalam keadaan diam.
    { rootMargin: "50% 0px 50% 0px" }
  ).observe(el);
};

/** Bangun slide Swiper dari item payload Supabase ({path, alt, focalX, focalY,
 * zoom}) atau item manifest lokal ({jpg, webp}). Pan/zoom diterapkan sebagai
 * custom property yang dibaca CSS (object-position + transform scale). */
window.buildPhotoSlide = function (item, cls) {
  const slide = document.createElement("div");
  slide.className = `swiper-slide ${cls}`;
  const src = item.path && !item.webp ? window.photoUrl(item.path) : item.webp || item.jpg;
  const fx = item.focalX ?? 50;
  const fy = item.focalY ?? 50;
  const zoom = item.zoom ?? 1;
  slide.innerHTML = `
    <picture>
      <source srcset="${src}" type="image/webp">
      <img src="${src}" alt="${(item.alt || "").replace(/"/g, "&quot;")}" loading="lazy"
           style="--fx:${fx}%; --fy:${fy}%; --zoom:${zoom}">
    </picture>`;
  return slide;
};
