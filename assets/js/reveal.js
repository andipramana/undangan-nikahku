/** Scroll-reveal untuk section DI BAWAH cover: elemen ber-atribut `data-reveal`
 * mulai tersembunyi, lalu dapat class `.is-revealed` saat masuk viewport (sekali
 * saja, tidak diulang saat discroll balik). Polanya sengaja dibuat sama dengan
 * `.text-enter` + `.text-revealed` di section Save The Date: CSS transition
 * biasa, JS cuma menempel class.
 *
 * Varian gerak ditentukan nilai atributnya (up / down / zoom-left / slide-right /
 * tilt-left / pop / ..., lihat style.css), jeda antar elemen satu grup pakai
 * custom property `style="--reveal-i:N"` -> delay N x 80ms, dan durasinya bisa
 * ditimpa per elemen lewat `--reveal-dur`.
 *
 * `data-reveal-group` pada sebuah kontainer = satu paket informasi: seluruh
 * isinya tampil bersamaan begitu kontainernya masuk layar, bukan satu per satu
 * mengikuti scroll. Dipakai untuk hal yang memang tak terpisahkan — bismillah +
 * ayat + sumbernya, atau nama acara + tanggal + lokasinya.
 *
 * Tambahan `data-count` pada elemen berisi angka: angkanya berputar cepat dari 1
 * ke nilai aslinya bersamaan dengan reveal-nya (dipakai angka tanggal di kartu
 * event).
 *
 * Semua state tersembunyi digantung pada `html.reveal-ready` yang dipasang di
 * sini: kalau file ini gagal dimuat/error, tidak ada satu pun konten yang
 * terjebak opacity 0.
 *
 * PENTING — section #cover tetap memakai AOS (atribut `data-aos`) dan section
 * #opening (Save The Date) tetap memakai `.text-enter`. Keduanya sudah pas dan
 * sengaja TIDAK dipindah ke mekanisme ini. */
