/** Form RSVP -> insert ke Supabase table `wishes`, + render daftar ucapan. */
window.initRsvp = function () {
  const form = document.getElementById("rsvp-form");
  const statusEl = document.getElementById("rsvp-status");
  const listEl = document.getElementById("wishes-list");
  const nameInput = document.getElementById("rsvp-name");
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const guestParam = window.WEDDING_CONFIG.guestParam;
  const rawGuest = params.get(guestParam);
  const guestFromUrl = rawGuest ? decodeURIComponent(rawGuest.replace(/\+/g, " ")) : "";
  if (guestFromUrl) nameInput.value = guestFromUrl;

  const statusLabel = { hadir: "Hadir", tidak_hadir: "Tidak Hadir", ragu: "Ragu-ragu" };

  // Pilihan kehadiran pakai tombol capsule (bukan dropdown): default "Hadir"
  const attendanceBox = document.getElementById("rsvp-attendance");
  const guestsInput = document.getElementById("rsvp-guests");
  // Kolom "Jumlah Tamu" hanya masuk akal kalau tamunya datang. Menanyakannya
  // pada yang memilih "Tidak Hadir" membuat formulir terasa tidak menyimak.
  const guestsField = guestsInput && guestsInput.closest("label");
  let attendanceValue = "hadir";

  function selectPill(btn) {
    attendanceBox.querySelectorAll(".rsvp-pill").forEach((b) => {
      b.classList.toggle("is-selected", b === btn);
    });
    attendanceValue = btn.dataset.value;
    if (guestsField) guestsField.hidden = attendanceValue !== "hadir";
  }
  attendanceBox.querySelectorAll(".rsvp-pill").forEach((btn) => {
    btn.addEventListener("click", () => selectPill(btn));
  });
  selectPill(attendanceBox.querySelector('[data-value="hadir"]'));

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderWishes(items) {
    if (!items.length) {
      listEl.innerHTML =
        '<p style="opacity:.6;font-size:.85rem;text-align:center;">Jadilah yang pertama memberi ucapan.</p>';
      return;
    }
    listEl.innerHTML = items
      .map(
        (w, i) => `
      <div class="wish-card" data-reveal="${i % 2 ? "slide-left" : "slide-right"}" style="--reveal-i:${i % 4}">
        <span class="wish-card__name">${escapeHtml(w.name)}</span>
        <span class="wish-card__status wish-card__status--${w.attendance || ""}">${statusLabel[w.attendance] || ""}</span>
        <p class="wish-card__message">${escapeHtml(w.message)}</p>
      </div>`
      )
      .join("");
    // Kartu ucapan baru dirender (juga setelah kirim RSVP) — daftarkan ke observer.
    if (window.revealScan) window.revealScan(listEl);
  }

  async function loadWishes() {
    if (!window.sb) return;
    const { data, error } = await window.sb
      .from(window.WEDDING_CONFIG.supabase.wishesTable)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error(error);
      return;
    }
    renderWishes(data || []);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("rsvp-submit");

    if (!window.sb) {
      statusEl.textContent = "Gagal terhubung ke server. Coba lagi nanti.";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Mengirim...";

    const payload = {
      name: nameInput.value.trim(),
      attendance: attendanceValue,
      // Yang tidak hadir selalu terkirim 1, bukan angka sisa yang sempat
      // diketik sebelum berpindah pilihan — kalau tidak, rekap "total orang"
      // di panel admin ikut menghitung tamu yang justru menyatakan tidak datang.
      guest_count: attendanceValue === "hadir" ? Number(guestsInput.value) || 1 : 1,
      message: document.getElementById("rsvp-message").value.trim()
    };

    const { error } = await window.sb.from(window.WEDDING_CONFIG.supabase.wishesTable).insert(payload);
    submitBtn.disabled = false;

    if (error) {
      console.error(error);
      statusEl.textContent = "Gagal mengirim. Silakan coba lagi.";
      return;
    }

    statusEl.textContent = "Terima kasih atas doa dan ucapannya!";
    form.reset();
    if (guestFromUrl) nameInput.value = guestFromUrl;
    loadWishes();
  });

  loadWishes();
};
