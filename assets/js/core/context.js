/** Lapisan data bersama untuk SEMUA template.
 *
 * Aturan keras (lihat docs/kontrak-template.md): file di core/ tidak boleh
 * membuat elemen visual apa pun. Yang ada di sini murni data & perhitungan —
 * template yang memutuskan bentuk tampilannya.
 *
 * Fungsi di bawah dipindahkan apa adanya dari main.js versi satu-template,
 * supaya perilakunya (pencocokan sapaan, token closing, merge fallback)
 * identik dan tidak perlu diuji ulang dari nol.
 */
(function () {
  "use strict";

  const esc = (v) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** Gabungkan konten remote (Supabase) DI ATAS config lokal: objek digabung
   * rekursif, array diganti. loveStory ditangani per-indeks supaya field
   * `photo` lokal tetap bertahan — satu-satunya foto yang masih hidup di
   * dalam config, dipakai kalau payload foto tidak tersedia. */
  function mergeContent(local, remote) {
    if (!remote) return local;
    const out = { ...local };
    for (const [key, value] of Object.entries(remote)) {
      if (key === "loveStory" && Array.isArray(value) && Array.isArray(local[key])) {
        out[key] = value.map((item, i) => (local[key][i] ? mergeContent(local[key][i], item) : item));
      } else if (
        value && typeof value === "object" && !Array.isArray(value) &&
        local[key] && typeof local[key] === "object" && !Array.isArray(local[key])
      ) {
        out[key] = mergeContent(local[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  /** Cocokkan nama tamu ke kelompok sapaan: case-insensitive, match PERSIS
   * (bukan substring). Dipakai untuk sapaan DAN closing — hitung sekali,
   * pakai hasilnya untuk keduanya. */
  function matchGreetingGroup(cfg, guestName) {
    const groups = Array.isArray(cfg.guestGreetings) ? cfg.guestGreetings : [];
    const needle = String(guestName || "").trim().toLowerCase();
    return groups.find(
      (g) => Array.isArray(g.names) && g.names.some((n) => String(n).trim().toLowerCase() === needle)
    ) || null;
  }

  /** Ganti token pada teks yang diisi admin. Sengaja split/join (string biasa),
   * BUKAN regex — nama/label bisa mengandung karakter yang berarti di regex. */
  function fillTemplate(text, cfg, guestName) {
    const values = {
      "${tamu}": guestName,
      "${CPP}": cfg.couple.groom.nickname,
      "${CPW}": cfg.couple.bride.nickname
    };
    return Object.keys(values).reduce((s, token) => s.split(token).join(values[token]), String(text ?? ""));
  }

  /** Nama tamu dari ?to=, sapaan, dan closing — sudah diselesaikan sekali di
   * sini supaya tiap template tidak mengulang aturannya sendiri-sendiri. */
  function buildGuest(cfg) {
    const params = new URLSearchParams(location.search);
    const raw = params.get(cfg.guestParam);
    const name = raw ? decodeURIComponent(raw.replace(/\+/g, " ")) : cfg.defaultGuestName;
    const group = matchGreetingGroup(cfg, name);
    return {
      name,
      isPersonal: !!raw,
      greeting: (group && group.label) || cfg.defaultGuestGreeting || "Kepada Yth.",
      closing: fillTemplate(
        (group && group.closing && group.closing.trim()) || (cfg.closing && cfg.closing.text) || "",
        cfg, name
      )
    };
  }

  /* ─── Format ─── */

  /** "25 Agustus 2026" → { day:"25", month:"Agustus", year:"2026" }. Template
   * yang mau memecah tanggal jadi angka besar terpisah memakai ini. */
  function dateParts(dateLabel) {
    const p = String(dateLabel || "").split(" ");
    return { day: p[0] || "", month: p[1] || "", year: p[2] || "" };
  }

  /** "10.00" atau "10:00" → { h:"10", m:"00" }. Config memakai titik, sebagian
   * data lama memakai titik dua — dinormalisasi di satu tempat. */
  function timeParts(value) {
    const t = String(value || "").replace(".", ":").split(":");
    return { h: t[0] || "", m: t[1] || "" };
  }

  function rupiah(n) {
    const num = Number(n);
    return Number.isFinite(num) ? new Intl.NumberFormat("id-ID").format(num) : "";
  }

  /** Tautan "tambahkan ke Google Calendar". Akad & resepsi digabung jadi SATU
   * agenda (acaranya satu hari, beda jam saja) dengan venue akad sebagai
   * wakilnya; data lama tanpa venue per-event jatuh ke event.venue tunggal. */
  function calendarUrl(cfg) {
    const start = new Date(cfg.event.countdownTarget);
    if (isNaN(start)) return "";
    const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
    const stamp = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const venue = (cfg.event.akad && cfg.event.akad.venue) || cfg.event.venue || {};
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `Pernikahan ${cfg.couple.bride.nickname} & ${cfg.couple.groom.nickname}`,
      dates: `${stamp(start)}/${stamp(end)}`,
      details: `${cfg.event.akad.label} & ${cfg.event.resepsi.label} di ${venue.name || ""}`,
      location: venue.address || ""
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  window.WeddingCore = {
    esc, mergeContent, matchGreetingGroup, fillTemplate, buildGuest,
    fmt: { dateParts, timeParts, rupiah, calendarUrl }
  };
})();
