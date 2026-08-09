/** Section "We Found Love": pita foto 1:1 yang MENGALIR TERUS, bukan melangkah
 * satu foto lalu diam. Foto dari payload Supabase (folder 'wfl'), cadangan
 * manifest lokal kalau payload tidak tersedia.
 *
 * Dua perilaku yang membentuknya:
 *
 * 1. Otomatis mengalir tanpa henti — `delay: 0` membuat Swiper tidak pernah
 *    berhenti di antara slide, dan `speed` yang besar mengubah perpindahan
 *    yang tadinya cepat-lalu-diam menjadi hanyutan pelan yang tak terputus.
 *    Wajib berpasangan dengan timing-function `linear` di CSS: dengan easing
 *    bawaan, tiap slide akan terasa melambat di ujungnya dan hanyutannya
 *    tersendat-sendat, bukan rata.
 *
 * 2. Tetap dapat disentuh/digeser tamu. Setelah interaksi, autoplay langsung
 *    mengambil alih lagi agar pita tetap mengalir terus. */
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
      // Lama satu foto menghanyut melintas. Karena delay-nya 0, angka ini yang
      // menentukan KECEPATAN aliran, bukan lagi lama sebuah transisi.
      speed: 4000,
      observer: true,
      // freeMode menghentikan siklus autoplay Swiper setelah transisi pertama
      // pada konfigurasi loop + delay: 0. Autoplay linear tetap bisa disentuh
      // dan akan langsung melanjutkan aliran sesudah interaksi.
      freeMode: false,
      autoplay: {
        delay: 0, // tanpa jeda antar foto -> aliran tak terputus
        disableOnInteraction: false, // digeser tamu, alirannya lanjut lagi
        waitForTransition: false
      },
      // Swiper 11 dapat membiarkan timer autoplay berstatus "running" namun
      // tidak menjadwalkan langkah berikutnya setelah transisi loop pertama.
      // Memulai ulang timer tepat di akhir setiap transisi memastikan pita
      // langsung meneruskan perjalanan tanpa jeda.
      on: {
        transitionEnd(instance) {
          if (!instance.destroyed && instance.autoplay.running) {
            instance.autoplay.stop();
            instance.autoplay.start();
          }
        }
      },
      breakpoints: {
        768: { slidesPerView: 5, spaceBetween: 14 }
      }
    });
    window.pauseAutoplayOffscreen(swiper, document.querySelector(".wfl-slider"));
  });
};
