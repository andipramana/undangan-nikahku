/** Tombol QR check-in melayang (floating) — HANYA muncul untuk tamu undangan
 * perorangan, yaitu saat URL mengandung ?to=NamaTamu (dikirim lewat WA). Tanpa
 * itu tombol tidak pernah tampil dan modul tidak melakukan apa-apa.
 *
 * QR meng-encode location.href apa adanya (link yang sedang dibuka tamu, sudah
 * memuat ?to=...) — petugas admin-qr tinggal memindai. QR digambar saat tombol
 * diklik, bukan saat halaman dibuka, supaya tidak ada kerja sia-sia.
 *
 * Library: qrcode-generator (UMD plain script, global `qrcode`, CDN jsdelivr,
 * komputasi lokal tanpa API pihak ketiga). Paket npm `qrcode` TIDAK dipakai —
 * ia tidak punya build browser (CommonJS mentah di lib/), sementara jalur
 * +esm-nya butuh type=module yang bertentangan dengan semua script lain di
 * halaman ini yang non-module. */
window.initQrCheckin = function () {
  const cfg = window.WEDDING_CONFIG;
  const btn = document.getElementById("btn-qr-checkin");
  const modal = document.getElementById("qr-checkin-modal");
  const canvas = document.getElementById("qr-checkin-canvas");
  if (!btn || !modal || !canvas) return;

  const params = new URLSearchParams(location.search);
  if (!params.get(cfg.guestParam)) return;

  // Baru muncul setelah amplop dibuka, sama seperti tombol musik — sebelum
  // itu belum ada gunanya ditampilkan (guest belum masuk ke undangannya).
  window.whenInvitationOpen(() => { btn.hidden = false; });
  btn.addEventListener("click", () => {
    if (!window.qrcode) {
      window.showToast && window.showToast("Gagal memuat QR (cek koneksi)");
      return;
    }
    // Render ulang tiap dibuka — jaga-jaga URL berubah (mis. tamu menyalin
    // ulang link dengan ?to= berbeda saat modal masih terbuka).
    try {
      const qr = window.qrcode(0, "M"); // 0 = versi otomatis, cukup untuk URL
      qr.addData(location.href);
      qr.make();
      const img = new Image();
      img.onload = () => {
        // qrcode-generator menghasilkan PNG (data URL) — gambarkan ke kanvas.
        // Kanvas di-CSS jadi lebar penuh wadah, resolusi internal 240px cukup
        // tajam untuk dipindai.
        const px = 240;
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, px, px);
        ctx.drawImage(img, 0, 0, px, px);
        modal.hidden = false;
      };
      img.onerror = () => window.showToast && window.showToast("Gagal membuat QR check-in");
      img.src = qr.createDataURL(6, 2); // sel 6px + margin 2 modul (quiet zone)
    } catch (err) {
      window.showToast && window.showToast("Gagal membuat QR check-in");
    }
  });

  modal.querySelector(".modal__close").addEventListener("click", () => {
    modal.hidden = true;
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
};
