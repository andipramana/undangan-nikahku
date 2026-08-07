/** Render grid galeri dari payload Supabase (folder 'gallery'), cadangan
 * manifest lokal kalau payload tidak tersedia + lightbox. */
window.initGallery = async function () {
  const wrapper = document.getElementById("gallery-wrapper");
  if (!wrapper) return;

  const photos = (await window.getPhotos("gallery")) || [];
  if (!photos.length) return;

  // Pola baris dipegang gallery-layout.js — dipakai bersama panel admin supaya
  // bingkai pratinjau pan/zoom di sana memakai bentuk kotak yang sama persis
  // dengan yang dirender di sini.
  const PATTERN = window.GalleryLayout.PATTERN;
  /** Gerak masuk per foto, ditentukan posisinya dalam baris grid:
   *  - baris berisi DUA foto -> yang kiri meluncur dari kiri, yang kanan dari
   *    kanan, keduanya bersamaan sehingga terlihat seperti pintu yang menutup.
   *    Ada dua bentuk baris begini: portrait+portrait, dan third+twothirds.
   *  - baris satu foto selebar grid (landscape) -> mengembang di tempat.
   * Pasangan portrait dibedakan lewat item sebelumnya, bukan sesudahnya, supaya
   * penentuannya tetap benar dibaca berurutan dari atas. */
  function motionFor(i) {
    const cur = PATTERN[i] || "landscape";
    if (cur === "portrait") return PATTERN[i - 1] === "portrait" ? "slide-right" : "slide-left";
    if (cur === "third") return "slide-left";
    if (cur === "twothirds") return "slide-right";
    return "pop";
  }

  // Tanpa --reveal-i: sejak pemicunya digeser ke tengah layar, tiap baris sudah
  // terpicu di posisi scroll-nya masing-masing. Jeda buatan justru merusak
  // kesan dua foto sebaris masuk bersamaan.
  wrapper.innerHTML = photos
    .map((item, i) => {
      const cls = PATTERN[i] || "landscape";
      const src = item.path && !item.webp ? window.photoUrl(item.path) : item.webp || item.jpg;
      const fx = item.focalX ?? 50;
      const fy = item.focalY ?? 50;
      const zoom = item.zoom ?? 1;
      return `
    <div class="gallery-item gallery-item--${cls}" data-full="${src}" data-reveal="${motionFor(i)}">
      <picture>
        <source srcset="${src}" type="image/webp">
        <img src="${src}" alt="Momen ${i + 1}" loading="lazy"
             style="--fx:${fx}%; --fy:${fy}%; --zoom:${zoom}">
      </picture>
    </div>`;
    })
    .join("");

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  function closeLightbox() {
    lightbox.classList.remove("show");
    lightbox.setAttribute("aria-hidden", "true");
  }

  wrapper.addEventListener("click", (e) => {
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    lightboxImg.src = item.dataset.full;
    lightbox.classList.add("show");
    lightbox.setAttribute("aria-hidden", "false");
  });

  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  if (window.revealScan) window.revealScan(wrapper);
};
