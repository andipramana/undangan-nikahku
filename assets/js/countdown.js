/** Hitung mundur ke tanggal akad, update tiap detik.
 *
 * Keempat angka dianimasikan SEKALI saja saat countdown pertama kali masuk
 * layar (bukan tiap detik): angkanya naik BERURUTAN satu angka satu angka
 * (1, 2, 3, …) ke puncak lalu turun berurutan ke nilai aslinya — tiap langkah
 * ±1, tidak ada yang dilompati. Hari mulai dari dekat nilainya (bisa ratusan,
 * tidak mungkin dihitung dari 1); Jam/Menit/Detik naik dari 1 ke batas natural
 * unitnya (24/60/60) atau sedikit di atas target.
 *
 * Pemicunya menunggu class `.text-revealed` pada #opening (di-observasi, bukan
 * diubah): saat halaman load, undangan masih terkunci dan countdown
 * display:none — kalau animasi dijalankan saat itu juga, ia habis di balik
 * layar. Interval detik baru mulai SETELAH animasi selesai, dan dari situ
 * tick polos mengganti teks tanpa animasi lagi. */
window.initCountdown = function () {
  const STEP_MS = 40; // naik/turun SATU angka tiap 40ms — cepat, tapi tetap terbaca
  const MAX_CLIMB = 30; // batas langkah pendakian, jaga total tetap pendek

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function compute() {
    const target = new Date(window.WEDDING_CONFIG.event.countdownTarget).getTime();
    let diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);
    return { days, hours, minutes, seconds };
  }

  function tick() {
    const t = compute();
    setText("cd-days", pad(t.days));
    setText("cd-hours", pad(t.hours));
    setText("cd-minutes", pad(t.minutes));
    setText("cd-seconds", pad(t.seconds));
  }

  /** Animasi sekali jalan — naik BERURUTAN ke puncak lalu turun berurutan ke
   * target, model yang sama dengan countUp di reveal.js. `max` null = naik
   * dari dekat target sendiri (Hari); selain itu naik dari 1 ke batas natural
   * unitnya (24/60/60) atau sedikit di atas target. Target <= 1 tidak
   * dianimasikan (angka sudah tidak menarik dimuter), langsung ditulis
   * nilainya supaya tidak nyangkut di placeholder "00". Mengembalikan jumlah
   * langkahnya (0 kalau tidak dianimasikan) — dipakai start() untuk tahu kapan
   * animasi terlama selesai. */
  function animateFirst(el, target, max) {
    if (!el) return 0;
    if (!Number.isFinite(target) || target <= 1) {
      el.textContent = pad(Math.max(0, target || 0));
      return 0;
    }
    // Puncak & titik start pendakian (sama dengan countUp di reveal.js)
    let lo = max != null ? 1 : Math.max(1, target - MAX_CLIMB);
    const top = max != null ? Math.min(max, target + 6) : target + 5;
    if (top - lo > MAX_CLIMB) lo = top - MAX_CLIMB;
    const upSteps = top - lo; // naik: lo, lo+1, …, top
    const downSteps = top - target; // turun: top-1, …, target
    const total = upSteps + downSteps;
    const t0 = performance.now();
    let lastK = -1;
    (function frame(now) {
      const k = Math.floor((now - t0) / STEP_MS);
      if (k >= total) {
        el.textContent = pad(target); // mendarat TEPAT, tidak boleh meleset
        return;
      }
      if (k !== lastK) {
        lastK = k;
        el.textContent = pad(k < upSteps ? lo + k : top - (k - upSteps));
      }
      requestAnimationFrame(frame);
    })(t0);
    return total;
  }

  function start() {
    const first = compute();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Tanpa animasi: langsung isi nilai + interval normal.
      tick();
      setInterval(tick, 1000);
      return;
    }
    // Tanggal & tahun di baris "Selasa, 25 Agustus 2026" sengaja TIDAK
    // dianimasikan — kurang cocok, biar tampil tenang apa adanya.
    // Interval baru mulai setelah animasi TERLAMA selesai (masing-masing item
    // langkahnya beda) — tick polos tiap detik, TANPA animasi lagi.
    const steps = [
      animateFirst(document.getElementById("cd-days"), first.days, null),
      animateFirst(document.getElementById("cd-hours"), first.hours, 24),
      animateFirst(document.getElementById("cd-minutes"), first.minutes, 60),
      animateFirst(document.getElementById("cd-seconds"), first.seconds, 60)
    ];
    setTimeout(() => {
      tick();
      setInterval(tick, 1000);
    }, Math.max(...steps) * STEP_MS);
  }

  // Tunggu sampai teks section countdown benar-benar masuk layar (class
  // text-revealed dipasang main.js). Kalau sudah/belum ada elemennya, mulai
  // langsung. (Tanggal/countdown sekarang ada di #save-the-date-2, bukan #opening.)
  const std2 = document.getElementById("save-the-date-2");
  if (std2 && !std2.classList.contains("text-revealed")) {
    new MutationObserver((mutations, obs) => {
      if (!std2.classList.contains("text-revealed")) return;
      obs.disconnect();
      start();
    }).observe(std2, { attributes: true, attributeFilter: ["class"] });
  } else {
    start();
  }
};
