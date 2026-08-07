/** Kartu Event (Akad & Resepsi): 4/10 atas = slider foto pasangan (auto + swipe),
 * 6/10 bawah = kanvas informasi acara. Foto di-fetch dari manifest folder
 * foto_slider_section_2 (urutan by name). */
window.initEventCards = async function () {
  const cfg = window.WEDDING_CONFIG;
  const photos = await window.fetchPhotos(cfg.event && cfg.event.manifest);
  if (!photos.length) return;

  ["akad", "resepsi"].forEach((key) => {
    const wrapper = document.getElementById(`event-${key}-wrapper`);
    if (!wrapper) return;
    photos.forEach((item) => wrapper.appendChild(window.buildPhotoSlide(item, "event-slide")));
  });

  if (!window.Swiper) return;
  // Init Swiper ditunda sampai undangan dibuka (klik "Buka Undangan") — kalau
  // di-init saat body masih display:none, kontainer berukuran 0 dan autoplay
  // tidak jalan sampai user menyentuh slider.
  window.whenInvitationOpen(() => {
    ["event-akad-slider", "event-resepsi-slider"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.querySelectorAll(".event-slide").length > 1) {
        new Swiper(`#${id}`, {
          loop: true,
          speed: 900,
          observer: true,
          autoplay: { delay: 3000, disableOnInteraction: false }
        });
      }
    });
  });
};
