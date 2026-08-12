/** Menu hamburger — shortcut lompat ke section undangan, supaya tamu tidak
 * perlu scroll panjang. Muncul hanya SETELAH undangan dibuka: saat #invitation
 * masih is-locked semua section display:none, jadi menu tidak punya target
 * yang masuk akal (lihat whenInvitationOpen di photos.js).
 *
 * Daftar dikurasi, bukan semua section: cover/opening/quote/closing dll.
 * dekoratif, tidak berguna untuk dilompati. Live Streaming ikut HANYA kalau
 * sectionnya masih ada di DOM — livestream.js MENGHAPUS elemennya kalau
 * semua URL kosong, jadi keberadaannya dicek dulu sebelum ditampilkan.
 *
 * Dipanggil SETELAH initLivestream() (lihat main.js) supaya cek keberadaan
 * #livestream melihat kondisi DOM yang sudah final. */
window.initNavMenu = function () {
  const btn = document.getElementById("btn-nav-menu");
  const modal = document.getElementById("nav-menu-modal");
  const list = document.getElementById("nav-menu-list");
  if (!btn || !modal || !list) return;

  // [id section, label] — urut sesuai posisi section di halaman.
  const items = [
    ["couple-bride", "Mempelai"],
    ["event", "Acara"],
    ["love-story", "Perjalanan Kami"],
    ["gallery", "Galeri"],
    ["gift", "Tanda Kasih"],
    ["rsvp", "Konfirmasi Kehadiran"]
  ];
  if (document.getElementById("livestream")) {
    items.splice(2, 0, ["livestream", "Live Streaming"]);
  }

  list.innerHTML = items
    .map(([id, label]) => `<button type="button" data-scroll="#${id}">${label}</button>`)
    .join("");

  // Tombol menu ikut sembunyi selama undangan masih terkunci (lihat komentar
  // atas) — dimunculkan begitu tombol Buka Undangan diklik.
  window.whenInvitationOpen(() => {
    btn.hidden = false;
  });

  btn.addEventListener("click", () => {
    modal.hidden = false;
  });

  const close = () => {
    modal.hidden = true;
  };
  modal.querySelector(".modal__close").addEventListener("click", close);
  // Klik di luar panel (overlay) menutup — pola sama seperti modal lain.
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  // Klik item → tutup menu dulu, lalu pilih mode scroll sesuai target. Rail
  // full-screen tetap mandatory; target konten reguler harus bebas dari snap
  // supaya browser tidak menariknya kembali ke Event.
  list.addEventListener("click", (e) => {
    const item = e.target.closest("[data-scroll]");
    if (!item) return;
    const target = document.querySelector(item.dataset.scroll);
    close();
    if (!target) return;
    if (window.setInvitationSnapMode) window.setInvitationSnapMode(target);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};
