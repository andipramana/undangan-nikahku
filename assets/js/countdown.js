/** Hitung mundur ke tanggal akad, update tiap detik.
 *
 * Keempat angka dianimasikan SEKALI saja saat countdown pertama kali masuk
 * layar (bukan tiap detik — kalau overshoot diulang tiap detik hasilnya
 * kacau): Jam/Menit/Detik "overshoot lalu turun" (naik dari 0 ke batas natural
 * unitnya 24/60/60, BARU turun ke nilai aslinya); Hari tidak punya batas
 * natural kecil seperti itu (bisa ratusan), jadi ramp naik biasa 1x.
 *
 * Pemicunya menunggu class `.text-revealed` pada #opening (di-observasi, bukan
 * diubah): saat halaman load, undangan masih terkunci dan countdown
 * display:none — kalau animasi dijalankan saat itu juga, ia habis di balik
 * layar. Interval detik baru mulai SETELAH animasi selesai, dan dari situ
 * tick polos mengganti teks tanpa animasi lagi. */
window.initCountdown = function () {
  const DURATION = 2400; // sama dengan COUNT_DURATION di reveal.js, biar terasa konsisten

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

  /** Animasi sekali jalan. `max` null = ramp naik biasa (Hari); selain itu
   * overshoot ke batas unit lalu turun ke target. Target <= 1 tidak dianimasi
   * (angka sudah tidak menarik dinaikkan) — perilaku sama seperti countUp di
   * reveal.js. */
  function animateFirst(el, target, max) {
    if (!el) return;
    // Target 0/1 tidak dianimasikan (guard sama seperti countUp di reveal.js),
    // tapi elemen ini mulai dari placeholder statis "00" di HTML — tanpa baris
    // ini, target<=1 akan nyangkut di "00" sampai tick() pertama (DURATION ms).
    if (!Number.isFinite(target) || target <= 1) {
      el.textContent = pad(Math.max(0, target || 0));
      return;
    }
    const t0 = performance.now();
    (function frame(now) {
      const p = Math.min((now - t0) / DURATION, 1);
      let v;
      if (max == null) {
        const eased = 1 - Math.pow(1 - p, 3);
        v = Math.max(1, Math.round(target * eased));
      } else if (p < 0.55) {
        // Fase 1 (~55% durasi): 0 -> batas unit, ease-out supaya berhenti mulus
        const q = p / 0.55;
        v = Math.round(max * (1 - Math.pow(1 - q, 2)));
      } else {
        // Fase 2 (45% sisanya): batas -> target asli, ease-in; landas persis
        // di angka target, tidak boleh meleset (angka acara sungguhan).
        const q = (p - 0.55) / 0.45;
        v = Math.round(max - (max - target) * q * q);
      }
      if (p < 1) {
        el.textContent = String(v);
        requestAnimationFrame(frame);
      } else {
        el.textContent = pad(target);
      }
    })(t0);
  }

  function start() {
    const first = compute();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Tanpa animasi: langsung isi nilai + interval normal.
      tick();
      setInterval(tick, 1000);
      return;
    }
    animateFirst(document.getElementById("cd-days"), first.days, null);
    animateFirst(document.getElementById("cd-hours"), first.hours, 24);
    animateFirst(document.getElementById("cd-minutes"), first.minutes, 60);
    animateFirst(document.getElementById("cd-seconds"), first.seconds, 60);
    // Angka tanggal & tahun di baris "Selasa, 25 Agustus 2026" (#event-date-label,
    // dipecah main.js jadi span ed-date/ed-year) ikut berputar SATU KALI
    // bersamaan: tanggal overshoot ke 31, tahun ramp naik biasa. Nilai dibaca
    // dari isi span (bukan compute) — span yang kosong/None langsung di-skip
    // guard di animateFirst.
    const edDate = document.getElementById("ed-date");
    const edYear = document.getElementById("ed-year");
    animateFirst(edDate, parseInt(edDate ? edDate.textContent : "", 10), 31);
    animateFirst(edYear, parseInt(edYear ? edYear.textContent : "", 10), null);
    // Interval baru mulai setelah animasi selesai — tick polos tiap detik,
    // TANPA animasi lagi.
    setTimeout(() => {
      tick();
      setInterval(tick, 1000);
    }, DURATION);
  }

  // Tunggu sampai teks section countdown benar-benar masuk layar (class
  // text-revealed dipasang main.js). Kalau sudah/belum ada elemennya, mulai
  // langsung.
  const opening = document.getElementById("opening");
  if (opening && !opening.classList.contains("text-revealed")) {
    new MutationObserver((mutations, obs) => {
      if (!opening.classList.contains("text-revealed")) return;
      obs.disconnect();
      start();
    }).observe(opening, { attributes: true, attributeFilter: ["class"] });
  } else {
    start();
  }
};
