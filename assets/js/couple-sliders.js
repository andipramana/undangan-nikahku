/** Section Kedua Mempelai: 2 slideshow foto besar (3/4 layar) — wanita lalu pria.
 * Auto-slide pelan + bisa digeser user, dengan info mempelai di overlay bawah.
 * Foto di-fetch dari manifest folder foto_bride / foto_groom (urutan by name). */
window.initCoupleSliders = async function () {
  const cfg = window.WEDDING_CONFIG;
  if (!cfg.coupleSlides) return;

  const [bridePhotos, groomPhotos] = await Promise.all([
    window.fetchPhotos(cfg.coupleSlides.brideManifest),
    window.fetchPhotos(cfg.coupleSlides.groomManifest)
  ]);

  [
    ["bride", bridePhotos],
    ["groom", groomPhotos]
  ].forEach(([key, photos]) => {
    const wrapper = document.getElementById(`${key}-slider-wrapper`);
    if (!wrapper || !photos.length) return;
    photos.forEach((item) => wrapper.appendChild(window.buildPhotoSlide(item, "couple-slide")));
  });

  if (!window.Swiper) return;
  // Init Swiper ditunda sampai undangan dibuka (klik "Buka Undangan") — kalau
  // di-init saat body masih display:none, kontainer berukuran 0 dan autoplay
  // tidak jalan sampai user menyentuh slider.
  window.whenInvitationOpen(() => {
    ["bride-slider", "groom-slider"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.querySelectorAll(".couple-slide").length > 1) {
        new Swiper(`#${id}`, {
          loop: true,
          speed: 1200, // transisi pelan
          observer: true,
          autoplay: {
            delay: 2500,
            disableOnInteraction: false,
            // Slide pria jalan berlawanan arah dengan slide wanita (dari kiri ke
            // kanan). Pakai reverseDirection, bukan rtl, supaya arah swipe user
            // tetap konsisten (geser kiri = foto berikutnya, sama seperti bride).
            reverseDirection: id === "groom-slider"
          }
        });
      }
    });
  });
};
