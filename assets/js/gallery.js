/** Render grid galeri dari payload Supabase (folder 'gallery'), cadangan
 * manifest lokal kalau payload tidak tersedia + lightbox. */
window.initGallery = async function () {
  const wrapper = document.getElementById("gallery-wrapper");
  if (!wrapper) return;

  const photos = (await window.getPhotos("gallery")) || [];
  if (!photos.length) return;

  /** Gerak masuk per foto, ditentukan posisinya dalam baris grid:
   *  - baris berisi DUA foto -> yang kiri meluncur dari kiri, yang kanan dari
   *    kanan, keduanya bersamaan sehingga terlihat seperti pintu yang menutup.
   *    Ada dua bentuk baris begini: half+half (1/2+1/2), dan third+twothirds
   *    (1/3+2/3) ATAU twothirds+third (2/3+1/3) — admin bebas menaruh mana
   *    saja di kiri/kanan lewat Tab Foto, urutannya TIDAK selalu third dulu.
   *  - baris satu foto selebar grid (full) -> mengembang di tempat.
   * Posisi ditentukan dari LEBAR (span kolom), bukan JENIS bentuknya: kalau
   * lebar foto ini + foto SEBELUMNYA persis mengisi 12 kolom, berarti foto
   * sebelumnya ada di kiri dan foto ini di kanan (slide dari kanan). Kalau
   * tidak, foto ini ada di kiri sendiri/awal pasangan baru (slide dari kiri).
   * PENTING: posisi HARUS dibaca dari shapeAt() (lebar ASLI tiap foto, sama
   * seperti `cls` di bawah) — BUKAN dari GalleryLayout.PATTERN (pola lama 20
   * item, cuma fallback untuk foto tanpa gallery_layout tersimpan).
   * BUG YANG DIPERBAIKI (dilaporkan dari baris 12 galeri nyata, data live
   * tenant root: sort_order 16="twothirds" lalu 17="third" — urutan
   * KEBALIK dari asumsi lama): versi sebelumnya menentukan arah slide dari
   * JENIS bentuknya langsung ("third" selalu dianggap kiri, "twothirds"
   * selalu dianggap kanan) — salah kalau admin menaruh twothirds duluan
   * (di kiri) dan third belakangan (di kanan), arahnya jadi ketukar. */
  function motionFor(i) {
    const cur = window.GalleryLayout.shapeAt(i, photos);
    if (cur === "full") return "pop";
    const prev = window.GalleryLayout.shapeAt(i - 1, photos);
    const SPAN = window.GalleryLayout.SPAN;
    return SPAN[cur] + SPAN[prev] === 12 ? "slide-right" : "slide-left";
  }

  // Video selalu memegang baris visual pertama. Baris yang disimpan admin
  // tetap baris foto (mulai 1), lalu digeser satu saat video aktif agar nilai
  // tersebut tidak perlu berubah hanya karena URL YouTube dinyalakan.
  const videoId = parseYouTubeId(
    window.WEDDING_CONFIG.galleryVideo && window.WEDDING_CONFIG.galleryVideo.youtube
  );
  const videoRowOffset = videoId ? 1 : 0;

  // Tanpa --reveal-i: sejak pemicunya digeser ke tengah layar, tiap baris sudah
  // terpicu di posisi scroll-nya masing-masing. Jeda buatan justru merusak
  // kesan dua foto sebaris masuk bersamaan.
  wrapper.innerHTML = photos
    .map((item, i) => {
      // Layout tidak lagi semata-mata urutan: setiap foto galeri dapat memilih
      // lebar dan nomor barisnya dari Tab Foto. Foto lama memakai pola legacy.
      const cls = window.GalleryLayout.shapeAt(i, photos);
      const row = window.GalleryLayout.rowAt(i, photos);
      const galleryRow = row + videoRowOffset;
      const src = item.path && !item.webp ? window.photoUrl(item.path) : item.webp || item.jpg;
      const fx = item.focalX ?? 50;
      const fy = item.focalY ?? 50;
      const zoom = item.zoom ?? 1;
      return `
    <div class="gallery-item gallery-item--${cls}" style="grid-row:${galleryRow}" data-full="${src}" data-reveal="${motionFor(i)}">
      <picture>
        <source srcset="${src}" type="image/webp">
        <img src="${src}" alt="Momen ${i + 1}" loading="lazy"
             style="--fx:${fx}%; --fy:${fy}%; --zoom:${zoom}">
      </picture>
    </div>`;
    })
    .join("");

  // Slot video sengaja bukan bagian photos/PATTERN. Ia mengunci baris 1 secara
  // eksplisit; foto dengan Baris 1 dirender di baris 2 via videoRowOffset.
  if (videoId) wrapper.prepend(buildVideoSlot(videoId));

  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  function closeLightbox() {
    lightbox.classList.remove("show");
    lightbox.setAttribute("aria-hidden", "true");
  }

  wrapper.addEventListener("click", (e) => {
    // Slot video punya tombol putar sendiri — jangan biarkan kliknya membuka
    // lightbox (data-full-nya tidak ada, akan membuka lightbox kosong).
    if (e.target.closest(".gallery-video")) return;
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

/** Ambil ID video dari URL YouTube — mendukung format watch?v=, youtu.be/,
 * dan embed/. Mengembalikan "" kalau URL kosong atau bukan video YouTube. */
function parseYouTubeId(url) {
  if (!url) return "";
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(url);
  return m ? m[1] : "";
}

/** Thumbnail dulu (hqdefault dari img.youtube.com — tanpa memuat YouTube IFrame
 * API di awal), iframe baru dibuat saat tombol putar diklik. Selaras dengan
 * fokus performa HP proyek ini: tidak ada beban video sebelum diminta. */
function buildVideoSlot(videoId) {
  const slot = document.createElement("div");
  slot.className = "gallery-item gallery-item--landscape gallery-video";
  slot.dataset.reveal = "pop";
  slot.style.gridRow = "1";
  slot.innerHTML = `
    <button type="button" class="gallery-video__launcher" aria-label="Putar video galeri">
      <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="Video galeri" loading="lazy">
      <span class="gallery-video__play">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      </span>
    </button>`;

  const launcher = slot.querySelector(".gallery-video__launcher");
  launcher.addEventListener("click", () => {
    if (slot.querySelector("iframe")) return;
    const frame = document.createElement("iframe");
    frame.className = "gallery-video__frame";
    frame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    frame.setAttribute("allowfullscreen", "");
    launcher.remove();
    slot.appendChild(frame);
  });
  return slot;
}
