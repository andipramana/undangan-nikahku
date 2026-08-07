/** Helper foto: fetch manifest.json per folder + bangun elemen slide.
 * Aplikasi TIDAK menyebut nama file statis — cukup path manifest folder,
 * urutan foto ditentukan oleh urutan nama file (01, 02, ...) di folder. */
window.fetchPhotos = async function (manifestUrl) {
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    return (Array.isArray(list) ? list : []).sort((a, b) =>
      (a.jpg || "").localeCompare(b.jpg || "")
    );
  } catch (err) {
    console.error("Gagal memuat manifest foto:", manifestUrl, err);
    return [];
  }
};

/** Panggil fn begitu undangan "dibuka" (klik Buka Undangan). Dipakai untuk
 * init Swiper: kalau di-init saat #invitation masih display:none, kontainer
 * berukuran 0 → autoplay tidak jalan sampai user menyentuh slider. */
window.whenInvitationOpen = function (fn) {
  if (window.__invitationOpen) fn();
  else (window.__openCallbacks = window.__openCallbacks || []).push(fn);
};

/** Hentikan autoplay slider saat kontainernya jauh di luar layar, jalankan lagi
 * saat mendekat. Ada 5 slider di halaman ini — kalau semuanya autoplay terus,
 * HP membakar frame budget untuk transisi yang tidak dilihat siapa pun, persis
 * saat animasi reveal butuh frame itu. */
window.pauseAutoplayOffscreen = function (swiper, el) {
  if (!swiper || !swiper.autoplay || !el || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) swiper.autoplay.start();
        else swiper.autoplay.stop();
      });
    },
    // Margin longgar: slider sudah berjalan sebelum benar-benar terlihat, jadi
    // tamu tidak pernah memergoki slide dalam keadaan diam.
    { rootMargin: "50% 0px 50% 0px" }
  ).observe(el);
};

/** Bangun slide Swiper (picture + webp fallback jpg) dari item manifest. */
window.buildPhotoSlide = function (item, cls) {
  const slide = document.createElement("div");
  slide.className = `swiper-slide ${cls}`;
  slide.innerHTML = `
    <picture>
      <source srcset="${item.webp}" type="image/webp">
      <img src="${item.jpg}" alt="" loading="lazy">
    </picture>`;
  return slide;
};
