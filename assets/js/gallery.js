/** Muat manifest galeri, render grid masonry (selang-seling landscape/portrait) + lightbox. */
window.initGallery = async function () {
  const wrapper = document.getElementById("gallery-wrapper");
  if (!wrapper) return;

  let manifest = [];
  try {
    const res = await fetch(window.WEDDING_CONFIG.gallery.manifestUrl);
    manifest = await res.json();
  } catch (err) {
    console.error("Gagal memuat galeri:", err);
    return;
  }

  // Pola selang-seling: tiap kelipatan-3 tampil full-width (landscape), sisanya setengah (portrait).
  wrapper.innerHTML = manifest
    .map((item, i) => {
      const wide = i % 3 === 0;
      return `
    <div class="gallery-item${wide ? " gallery-item--wide" : ""}" data-full="${item.jpg}">
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