(function () {
  const HIDDEN = "[data-reveal]:not(.is-revealed)";
  const GROUP = "[data-reveal-group]";
  const COUNT_DURATION = 1400;
  const seen = new WeakSet(); // elemen yang sudah diserahkan ke observer
  let observer = null; // pemicu utama: tepi atas elemen melewati tengah layar
  let early = null; // pemicu awal (data-reveal-early): begitu menyentuh layar
  let fullyVisible = null; // jaring pengaman: elemen terlihat utuh di layar
  let started = false; // initReveal sudah jalan?
  let animate = true; // false saat reduced-motion / tanpa IntersectionObserver

  /** Batas natural tiap unit berangka — dipakai untuk animasi "overshoot lalu
   *  turun": naik dulu dari 0 sampai batas unit, BARU turun ke angka asli
   *  (tanggal 31, jam 24, menit/detik 60). `data-count` TANPA nilai = ramp
   *  naik biasa (perilaku lama) — untuk angka tanpa batas kecil seperti tahun. */
  const UNIT_MAX = { date: 31, hour: 24, minute: 60, second: 60 };

  /** Angka berputar dari 1 ke nilai aslinya, melambat di ujung. Untuk unit
   *  berbatas natural (`data-count="date/hour/minute/second"`): naik ke batas
   *  lalu turun mengecil ke target — mendarat TEPAT di angka asli. */
  function countUp(el) {
    const target = parseInt(el.textContent, 10);
    if (!Number.isFinite(target) || target <= 1) return;
    const maxVal = UNIT_MAX[el.dataset.count] ?? null; // null = ramp naik 1x
    const t0 = performance.now();
    (function frame(now) {
      const p = Math.min((now - t0) / COUNT_DURATION, 1);
      let v;
      if (maxVal == null) {
        const eased = 1 - Math.pow(1 - p, 3);
        v = Math.max(1, Math.round(target * eased));
      } else if (p < 0.55) {
        // Fase 1 (~55% durasi): 0 -> batas unit, ease-out supaya berhenti mulus
        const q = p / 0.55;
        v = Math.round(maxVal * (1 - Math.pow(1 - q, 2)));
      } else {
        // Fase 2 (45% sisanya): batas -> target asli, ease-in; landas persis
        // di angka target, tidak boleh meleset.
        const q = (p - 0.55) / 0.45;
        v = Math.round(maxVal - (maxVal - target) * q * q);
      }
      if (p < 1) {
        el.textContent = String(v);
        requestAnimationFrame(frame);
      } else {
        el.textContent = String(target);
      }
    })(t0);
  }

  function reveal(el) {
    el.classList.add("is-revealed");
    if (animate && el.hasAttribute("data-count")) countUp(el);
  }

  /** Satu paket informasi tampil bersamaan: begitu kontainernya masuk layar,
   * seluruh isinya direveal sekaligus (jeda internal --reveal-i tetap berlaku).
   * Dipakai untuk hal yang tidak masuk akal kalau muncul satu-satu sambil
   * discroll — bismillah + ayat + sumbernya, nama acara + tanggal + lokasinya. */
  function revealGroup(el) {
    if (el.hasAttribute("data-reveal")) reveal(el);
    el.querySelectorAll(HIDDEN).forEach(reveal);
  }

  function revealAll(root) {
    const r = root || document;
    if (r.matches && r.matches(HIDDEN)) reveal(r);
    r.querySelectorAll(HIDDEN).forEach(reveal);
  }

  /** true kalau elemen ini isi sebuah grup — berarti bukan dia yang diobservasi,
   * melainkan kontainer grupnya. */
  function insideGroup(el) {
    const g = el.closest(GROUP);
    return !!g && g !== el;
  }

  /** Jalankan reveal-nya lalu lepas dari kedua observer — sekali tampil,
   * selamanya tampil. */
  function fire(el) {
    if (el.matches(GROUP)) revealGroup(el);
    else reveal(el);
    observer.unobserve(el);
    early.unobserve(el);
    fullyVisible.unobserve(el);
  }

  function register(el) {
    if (seen.has(el)) return;
    seen.add(el);
    // Elemen setinggi hampir selayar (blok mempelai) tidak pernah bisa "melewati
    // tengah layar" tanpa lebih dulu memenuhi pandangan — menunggu ambang tengah
    // membuatnya terasa telat hidup. `data-reveal-early` memakai ambang yang
    // menyala begitu elemennya menyentuh layar.
    (el.hasAttribute("data-reveal-early") ? early : observer).observe(el);
    fullyVisible.observe(el);
  }

  /** Observe elemen `data-reveal` yang belum terdaftar. Aman dipanggil berkali-kali
   * — dipakai ulang setiap ada konten baru di-render (galeri, ucapan, dst). */
  window.revealScan = function (root) {
    // Dipanggil sebelum initReveal (mis. fetch selesai lebih dulu): abaikan saja,
    // scan awal di initReveal nanti tetap menangkap elemennya.
    if (!started) return;
    if (!observer) {
      revealAll(root);
      return;
    }
    const r = root || document;
    if (r.matches && r.matches(GROUP)) register(r);
    r.querySelectorAll(GROUP).forEach(register);
    r.querySelectorAll(HIDDEN).forEach((el) => {
      if (!insideGroup(el)) register(el);
    });
  };

  // Nama lama — beberapa modul memanggilnya setelah me-render konten baru.
  window.refreshReveal = window.revealScan;

  window.initReveal = function () {
    // Cover masih pakai AOS — biarkan apa adanya.
    if (window.AOS) {
      AOS.init({ duration: 1600, once: true, offset: 60, easing: "ease" });
    }

    document.documentElement.classList.add("reveal-ready");
    started = true;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      animate = false;
      revealAll();
      return;
    }

    const onIntersect = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) fire(entry.target);
      });
    };

    // Pemicu utama: elemen baru direveal setelah tepi atasnya melewati kira-kira
    // TENGAH layar. Sebelumnya cuma -12% (nyaris di tepi bawah), akibatnya
    // animasinya sudah selesai sebelum benar-benar masuk pandangan.
    observer = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px -45% 0px",
      threshold: 0
    });

    // Pemicu awal untuk elemen yang tingginya hampir selayar: menyala begitu
    // tepi atasnya menyentuh layar, tidak menunggu sampai tengah.
    early = new IntersectionObserver(onIntersect, {
      rootMargin: "0px 0px -5% 0px",
      threshold: 0
    });

    // Jaring pengaman untuk pemicu di atas: elemen yang posisinya permanen di
    // sepertiga bawah halaman — footer misalnya — tepi atasnya TIDAK PERNAH
    // sampai ke tengah layar walau sudah discroll mentok, jadi selamanya tak
    // terpicu dan isinya tidak akan pernah terlihat. Observer kedua ini
    // menangkapnya: begitu elemen terlihat utuh di layar, reveal saja.
    fullyVisible = new IntersectionObserver(onIntersect, { threshold: 0.99 });

    window.revealScan();
  };
})();
