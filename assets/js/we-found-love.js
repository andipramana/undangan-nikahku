/** Section "We Found Love": slider foto ratio 1:1 (Swiper) — infinite loop,
 * bisa digeser user ke dua arah. Foto dari payload Supabase (folder 'wfl'),
 * cadangan manifest lokal kalau payload tidak tersedia. */
window.initWeFoundLove = async function () {
  const wrapper = document.getElementById("wfl-slider-wrapper");
  if (!wrapper) return;

  const photos = (await window.getPhotos("wfl")) || [];
  if (!photos.length) return;

  photos.forEach((item) => wrapper.appendChild(window.buildPhotoSlide(item, "wfl-slide")));

  if (!window.Swiper) return;
  // Init Swiper ditunda sampai undangan dibuka (klik "Buka Undangan") — kalau
  // di-init saat body masih display:none, kontainer berukuran 0 dan autoplay
  // tidak jalan sampai user menyentuh slider.
  window.whenInvitationOpen(() => {
    const swiper = new Swiper(".wfl-slider", {
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
    window.pauseAutoplayOffscreen(swiper, document.querySelector(".wfl-slider"));
  });
};
