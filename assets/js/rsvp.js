/** Form RSVP -> insert ke Supabase table `wishes`, + render daftar ucapan. */
window.initRsvp = function () {
  const form = document.getElementById("rsvp-form");
  const statusEl = document.getElementById("rsvp-status");
  const listEl = document.getElementById("wishes-list");
  const nameInput = document.getElementById("rsvp-name");
  // Cache daftar terakhir agar ucapan yang baru berhasil diinsert bisa langsung
  // dirender tanpa menunggu query ulang ke server. Versi ini juga melindungi
  // kartu baru dari respons load awal yang datang terlambat.
  let currentWishes = [];
  let wishesVersion = 0;
  if (!form) return;

  const params = new URLSearchParams(location.search);
  const guestParam = window.WEDDING_CONFIG.guestParam;
  const rawGuest = params.get(guestParam);
  const guestFromUrl = rawGuest ? decodeURIComponent(rawGuest.replace(/\+/g, " ")) : "";
  if (guestFromUrl) nameInput.value = guestFromUrl;

  const statusLabel = { hadir: "Hadir", tidak_hadir: "Tidak Hadir", ragu: "Ragu-ragu" };
  // Token acak per browser, bukan IP/fingerprint. Nilai ini menjadi kunci blokir
  // tenant-scoped di server jika admin memilih "Hapus & blokir perangkat".
  function deviceToken() {
    const key = "wedding-wish-device-token";
    let value = localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
      localStorage.setItem(key, value);
    }
    return value;
  }

  // Pilihan kehadiran pakai tombol capsule (bukan dropdown). Belum ada yang
  // terpilih di awal — tamu harus klik dulu, jangan diasumsikan "Hadir".
  const attendanceBox = document.getElementById("rsvp-attendance");
  const guestsInput = document.getElementById("rsvp-guests");
  // Kolom "Jumlah Tamu" hanya masuk akal kalau tamunya datang, DAN kalau
  // kehadirannya sudah dipilih sama sekali — sebelum diklik, sembunyikan.
  const guestsField = guestsInput && guestsInput.closest("label");
  let attendanceValue = "";
  if (guestsField) guestsField.hidden = true;

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

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderWishes(items) {
    currentWishes = Array.isArray(items) ? items : [];
    if (!currentWishes.length) {
      listEl.innerHTML =
        '<p class="wishes-empty">Jadilah yang pertama memberi ucapan dan doa terbaik.</p>';
      return;
    }
    listEl.innerHTML = items
      .map(
        (w, i) => `
      <div class="wish-card" data-reveal="${i % 2 ? "slide-left" : "slide-right"}" data-reveal-early style="--reveal-i:${i % 4}">
        <span class="wish-card__name">${escapeHtml(w.name)}</span>
        <span class="wish-card__status wish-card__status--${w.attendance || ""}">${statusLabel[w.attendance] || ""}</span>
        <p class="wish-card__message">${escapeHtml(w.message)}</p>
      </div>`
      )
      .join("");
    // Kartu dipantau terpisah agar muncul berurutan hanya ketika benar-benar
    // masuk dari area bawah viewport (data-reveal-early), bukan bersamaan saat
    // tombol kirim/form RSVP selesai dianimasikan.
    if (window.revealScan) window.revealScan(listEl);
  }

  async function loadWishes() {
    if (!window.sb) return;
    // Snapshot sebelum request: jika tamu submit sementara request ini masih
    // berjalan, respons lama tidak boleh menghapus kartu yang sudah tampil.
    const requestVersion = wishesVersion;
    const { data, error } = await window.sb
      .from(window.WEDDING_CONFIG.supabase.wishesTable)
      .select("*")
      .eq("invitation_id", window.TenantContext && window.TenantContext.invitationId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error(error);
      return;
    }
    if (requestVersion !== wishesVersion) return;
    renderWishes(data || []);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("rsvp-submit");

    if (!attendanceValue) {
      statusEl.textContent = "Pilih dulu kehadiranmu ya.";
      return;
    }

    if (!window.sb) {
      statusEl.textContent = "Gagal terhubung ke server. Coba lagi nanti.";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = "Mengirim...";

    const payload = {
      invitation_id: window.TenantContext && window.TenantContext.invitationId,
      name: nameInput.value.trim(),
      attendance: attendanceValue,
      // Yang tidak hadir selalu terkirim 1, bukan angka sisa yang sempat
      // diketik sebelum berpindah pilihan — kalau tidak, rekap "total orang"
      // di panel admin ikut menghitung tamu yang justru menyatakan tidak datang.
      guest_count: attendanceValue === "hadir" ? Number(guestsInput.value) || 1 : 1,
      message: document.getElementById("rsvp-message").value.trim()
    };

    // Minta baris yang baru dibuat dikembalikan. Mengandalkan query ulang saja
    // membuat UI terasa tertinggal ketika replica/edge cache Supabase belum
    // melihat insert yang baru selesai — ucapan baru muncul setelah refresh.
    const token = deviceToken();
    const { data: createdWish, error } = token
      ? await window.sb.rpc("submit_wish", {
          p_invitation_id: payload.invitation_id, p_device_token: token,
          p_name: payload.name, p_attendance: payload.attendance,
          p_guest_count: payload.guest_count, p_message: payload.message
        })
      // LAN HTTP lama tanpa crypto.randomUUID tetap memakai jalur legacy sampai
      // browser mendapat secure context; deployment normal memakai RPC aman.
      : await window.sb.from(window.WEDDING_CONFIG.supabase.wishesTable).insert(payload).select().single();
    submitBtn.disabled = false;

    if (error) {
      console.error(error);
      // Pesan dari RPC sengaja santun untuk perangkat diblokir maupun filter kata.
      statusEl.textContent = /Doa baik akan kembali kepada orang yang mendoakan/i.test(error.message || "")
        ? "Doa baik akan kembali kepada orang yang mendoakan."
        : "Gagal mengirim. Silakan coba lagi.";
      return;
    }

    // Render hasil insert secara optimistis dari respons server. Jadi kartu
    // langsung tampil tanpa reload; setiap request lama menjadi basi dan tidak
    // boleh menimpa daftar ini ketika responsnya baru tiba.
    wishesVersion += 1;
    if (createdWish) renderWishes([createdWish, ...currentWishes]);
    statusEl.textContent = "Terima kasih atas doa dan ucapannya!";
    form.reset();
    if (guestFromUrl) nameInput.value = guestFromUrl;
    // Jangan langsung query ulang di sini: respons baca yang terlambat dapat
    // mengembalikan daftar lama dan menimpa kartu yang baru saja dirender.
    // Sinkronisasi normal tetap terjadi saat halaman dibuka kembali.
  });

  loadWishes();
};
