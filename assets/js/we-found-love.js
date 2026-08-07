/** Section "We Found Love": slider foto ratio 1:1 (Swiper) — infinite loop,
 * bisa digeser user ke dua arah. Foto di-fetch dari manifest folder
 * foto_slider_section_1 (urutan by name). */
window.initWeFoundLove = async function () {
  const cfg = window.WEDDING_CONFIG;
  const wrapper = document.getElementById("wfl-slider-wrapper");
  if (!wrapper || !(cfg.weFoundLove && cfg.weFoundLove.manifest)) return;

  const photos = await window.fetchPhotos(cfg.weFoundLove.manifest);
  if (!photos.length) return;

  photos.forEach((item) => wrapper.appendChild(window.buildPhotoSlide(item, "wfl-slide")));

  if (!window.Swiper) return;
  // Init Swiper ditunda sampai undangan dibuka (klik "Buka Undangan") — kalau
  // di-init saat body masih display:none, kontainer berukuran 0 dan autoplay
  // tidak jalan sampai user menyentuh slider.
  window.whenInvitationOpen(() => {
    new Swiper(".wfl-slider", {
      loop: true,
      slidesPerView: 3,
      spaceBetween: 10,
      speed: 500,
      observer: true,
      autoplay: { delay: 1800, disableOnInteraction: false },
      breakpoints: {
        768: { slidesPerView: 5, spaceBetween: 14 }
      }
    });
  });
};
