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
 * 2. Digeser jari seperti menggulir daftar — `freeMode` melepas kewajiban
 *    berhenti pas di tepi foto, `momentum` membuat lemparan meluncur lalu
 *    melambat sendiri. `sticky: false` penting: kalau true, di akhir luncuran
 *    pita akan menarik diri agar rapi ke foto terdekat, dan rasa "lempar
 *    bebas"-nya hilang. */
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
      autoplay: {
        delay: 0, // tanpa jeda antar foto -> aliran tak terputus
        disableOnInteraction: false // digeser tamu, alirannya lanjut lagi
      },
      freeMode: {
        enabled: true,
        momentum: true,
        momentumRatio: 1,
        momentumVelocityRatio: 1,
        sticky: false // jangan merapikan diri ke tepi foto di akhir luncuran
      },
      breakpoints: {
        768: { slidesPerView: 5, spaceBetween: 14 }
      }
    });
    window.pauseAutoplayOffscreen(swiper, document.querySelector(".wfl-slider"));
  });
};
