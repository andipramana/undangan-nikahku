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
  ["event-akad-slider", "event-resepsi-slider"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.querySelectorAll(".event-slide").length > 1) {
      new Swiper(`#${id}`, {
        loop: true,
        speed: 900,
        autoplay: { delay: 3000, disableOnInteraction: false }
      });
    }
  });
};
