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

    let index = 0;
    let timer = null;
    const delay = (opts && opts.delay) || 2500;
    const reverse = Boolean(opts && opts.reverseDirection);
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function goTo(nextIdx) {
      index = ((nextIdx % slides.length) + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("swiper-slide-active", i === index));
      wrapper.style.transform = `translate3d(${-index * 100}%, 0, 0)`;
    }

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
