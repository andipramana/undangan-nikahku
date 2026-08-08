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
 * Tambahan `data-count` pada elemen berisi angka: angkanya naik TURUN
 * BERURUTAN satu angka satu angka (1, 2, 3, …) ke puncak, lalu turun lagi ke
 * angka aslinya bersamaan dengan reveal-nya (dipakai angka tanggal, tahun,
 * jam, menit di kartu event, dan tanggal timeline Love Story). Perubahannya
 * cepat (tiap 40ms) dan totalnya pendek — tidak ada angka yang dilompati.
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
  const STEP_MS = 40; // naik/turun SATU angka tiap 40ms — cepat, tapi tetap terbaca
  const MAX_CLIMB = 30; // batas langkah pendakian, jaga total tetap pendek
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

  /** Angka naik BERURUTAN (1, 2, 3, …) ke puncak lalu turun BERURUTAN ke
   *  angka aslinya — tiap langkah ±1, tidak ada yang dilompati, mendarat
   *  TEPAT di target. Puncaknya: batas natural unit untuk data-count berunit
   *  (tanggal/jam/menit/detik), atau sedikit DI ATAS target (data-count tanpa
   *  nilai, mis. tahun — tahun tidak mungkin dihitung dari 1). Kalau mulai
   *  dari bawah membuat animasi kepanjangan, pendakiannya dipotong sampai
   *  MAX_CLIMB langkah — total hampir selalu di bawah 2 detik. */
  function countUp(el) {
    const raw = el.textContent.trim();
    // HANYA animasikan teks angka MURNI ("2020", "25"). Teks campuran —
    // tanggal Love Story misalnya ("17 Agustus 2020") — diLEWATI tanpa
    // menyentuh textContent: parseInt hanya membaca angka di depan, dan
    // menimpa isi elemen akan menghancurkan sisa teksnya secara permanen.
    if (!/^\d+$/.test(raw)) return;
    const target = parseInt(raw, 10);
    if (!Number.isFinite(target) || target <= 1) return;
    const maxVal = UNIT_MAX[el.dataset.count] ?? null;
    // Puncak & titik start pendakian
    let lo = maxVal != null ? 1 : Math.max(1, target - MAX_CLIMB);
    const top = maxVal != null ? Math.min(maxVal, target + 6) : target + 5;
    if (top - lo > MAX_CLIMB) lo = top - MAX_CLIMB;
    const upSteps = top - lo; // naik: lo, lo+1, …, top
    const downSteps = top - target; // turun: top-1, …, target
    const total = upSteps + downSteps;
    const t0 = performance.now();
    let lastK = -1;
    (function frame(now) {
      const k = Math.floor((now - t0) / STEP_MS);
      if (k >= total) {
        el.textContent = String(target); // mendarat TEPAT, tidak boleh meleset
        return;
      }
      if (k !== lastK) {
        lastK = k;
        el.textContent = String(k < upSteps ? lo + k : top - (k - upSteps));
      }
      requestAnimationFrame(frame);
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

  /** Reveal LANGSUNG semua elemen di dalam root, tanpa menunggu reveal point
   *  scroll — dipakai konten yang baru tampil di layar lewat aksi pengunjung
   *  (panel amplop, modal), bukan lewat scroll: tidak masuk akal menyuruh
   *  pengunjung menggulir dulu untuk melihat isi panel yang baru dibukanya.
   *  Elemen di-unregister dari observer (fire) supaya tidak double-reveal.
   *  Ditunda dua frame: elemen baru dirender dari display:none — tanpa jeda,
   *  class is-revealed menempel di frame yang sama dan transition tidak sempat
   *  melihat state awalnya (elemen melompat ke akhir tanpa animasi). */
  window.revealNow = function (root) {
    const r = root || document;
    if (!observer) {
      revealAll(r); // reduced-motion / tanpa IO: langsung, tanpa animasi
      return;
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (r.matches && r.matches(GROUP)) fire(r);
        r.querySelectorAll(GROUP).forEach(fire);
        r.querySelectorAll(HIDDEN).forEach((el) => {
          if (!insideGroup(el)) fire(el);
        });
      })
    );
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
