/** Toggle panel amplop digital, salin nomor rekening & alamat, modal konfirmasi
 * pengiriman (WhatsApp), dan modal rekomendasi kado. */
window.initGift = function () {
  const cfg = window.WEDDING_CONFIG.gift;

  const toggleBtn = document.getElementById("btn-gift-toggle");
  const recsBtn = document.getElementById("btn-gift-recs");
  const hideBtn = document.getElementById("btn-gift-hide");
  const confirmBtn = document.getElementById("btn-gift-confirm");
  const panel = document.getElementById("gift-panel");
  const accountsEl = document.getElementById("gift-accounts");
  const addressEl = document.getElementById("gift-address");
  if (!toggleBtn || !panel) return;

  // ============ PANEL: rekening + alamat ============

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

  const addressText = [cfg.address.recipient, cfg.address.phone, cfg.address.detail]
    .filter(Boolean)
    .join("\n");
  addressEl.innerHTML = `
    <div class="gift-address__text">
      <strong>${cfg.address.recipient}</strong><br>
      ${cfg.address.phone}<br>
      ${cfg.address.detail}
    </div>
    <button class="gift-copy-btn gift-address__copy" type="button">Salin</button>`;
  addressEl.querySelector(".gift-address__copy").addEventListener("click", () => {
    navigator.clipboard
      .writeText(addressText)
      .then(() => window.showToast && window.showToast("Alamat kado disalin"))
      .catch(() => window.showToast && window.showToast("Gagal menyalin alamat"));
  });

  if (cfg.note) {
    const note = document.createElement("p");
    note.className = "gift-note";
    note.textContent = cfg.note;
    note.dataset.reveal = "up";
    note.style.setProperty("--reveal-i", "4");
    panel.appendChild(note);
  }

  // ============ TOGGLE PANEL ============

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

  // ============ MODAL KONFIRMASI PENGIRIMAN (WA) ============

  const confirmModal = document.getElementById("gift-confirm-modal");
  const methodSel = document.getElementById("gift-confirm-method");
  const messageArea = document.getElementById("gift-confirm-message");
  const sendBtn = document.getElementById("gift-confirm-send");
  if (confirmModal && methodSel && messageArea && sendBtn) {
    const params = new URLSearchParams(location.search);
    const guestName = params.get(window.WEDDING_CONFIG.guestParam)
      ? decodeURIComponent(params.get(window.WEDDING_CONFIG.guestParam).replace(/\+/g, " "))
      : window.WEDDING_CONFIG.defaultGuestName;

    /** Normalisasi nomor WA ke format internasional 62xx: buang spasi/tanda
     * baca, "0" di depan jadi "62", "8" di depan (tanpa 0) diberi "62". */
    function normalizeWa(raw) {
      const digits = String(raw ?? "").replace(/\D/g, "");
      if (!digits) return "";
      if (digits.startsWith("62")) return digits;
      if (digits.startsWith("0")) return "62" + digits.slice(1);
      if (digits.startsWith("8")) return "62" + digits;
      return "";
    }

    function buildOptions() {
      const opts = [];
      cfg.accounts.forEach((acc) => {
        if (!acc.owner) return; // tanpa owner tidak ikut dropdown
        const num = normalizeWa(cfg[acc.owner === "cpp" ? "contactCPP" : "contactCPW"]);
        if (!num) return;
        opts.push({
          type: "bank",
          label: `${acc.bank} — ${acc.holder}`,
          num
        });
      });
      // Opsi "kado / kirim barang" menuju nomor WA di alamat kado — SELALU
      // paling akhir supaya urutan dropdown stabil. Tanpa nomor yang valid,
      // opsi ini dilewati (sama seperti rekening tanpa kontak).
      const kadoNum = normalizeWa(cfg.address.phone);
      if (kadoNum) {
        opts.push({
          type: "kado",
          label: "Kado / Kirim Barang",
          num: kadoNum
        });
      }
      return opts;
    }

    /** Teks awal pesan WA — biarkan tamu mengedit (messageArea textarea).
     *  Isinya BERBEDA tergantung jenis opsi (type), bukan satu template
     *  generik: konfirmasi "alamat kirim ke mana" tidak masuk akal setelah
     *  transfer/kirim sudah dilakukan.
     *   - bank: konfirmasi SUDAH TRANSFER — nada santai + ucapan selamat;
     *   - kado: konfirmasi SUDAH KIRIM BARANG ke alamat — nada santai,
     *     doa selamat yang berbeda. */
    function buildMessage(type, label) {
      const couple = window.WEDDING_CONFIG.couple;
      const names = `${couple.bride.nickname} & ${couple.groom.nickname}`;
      if (type === "kado") {
        return `Halo, saya ${guestName}.\n\nAku mau konfirmasi kalau aku udah kirim kado buat pernikahan ${names} ke alamat kamu ya.\n\nHappy wedding, semoga sakinah mawaddah warahmah!`;
      }
      return `Halo, saya ${guestName}.\n\nAku udah transfer ya buat kado pernikahan ${names} lewat ${label}.\n\nHappy wedding, semoga langgeng selalu!`;
    }

    function openConfirmModal() {
      const opts = buildOptions();
      if (!opts.length) {
        // Tanpa satu pun nomor tujuan yang valid, tombol tidak punya arti —
        // plan: tombolnya dihilangkan dari panel, bukan dianggap gagal.
        confirmBtn.remove();
        return;
      }
      methodSel.innerHTML = opts
        .map((o) => `<option value="${o.num}" data-type="${o.type}">${o.label}</option>`)
        .join("");
      messageArea.value = buildMessage(opts[0].type, opts[0].label);
      confirmModal.hidden = false;
    }

    methodSel.addEventListener("change", () => {
      const opt = methodSel.selectedOptions[0];
      if (!opt) return;
      messageArea.value = buildMessage(opt.dataset.type || "bank", opt.textContent);
    });

    sendBtn.addEventListener("click", () => {
      const num = methodSel.value;
      const msg = messageArea.value.trim();
      if (!num || !msg) return;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      confirmModal.hidden = true;
    });

    confirmBtn.addEventListener("click", openConfirmModal);
    confirmModal.querySelector(".modal__close").addEventListener("click", () => {
      confirmModal.hidden = true;
    });
    confirmModal.addEventListener("click", (e) => {
      if (e.target === confirmModal) confirmModal.hidden = true;
    });
  }

  // ============ MODAL REKOMENDASI KADO ============

  const recsModal = document.getElementById("gift-recs-modal");
  const recsGrid = document.getElementById("gift-recs-grid");
  const recs = window.WEDDING_CONFIG.giftRecommendations || [];
  if (recsModal && recsGrid) {
    if (!recs.length) {
      // Tanpa rekomendasi, tombol tidak perlu tampil (foto di folder gift_item
      // tanpa entri rekomendasi juga tidak punya nama/harga/link).
      recsBtn.remove();
    } else {
      recsBtn.addEventListener("click", () => recsModal.hidden = false);
      recsModal.querySelector(".modal__close").addEventListener("click", () => {
        recsModal.hidden = true;
      });
      recsModal.addEventListener("click", (e) => {
        if (e.target === recsModal) recsModal.hidden = true;
      });

      // Foto kado di-fetch sekali, dipasangkan by-index dengan rekomendasi:
      // foto ke-i (folder gift_item, urutan sort_order) = rekomendasi ke-i.
      (async () => {
        const photos = (await window.getPhotos("gift_item")) || [];
        recsGrid.innerHTML = recs
          .map((r, i) => {
            const p = photos[i];
            const img = p
              ? `<img src="${window.photoUrl(p.path)}" alt="${r.name}" loading="lazy">`
              : `<div class="gift-rec-card__placeholder" aria-hidden="true">🎁</div>`;
            const buy = r.link
              ? `<a class="btn-outline" href="${r.link}" target="_blank" rel="noopener">Beli</a>`
              : `<span class="gift-rec-card__nobuy">Beli</span>`;
            return `
          <div class="gift-rec-card">
            <div class="gift-rec-card__img">${img}</div>
            <div class="gift-rec-card__body">
              <div class="gift-rec-card__name">${r.name}</div>
              ${r.price ? `<div class="gift-rec-card__price">${r.price}</div>` : ""}
              ${buy}
            </div>
          </div>`;
          })
          .join("");
      })();
    }
  }
};
