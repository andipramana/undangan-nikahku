/** Render grid galeri dari manifest folder foto_gallery (urutan by name) + lightbox. */
window.initGallery = async function () {
  const wrapper = document.getElementById("gallery-wrapper");
  if (!wrapper) return;

  const photos = await window.fetchPhotos(window.WEDDING_CONFIG.gallery.manifest);
  if (!photos.length) return;

  // Pola baris (14 baris, 20 foto): pola 7 baris diulang 2×, baris terakhir landscape penutup.
  const PATTERN = [
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "quarter",
    "threequarter",
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "quarter",
    "threequarter",
    "landscape",
    "portrait",
    "portrait",
    "landscape"
  ];
  wrapper.innerHTML = photos
    .map((item, i) => {
      const cls = PATTERN[i] || "landscape";
      return `
    <div class="gallery-item gallery-item--${cls}" data-full="${item.jpg}">
      <picture>
        <source srcset="${item.webp}" type="image/webp">
        <img src="${item.jpg}" alt="Momen ${i + 1}" loading="lazy">
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

  if (window.refreshReveal) window.refreshReveal();
};
