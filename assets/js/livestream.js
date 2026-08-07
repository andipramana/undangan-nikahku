/** Section Live Streaming — opsional per platform. URL kosong = platform itu
 * tidak tampil; ketiganya kosong = section DIHAPUS dari DOM sama sekali (bukan
 * disembunyikan) — tidak ada kotak kosong yang perlu ditangani CSS/JS.
 *
 * Dipanggil sebelum initReveal() (lihat main.js): tombol yang dirender di sini
 * ikut terdaftar ke observer reveal pada pemindaian awal. */
window.initLivestream = function () {
  const section = document.getElementById("livestream");
  if (!section) return;

  const ls = window.WEDDING_CONFIG && window.WEDDING_CONFIG.livestream;
  const platforms = [
    {
      key: "youtube", label: "YouTube",
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 12s0-3.4-.4-5c-.2-.9-.9-1.6-1.8-1.8C19.2 4.8 12 4.8 12 4.8s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 8.6 1 12 1 12s0 3.4.4 5c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-5 .4-5zM10 15.5v-7l6 3.5-6 3.5z"/></svg>'
    },
    {
      key: "instagram", label: "Instagram",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>'
    },
    {
      key: "tiktok", label: "TikTok",
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.6 3c.4 2.1 1.9 3.6 4 4v3c-1.6 0-3-.5-4-1.3V14a7 7 0 1 1-7-7h1v3.2a3.8 3.8 0 1 0 3.8 3.8V3h2.2z"/></svg>'
    }
  ];

  const active = platforms.filter((p) => ls && ls[p.key]);
  if (!active.length) {
    section.remove();
    return;
  }

  const box = section.querySelector(".livestream-actions");
  if (!box) return;
  box.innerHTML = active
    .map(
      (p, i) => `
    <a class="btn-outline" href="${esc(ls[p.key])}" target="_blank" rel="noopener"
       data-reveal="pop" style="--reveal-i:${i + 3}">
      ${p.icon} ${p.label}
    </a>`
    )
    .join("");

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
};
