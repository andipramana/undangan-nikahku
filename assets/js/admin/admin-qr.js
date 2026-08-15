/**
 * Halaman Check-in (admin-qr.html): pemindai QR untuk petugas lokasi + tab
 * Live Streaming.
 *
 * - Scan: kamera belakang (getUserMedia) → jsQR tiap frame → RPC checkin_guest.
 *   RLS migration 0004 membatasi akun ini: hanya boleh menulis key
 *   `livestream` di site_content dan membaca checkins — bukan foto, ucapan,
 *   maupun teks undangan lain.
 * - Halaman ini memakai shared.js (login, tab, toast, saveLivestream) —
 *   perbaikan bug cukup di satu tempat.
 *
 * jsQR dimuat dari CDN; scanner jalan PENUH di browser tanpa server. */
(function () {
  const { sb, toast } = window.AdminAPI;


  // =========================================================================
  // TAB CHECK-IN: daftar
  // =========================================================================

  let checkins = [];

  async function loadCheckins() {
    const root = document.getElementById("checkins-root");
    root.innerHTML = "<p class='p-muted'>Memuat daftar check-in…</p>";

    const { data, error, count } = await window.AdminAPI.query(
      sb.from("checkins").select("*", { count: "exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).order("checked_in_at", { ascending: false }),
      "Permintaan check-in"
    );

    if (error) {
      root.innerHTML =
        `<p class="p-warning p-warning--danger">Gagal memuat check-in: ${esc(error.message)}</p>` +
        `<button type="button" class="p-btn p-btn--primary" id="checkins-retry">Coba lagi</button>`;
      document.getElementById("checkins-retry").addEventListener("click", loadCheckins);
      return;
    }

    checkins = data || [];
    paintCheckins(count);
  }

  function paintCheckins(count) {
    const root = document.getElementById("checkins-root");

    if (!checkins.length) {
      root.innerHTML =
        `<p class="p-muted">Belum ada tamu yang check-in.</p>` +
        `<p class="p-muted" style="font-size:.8rem">Arahkan kamera ke QR tamu (tombol QR di pojok kiri bawah undangan).</p>`;
      return;
    }

    const totalGuests = checkins.reduce((sum, c) => sum + (Number(c.guest_count) || 1), 0);
    root.innerHTML = `
      <p class="p-hint" style="margin-bottom:.75rem">
        <strong style="color:var(--p-ink)">${count ?? checkins.length}</strong> check-in ·
        total ${totalGuests} orang
      </p>
      <div>
        ${checkins
          .map(
            (c, i) => `
          <article class="p-list-row" style="margin-bottom:.5rem">
            <div class="p-list-row__fields">
              <strong>${esc(c.guest_name)}</strong>
              <span class="p-muted" style="font-size:.78rem"> · ${Number(c.guest_count) || 1} orang · ${fmtDate(c.checked_in_at)}</span>
              <p style="margin:.25rem 0 0;font-size:.82rem">${esc(c.guest_key)}</p>
            </div>
            <div class="p-list-row__controls">
              <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}" aria-label="Hapus check-in ${esc(c.guest_name)}">Hapus</button>
            </div>
          </article>`
          )
          .join("")}
      </div>`;

    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => removeCheckin(checkins[Number(btn.dataset.del)], btn));
    });
  }

  async function removeCheckin(item, btn) {
    if (!item) return;
    if (!confirm(`Hapus check-in "${item.guest_name}"? Tidak bisa dibatalkan.`)) return;
    btn.disabled = true;
    const { error, count } = await sb.from("checkins").delete({ count: "exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("guest_key", item.guest_key);
    if (error) {
      btn.disabled = false;
      toast("Gagal menghapus: " + error.message, true);
      return;
    }
    if (!count) {
      // RLS menolak diam-diam (nol baris, tanpa error) — beri tahu petugas.
      btn.disabled = false;
      toast("Tidak ada yang terhapus — RLS kemungkinan belum diaktifkan.", true);
      return;
    }
    toast("Check-in dihapus.");
    loadCheckins();
  }

  // =========================================================================
  // TAB CHECK-IN: pemindai QR
  // =========================================================================

  let stream = null;
  let scanning = false;
  let lastScanText = "";
  let lastScanAt = 0;
  const DEBOUNCE_MS = 3000;

  async function startScan() {
    const status = document.getElementById("scan-status");
    const video = document.getElementById("scan-video");
    if (stream) stopScan();

    if (!window.jsQR) {
      status.textContent = "jsQR tidak termuat (cek koneksi internet).";
      status.classList.add("scan-status--error");
      return;
    }

    // Kamera belakang dulu; kalau tidak ada (desktop/webcam), jatuh ke default.
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
    } catch (err) {
      status.textContent = "Kamera tidak bisa diakses: " + err.message;
      status.classList.add("scan-status--error");
      return;
    }

    video.srcObject = stream;
    await video.play();
    scanning = true;
    document.getElementById("btn-scan").hidden = true;
    document.getElementById("btn-scan-stop").hidden = false;
    status.classList.remove("scan-status--error");
    status.textContent = "Arahkan kamera ke QR tamu…";
    requestAnimationFrame(scanFrame);
  }

  function stopScan() {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    document.getElementById("scan-video").srcObject = null;
    document.getElementById("btn-scan").hidden = false;
    document.getElementById("btn-scan-stop").hidden = true;
    document.getElementById("scan-status").textContent = "Kamera dimatikan.";
  }

  /** Satu frame = satu upaya deteksi. Loop berhenti sendiri kalau tab pindah
   * (panel disembunyikan) atau tombol hentikan diklik — tidak ada timer yang
   * lupa dimatikan. */
  function scanFrame() {
    const video = document.getElementById("scan-video");
    const canvas = document.getElementById("scan-canvas");
    const status = document.getElementById("scan-status");
    if (!scanning || video.readyState < 2 || video.videoWidth === 0) {
      if (scanning && !document.getElementById("tab-checkin").hidden) {
        requestAnimationFrame(scanFrame); // video belum siap — coba lagi
      }
      return;
    }

    // Skala baca dibatasi supaya frame kecil (cepat) di HP — lebar 480 cukup
    // untuk QR check-in yang isinya cuma satu URL.
    const scale = Math.min(1, 480 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Signature jsQR: (data: Uint8ClampedArray, width, height, options) --
    // sebelumnya argumen ke-1/ke-2/ke-3 tertukar (width, height, imageData),
    // jsQR menerima tipe yang salah untuk ketiganya dan tidak pernah bisa
    // mendeteksi apa pun. Kode QR ini yang menjadi jantung seluruh fitur
    // check-in -- tanpa perbaikan ini, tombol "Mulai scan" secara teknis
    // menyalakan kamera tapi tidak pernah mendeteksi QR apa pun.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "dontInvert" });

    if (code && code.data) handleCode(code.data);

    // Terus lanjut baca frame — QR lama masih di depan kamera akan kena
    // debounce, dan QR tamu berikutnya langsung terdeteksi tanpa tombol lagi.
    if (scanning && !document.getElementById("tab-checkin").hidden) {
      requestAnimationFrame(scanFrame);
    }
  }

  /** QR yang sama yang terlihat terus-menerus tidak boleh di-scan berulang —
   * 3 detik pertama diabaikan untuk teks yang sama (QR masih di depan kamera). */
  function handleCode(text) {
    const status = document.getElementById("scan-status");
    const now = Date.now();
    if (text === lastScanText && now - lastScanAt < DEBOUNCE_MS) return;
    lastScanText = text;
    lastScanAt = now;

    const guestName = parseGuestName(text);
    if (!guestName) {
      status.textContent = "QR bukan undangan ini — lewati.";
      return;
    }
    status.textContent = `Memeriksa "${guestName}"…`;
    doCheckin(guestName);
  }

  /** Ambil nama tamu dari URL undangan (?to=…). URL yang bukan domain undangan
   * ini (atau tak punya ?to=) mengembalikan null — petugas tidak akan memindai
   * QR sembarangan. Pengecekan hostname sengaja dibandingkan ke location.hostname
   * saat ini (bukan domain produksi yang di-hardcode) supaya tetap benar saat
   * dites lokal (mis. localhost lewat `npm run serve`). */
  function parseGuestName(raw) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (url.hostname !== location.hostname) return null;
    // URL QR wajib berasal dari slug undangan yang sedang dikelola. Domain
    // sama saja tidak cukup: petugas Siti-Ujang tidak boleh check-in tamu
    // undangan lain di domain yang sama.
    const scannedSlug = url.pathname.split("/").filter(Boolean)[0] || "root";
    if (scannedSlug !== window.AdminAPI.tenant.slug) return null;
    const param = window.WEDDING_CONFIG.guestParam;
    const name = url.searchParams.get(param);
    return name ? decodeURIComponent(name.replace(/\+/g, " ")) : null;
  }

  /** RPC checkin_guest (migration 0004) — function SECURITY DEFINER yang
   * aman balapan: INSERT ON CONFLICT DO NOTHING, kembaliannya menandai
   * apakah baris ini baru dibuat atau sudah ada sebelumnya. */
  async function doCheckin(name) {
    const status = document.getElementById("scan-status");
    const { data, error } = await window.AdminAPI.query(
      sb.rpc("checkin_guest", { p_invitation_id: window.AdminAPI.tenant.invitationId, p_to: name }),
      "Check-in"
    );
    if (error) {
      status.textContent = "Gagal check-in: " + error.message;
      status.classList.add("scan-status--error");
      return;
    }
    status.classList.remove("scan-status--error");
    const d = data || {};
    const count = Number(d.guestCount) || 1;
    status.textContent = d.already
      ? `Sudah check-in sebelumnya — ${d.guestName} (${count} org)`
      : `Check-in ✓ — ${d.guestName} (${count} org)`;
    // Segarkan daftar di bawah HANYA saat baris baru benar-benar dibuat —
    // pemindaian ulang tamu yang sudah check-in tidak perlu memuat ulang
    // daftar berulang-ulang.
    if (!d.already) loadCheckins();
  }

  // =========================================================================
  // TAB LIVE STREAMING
  // =========================================================================

  async function loadLivestream() {
    const { data, error } = await window.AdminAPI.query(
      sb.from("site_content").select("content").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1).maybeSingle(),
      "Permintaan livestream"
    );
    if (error && error.code !== "PGRST116") {
      toast("Gagal memuat livestream: " + error.message, true);
      return;
    }
    const ls = (data && data.content && data.content.livestream) || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };
    set("f-live-youtube", ls.youtube);
    set("f-live-instagram", ls.instagram);
    set("f-live-tiktok", ls.tiktok);
  }

  async function saveLivestream() {
    const urls = {
      youtube: document.getElementById("f-live-youtube").value.trim(),
      instagram: document.getElementById("f-live-instagram").value.trim(),
      tiktok: document.getElementById("f-live-tiktok").value.trim()
    };
    const btn = document.getElementById("btn-save-livestream");
    btn.disabled = true;
    const { error } = await window.AdminShared.saveLivestream(urls);
    btn.disabled = false;
    if (error) toast("Gagal menyimpan: " + error.message, true);
    else toast("Livestream tersimpan ✓");
  }

  // =========================================================================
  // AUTH + TAB
  // =========================================================================

  document.getElementById("btn-scan").addEventListener("click", startScan);
  document.getElementById("btn-scan-stop").addEventListener("click", stopScan);
  document.getElementById("btn-checkins-refresh").addEventListener("click", loadCheckins);
  document.getElementById("btn-save-livestream").addEventListener("click", saveLivestream);

  window.AdminShared.initAdminAuth({
    onSignedIn: () => loadCheckins(),
    tabHandlers: {
      // scanFrame() sengaja berhenti menjadwalkan dirinya sendiri saat panel
      // ini tersembunyi (baris pengecekan tab.hidden di scanFrame) supaya
      // tidak membakar baterai/CPU di tab yang tidak terlihat. Tapi itu berarti
      // kalau petugas berpindah ke tab Live Streaming lalu balik lagi TANPA
      // sempat klik "Hentikan scan", stream kamera tetap menyala (lampu masih
      // hidup) namun loop deteksinya sudah berhenti selamanya -- scanner
      // tampak jalan padahal diam. Nyalakan lagi di sini kalau `scanning`
      // masih true saat kembali ke tab ini.
      checkin: () => {
        loadCheckins();
        if (scanning) requestAnimationFrame(scanFrame);
      },
      livestream: loadLivestream
    }
  });

  // =========================================================================
  // Helper
  // =========================================================================

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
