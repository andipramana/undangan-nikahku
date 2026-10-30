/** Section Kedua Mempelai: 2 slideshow foto besar (3/4 layar) — wanita lalu pria.
 * Auto-slide pelan + bisa digeser user, dengan info mempelai di overlay bawah.
 * Foto dari payload Supabase (folder 'bride'/'groom'), cadangan manifest lokal.
 * Berjalan dengan slider ringan berbasis CSS flex + pointer/touch swipe (tanpa
 * pustaka Swiper 150 KB), tetap kompatibel dengan window.pauseAutoplayOffscreen. */
window.initCoupleSliders = async function () {
  const [bridePhotos, groomPhotos] = await Promise.all([
    window.getPhotos("bride"),
    window.getPhotos("groom")
  ]);

  [
    ["bride", bridePhotos],
    ["groom", groomPhotos]
  ].forEach(([key, photos]) => {
    const wrapper = document.getElementById(`${key}-slider-wrapper`);
    if (!wrapper || !(photos && photos.length)) return;
    wrapper.innerHTML = "";
    photos.forEach((item, idx) => {
      const slide = window.buildPhotoSlide(item, "couple-slide");
      if (idx === 0) slide.classList.add("swiper-slide-active");
      wrapper.appendChild(slide);
    });
  });

  function createNativeCoupleSlider(el, opts) {
    const wrapper = el.querySelector(".swiper-wrapper");
    const slides = Array.from(el.querySelectorAll(".couple-slide"));
    if (!wrapper || slides.length <= 1) return null;

    const count = slides.length;
    // Loop sungguhan: klon foto terakhir di depan dan foto pertama di belakang.
    // Dari foto terakhir slider terus maju ke klon foto pertama (searah), lalu
    // posisinya dikembalikan ke foto asli TANPA transisi — tidak pernah memutar
    // mundur melewati semua foto.
    const cloneOf = (node) => {
      const c = node.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      c.dataset.clone = "1";
      c.classList.remove("swiper-slide-active");
      return c;
    };
    wrapper.insertBefore(cloneOf(slides[count - 1]), wrapper.firstChild);
    wrapper.appendChild(cloneOf(slides[0]));

    let index = 0;       // posisi saat ini: -1 (klon terakhir) … count (klon pertama)
    let timer = null;
    let jumpTimer = null;
    const delay = (opts && opts.delay) || 2500;
    const reverse = Boolean(opts && opts.reverseDirection);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function place(pos, animate) {
      wrapper.style.transition = animate ? "" : "none";
      wrapper.style.transform = `translate3d(${-(pos + 1) * 100}%, 0, 0)`;
      if (!animate) void wrapper.offsetWidth;   // terapkan posisi dulu sebelum transisi dinyalakan lagi
      if (!animate) wrapper.style.transition = "";
    }

    // Mendarat di klon → pindah diam-diam ke foto asli yang kembar.
    function settle() {
      clearTimeout(jumpTimer);
      jumpTimer = null;
      if (index === count || index === -1) {
        index = index === count ? 0 : count - 1;
        place(index, false);
      }
    }

    function goTo(nextIdx) {
      settle();                                   // geseran cepat beruntun: selesaikan lompatan yang tertunda
      index = Math.max(-1, Math.min(count, nextIdx));
      const real = ((index % count) + count) % count;
      slides.forEach((sl, i) => sl.classList.toggle("swiper-slide-active", i === real));
      place(index, true);
      if (index === count || index === -1) jumpTimer = setTimeout(settle, 1300);
    }

    wrapper.addEventListener("transitionend", (e) => {
      if (e.target === wrapper) settle();
    });
    place(0, false);

    function step() {
      goTo(reverse ? index - 1 : index + 1);
    }

    const autoplay = {
      start() {
        if (reduced || timer) return;
        timer = setInterval(step, delay);
      },
      stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };

    el.style.touchAction = "pan-y";   // geser horizontal untuk slider, vertikal tetap scroll halaman
    let startX = null;
    el.addEventListener("pointerdown", (e) => {
      startX = e.clientX;
    }, { passive: true });
    el.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) {
        goTo(dx < 0 ? index + 1 : index - 1);
        if (timer) { clearInterval(timer); timer = setInterval(step, delay); }   // beri tamu waktu melihat foto
      }
    }, { passive: true });

    return { autoplay, slideTo: goTo };
  }

  // Init ditunda sampai undangan dibuka (klik "Buka Undangan") — kalau di-init
  // saat body masih display:none, kontainer berukuran 0.
  window.whenInvitationOpen(() => {
    ["bride-slider", "groom-slider"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.querySelectorAll(".couple-slide").length > 1) {
        const controller = window.Swiper
          ? new window.Swiper(`#${id}`, {
              loop: true,
              speed: 1200,
              observer: true,
              autoplay: {
                delay: 2500,
                disableOnInteraction: false,
                reverseDirection: id === "groom-slider"
              }
            })
          : createNativeCoupleSlider(el, {
              delay: 2500,
              reverseDirection: id === "groom-slider"
            });
        if (controller && window.pauseAutoplayOffscreen) {
          window.pauseAutoplayOffscreen(controller, el);
        }
      }
    });
  });
};
