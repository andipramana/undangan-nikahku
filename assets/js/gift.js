/** Toggle panel amplop digital + copy-to-clipboard nomor rekening. */
window.initGift = function () {
  const toggleBtn = document.getElementById("btn-gift-toggle");
  const hideBtn = document.getElementById("btn-gift-hide");
  const panel = document.getElementById("gift-panel");
  const accountsEl = document.getElementById("gift-accounts");
  const addressEl = document.getElementById("gift-address");
  if (!toggleBtn || !panel) return;

  const cfg = window.WEDDING_CONFIG.gift;

  // Nomor rekening placeholder disembunyikan (tidak ditampilkan ke tamu) sampai
  // nomor asli diisi di config.js dan flag placeholder dihapus.
  accountsEl.innerHTML = cfg.accounts
    .map(
      (acc, i) => `
    <div class="gift-account" data-reveal="up" style="--reveal-i:${i % 4}">
      <div>
        <div class="gift-account__bank">${acc.bank}</div>
        ${acc.placeholder ? "" : `<div class="gift-account__number">${acc.number}</div>`}
        <div class="gift-account__holder">a.n. ${acc.holder}</div>
      </div>
      ${acc.placeholder ? "" : `<button class="gift-copy-btn" type="button" data-number="${acc.number}">Salin</button>`}
    </div>`
    )
    .join("");

  addressEl.innerHTML = `
    <strong>${cfg.address.recipient}</strong><br>
    ${cfg.address.phone}<br>
    ${cfg.address.detail}`;

  if (cfg.note) {
    const note = document.createElement("p");
    note.className = "gift-note";
    note.textContent = cfg.note;
    note.dataset.reveal = "up";
    note.style.setProperty("--reveal-i", "4");
    panel.appendChild(note);
  }

  toggleBtn.addEventListener("click", () => {
    panel.hidden = false;
    toggleBtn.hidden = true;
    // Isi panel baru "ada" di layar sekarang — daftarkan ke observer reveal.
    if (window.revealScan) window.revealScan(panel);
  });

  hideBtn.addEventListener("click", () => {
    panel.hidden = true;
    toggleBtn.hidden = false;
  });

  accountsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".gift-copy-btn");
    if (!btn) return;
    navigator.clipboard
      .writeText(btn.dataset.number)
      .then(() => window.showToast && window.showToast("Nomor rekening disalin"));
  });
};
