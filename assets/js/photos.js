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
