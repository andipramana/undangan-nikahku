/** Tombol QR check-in melayang (floating) — HANYA muncul untuk tamu undangan
 * perorangan, yaitu saat URL mengandung ?to=NamaTamu (dikirim lewat WA). Tanpa
 * itu tombol tidak pernah tampil dan modul tidak melakukan apa-apa.
 *
 * QR meng-encode location.href apa adanya (link yang sedang dibuka tamu, sudah
 * memuat ?to=...) — petugas admin-qr tinggal memindai. Kanvas digambar qrcode
 * (CDN jsdelivr, komputasi lokal, tanpa API pihak ketiga) saat tombol diklik,
 * bukan saat halaman dibuka, supaya tidak ada kerja sia-sia. */
window.initQrCheckin = function () {
  const cfg = window.WEDDING_CONFIG;
  const btn = document.getElementById("btn-qr-checkin");
  const modal = document.getElementById("qr-checkin-modal");
  const canvas = document.getElementById("qr-checkin-canvas");
  if (!btn || !modal || !canvas) return;

  const params = new URLSearchParams(location.search);
  if (!params.get(cfg.guestParam)) return;

  btn.hidden = false;
  btn.addEventListener("click", () => {
    if (!window.QRCode) {
      window.showToast && window.showToast("Gagal memuat QR (cek koneksi)");
      return;
    }
    // Render ulang tiap dibuka — jaga-jaga URL berubah (mis. tamu menyalin
    // ulang link dengan ?to= berbeda saat modal masih terbuka).
    QRCode.toCanvas(
      canvas,
      location.href,
      { width: 220, margin: 2, color: { dark: "#3a2b1a", light: "#ffffff" } },
      (err) => {
        if (err) {
          window.showToast("Gagal membuat QR check-in");
          return;
        }
        modal.hidden = false;
      }
    );
  });

  modal.querySelector(".modal__close").addEventListener("click", () => {
    modal.hidden = true;
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.hidden = true;
  });
};
