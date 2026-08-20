/** Form RSVP -> insert ke Supabase table `wishes`, + render daftar ucapan. */
window.initRsvp = function () {
  const form = document.getElementById("rsvp-form");
  const statusEl = document.getElementById("rsvp-status");
  const listEl = document.getElementById("wishes-list");
  const paginationEl = document.getElementById("wishes-pagination");
  const nameInput = document.getElementById("rsvp-name");
  // Cache daftar terakhir agar ucapan yang baru berhasil diinsert bisa langsung
  // dirender tanpa menunggu query ulang ke server. Versi ini juga melindungi
  // kartu baru dari respons load awal yang datang terlambat.
  let currentWishes = [];
  let wishesVersion = 0;
  // Semua ucapan bisa diakses (dulu dibatasi .limit(50), sisanya tidak
  // pernah kelihatan tamu) — sekarang dipaginasi server-side, 20 per
  // halaman, supaya jumlah data yang diunduh sekali jalan tetap kecil
  // walau ucapannya sudah ratusan.
  const WISHES_PAGE_SIZE = 20;
  let wishesPage = 1;
  let wishesTotal = 0;
  if (!form) return;

  // Nama SENGAJA tidak diisi otomatis dari parameter link (beda dengan sapaan
  // di main.js) — satu link undangan sering diteruskan ke satu grup WhatsApp
  // berisi banyak orang, jadi kolom ini harus selalu kosong supaya tiap orang
  // mengetik namanya sendiri, bukan ketiban nama penerima link aslinya.
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
  let attendanceValue = "";

  function selectPill(btn) {
    attendanceBox.querySelectorAll(".rsvp-pill").forEach((b) => {
      b.classList.toggle("is-selected", b === btn);
    });
    attendanceValue = btn.dataset.value;
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

  function renderPagination() {
    if (!paginationEl) return;
    const pageCount = Math.max(1, Math.ceil(wishesTotal / WISHES_PAGE_SIZE));
    if (pageCount <= 1) { paginationEl.innerHTML = ""; return; }
    paginationEl.innerHTML = `
      <button type="button" class="wishes-page-btn" id="wishes-prev" ${wishesPage <= 1 ? "disabled" : ""} aria-label="Halaman ucapan sebelumnya">&larr; Sebelumnya</button>
      <span class="wishes-page-info">Halaman ${wishesPage} dari ${pageCount}</span>
      <button type="button" class="wishes-page-btn" id="wishes-next" ${wishesPage >= pageCount ? "disabled" : ""} aria-label="Halaman ucapan berikutnya">Berikutnya &rarr;</button>
    `;
    paginationEl.querySelector("#wishes-prev").addEventListener("click", () => goToWishesPage(wishesPage - 1));
    paginationEl.querySelector("#wishes-next").addEventListener("click", () => goToWishesPage(wishesPage + 1));
  }

  function goToWishesPage(page) {
    wishesVersion += 1; // batalkan request halaman lama yang mungkin masih menggantung
    loadWishes(page);
    listEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadWishes(page = wishesPage) {
    if (!window.sb) return;
    // Snapshot sebelum request: jika tamu submit/ganti halaman sementara
    // request ini masih berjalan, respons lama tidak boleh menimpa yang baru.
    const requestVersion = wishesVersion;
    const from = (page - 1) * WISHES_PAGE_SIZE;
    const { data, error, count } = await window.sb
      .from(window.WEDDING_CONFIG.supabase.wishesTable)
      .select("*", { count: "exact" })
      .eq("invitation_id", window.TenantContext && window.TenantContext.invitationId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + WISHES_PAGE_SIZE - 1);
    if (error) {
      console.error(error);
      return;
    }
    if (requestVersion !== wishesVersion) return;
    wishesPage = page;
    wishesTotal = count || 0;
    renderWishes(data || []);
    renderPagination();
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
      // Input "Jumlah Tamu" sengaja dihapus dari form — kesannya membatasi
      // tamu untuk datang beramai-ramai. guest_count tetap ada di skema (dibaca
      // rekap "orang hadir" di panel admin), selalu terkirim 1 per konfirmasi.
      guest_count: 1,
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
    wishesTotal += 1;
    // Ucapan baru selalu belum disematkan — taruh SETELAH yang sudah
    // disematkan (bukan selalu di paling atas), supaya urutan tetap konsisten
    // dengan query server (pinned desc, created_at desc). Cuma disisipkan
    // kalau tamu sedang di halaman 1 — kalau sedang baca halaman lain,
    // jangan yank dia balik/ubah daftar yang lagi dilihatnya; batas halaman
    // itu tetap diperbarui via renderPagination() di bawah.
    if (createdWish && wishesPage === 1) {
      const pinned = currentWishes.filter((w) => w.pinned);
      const rest = currentWishes.filter((w) => !w.pinned);
      renderWishes([...pinned, createdWish, ...rest].slice(0, WISHES_PAGE_SIZE));
    }
    renderPagination();
    statusEl.textContent = "Terima kasih atas doa dan ucapannya!";
    form.reset();
    // Jangan langsung query ulang di sini: respons baca yang terlambat dapat
    // mengembalikan daftar lama dan menimpa kartu yang baru saja dirender.
    // Sinkronisasi normal tetap terjadi saat halaman dibuka kembali.
  });

  loadWishes();
};
