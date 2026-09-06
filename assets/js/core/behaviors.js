/** Perilaku umum yang butuh elemen, tapi tidak butuh markup tertentu.
 *
 * Bedanya dengan modul di assets/js/*.js (countdown.js, audio-player.js):
 * modul-modul itu MENCARI SENDIRI elemen milik template klasik lewat id yang
 * dihardcode (#save-the-date-2, #audio-toggle-icon), jadi template lain tidak
 * bisa memakainya. Di sini elemennya DISERAHKAN template — jadi tiap template
 * bebas menamai dan menata elemennya sendiri, tanpa menyalin ulang logika
 * hitung mundur atau aturan autoplay browser.
 *
 * Sesuai kontrak core (docs/kontrak-template.md): file ini tidak membuat satu
 * pun elemen visual, hanya mengisi teks dan memasang listener.
 */
(function () {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");

  /** Hitung mundur ke `targetISO`, menulis ke elemen yang diberikan.
   * `els` = { days, hours, minutes, seconds } — elemen yang tidak diberikan
   * dilewati, jadi template yang cuma menampilkan hari pun bisa memakainya.
   * Mengembalikan fungsi penghenti (panggil di destroy()). */
  function countdown(els, targetISO) {
    const target = new Date(targetISO).getTime();
    if (isNaN(target)) return () => {};

    const tick = () => {
      const secs = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (els.days) els.days.textContent = String(Math.floor(secs / 86400));
      if (els.hours) els.hours.textContent = pad(Math.floor(secs / 3600) % 24);
      if (els.minutes) els.minutes.textContent = pad(Math.floor(secs / 60) % 60);
      if (els.seconds) els.seconds.textContent = pad(secs % 60);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }

  /** Backsound + tombol putar/jeda.
   *
   * Autoplay TIDAK dipanggil di sini: browser menolak memutar audio sebelum
   * ada gestur tamu, dan panggilan yang ditolak menyisakan tombol yang tampak
   * menyala padahal diam. Template memanggil `play()` dari handler tombol
   * "Buka Undangan" — itulah gestur yang sah.
   *
   * `btn` diberi kelas `is-playing` saat berbunyi supaya tiap template bisa
   * menggambarkan statusnya sendiri (bar equalizer, ikon, apa pun).
   * Mengembalikan { play, stop } — `stop` melepas listener di destroy().
   */
  function audio(audioEl, btn, cfg) {
    const conf = (cfg && cfg.audio) || {};
    const src = conf.path && window.audioUrl ? window.audioUrl(conf.path) : conf.src;
    if (!audioEl || !btn || !src) return { play() {}, stop() {} };

    audioEl.src = src;
    btn.hidden = false;

    const sync = () => btn.classList.toggle("is-playing", !audioEl.paused);
    const toggle = () => { audioEl.paused ? audioEl.play().catch(() => {}) : audioEl.pause(); };
    btn.addEventListener("click", toggle);
    audioEl.addEventListener("play", sync);
    audioEl.addEventListener("pause", sync);

    return {
      play: () => audioEl.play().catch(() => {}),
      stop() {
        btn.removeEventListener("click", toggle);
        audioEl.removeEventListener("play", sync);
        audioEl.removeEventListener("pause", sync);
        audioEl.pause();
      }
    };
  }

  /** Tandai elemen dengan kelas begitu masuk viewport (sekali saja).
   * Animasinya sepenuhnya urusan CSS template — di sini cuma penanda, supaya
   * tiap template bisa punya gerak masuk yang benar-benar berbeda.
   * Tanpa IntersectionObserver (browser lama), semua langsung ditandai —
   * lebih baik terlihat tanpa animasi daripada tidak terlihat sama sekali. */
  function revealOnView(elements, options) {
    const opts = options || {};
    const cls = opts.className || "is-live";
    const list = [...elements];

    if (!("IntersectionObserver" in window)) {
      list.forEach((el) => el.classList.add(cls));
      return () => {};
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add(cls);
        if (opts.onEnter) opts.onEnter(entry.target);
        if (opts.once !== false) io.unobserve(entry.target);
      });
    }, { threshold: opts.threshold ?? 0.2, rootMargin: opts.rootMargin || "0px" });

    list.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }

  /** Toast ringkas. rsvp.js & gift.js memanggil window.showToast, jadi tiap
   * template yang memuatnya perlu menyediakan satu — ini implementasi
   * bersamanya; kelas & posisinya tetap dari CSS template. */
  function toast(el, options) {
    const ms = (options && options.duration) || 2400;
    const cls = (options && options.className) || "show";
    let timer = null;
    window.showToast = function (message) {
      if (!el) return;
      el.textContent = message;
      el.classList.add(cls);
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove(cls), ms);
    };
    return () => { clearTimeout(timer); };
  }

  window.WeddingBehaviors = { countdown, audio, revealOnView, toast };
})();
