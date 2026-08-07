/**
 * Inti panel admin: inisialisasi Supabase, sesi login/logout, perpindahan tab,
 * dan helper bersama (photoUrl, toast). Tidak berisi logika form — itu di
 * content.js / photos.js / editor.js.
 *
 * Keamanan:
 *  - Password TIDAK pernah ada di kode. Form login hanya meneruskan kata
 *    sandi ke signInWithPassword — verifikasi dilakukan server Supabase.
 *  - Nama pengguna "Mita&Andi" dipetakan ke email tetap; pemetaan ini bukan
 *    rahasia (email admin boleh terlihat), sedangkan kata sandi rahasia.
 */
(function () {
  const ADMIN_EMAIL = "admin@mitaandi.wedding";
  const ADMIN_USERNAME = "Mita&Andi";

  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;
  const sb = window.supabase && cfg && cfg.url && cfg.anonKey
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;

  if (!sb) {
    document.body.innerHTML = "<p style='padding:2rem;font-family:sans-serif'>Supabase tidak tersedia — cek blok `supabase` di assets/js/config.js.</p>";
    throw new Error("Supabase client tidak bisa diinisialisasi");
  }

  window.AdminAPI = {
    sb,
    // URL publik foto di bucket 'photos' (path relatif, mis. 'bride/01.webp')
    photoUrl: (path) => sb.storage.from("photos").getPublicUrl(path).data.publicUrl,
    toast,
    // Isi form Teks dari config.js kalau DB belum punya baris site_content —
    // admin tetap bisa dipakai sebelum seed dijalankan.
    contentFromConfig: buildContentFromConfig
  };

  function toast(message, isError) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("toast--error", !!isError);
    el.classList.add("show");
    clearTimeout(window.__adminToastTimer);
    window.__adminToastTimer = setTimeout(() => el.classList.remove("show"), 2500);
  }
  window.AdminToast = toast;

  /** Susun objek content (struktur site_content) dari config.js lokal —
   * dipakai sebagai starter kalau DB masih kosong. Bidang foto/manifest
   * dibuang (foto kini hidup di tabel photos). */
  function buildContentFromConfig(c) {
    return {
      siteTitle: c.siteTitle,
      guestParam: c.guestParam,
      defaultGuestName: c.defaultGuestName,
      couple: {
        bride: {
          name: c.couple.bride.name,
          nickname: c.couple.bride.nickname,
          father: c.couple.bride.father,
          mother: c.couple.bride.mother,
          instagram: c.couple.bride.instagram || ""
        },
        groom: {
          name: c.couple.groom.name,
          nickname: c.couple.groom.nickname,
          father: c.couple.groom.father,
          mother: c.couple.groom.mother,
          instagram: c.couple.groom.instagram || ""
        }
      },
      opening: { arabicQuote: c.opening.arabicQuote, quote: c.opening.quote, source: c.opening.source },
      event: {
        dateISO: c.event.dateISO,
        dateLabel: c.event.dateLabel,
        dayLabel: c.event.dayLabel,
        countdownTarget: c.event.countdownTarget,
        akad: { label: c.event.akad.label, start: c.event.akad.start, end: c.event.akad.end },
        resepsi: { label: c.event.resepsi.label, start: c.event.resepsi.start, end: c.event.resepsi.end },
        venue: { name: c.event.venue.name, address: c.event.venue.address, mapsUrl: c.event.venue.mapsUrl }
      },
      dresscode: { text: c.dresscode.text, colors: [...c.dresscode.colors] },
      quotePhoto: { quote: c.quotePhoto.quote },
      loveStory: c.loveStory.map(({ photo, ...rest }) => ({ ...rest })),
      gift: {
        accounts: c.gift.accounts.map((a) => ({ ...a })),
        address: { recipient: c.gift.address.recipient, phone: c.gift.address.phone, detail: c.gift.address.detail },
        note: c.gift.note || ""
      },
      heroSlideInterval: c.heroSlideInterval,
      audio: { src: c.audio.src, title: c.audio.title },
      closing: { text: c.closing.text }
    };
  }

  // -------------------------------------------------------------------------
  // Sesi
  // -------------------------------------------------------------------------
  function showApp() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    if (window.ContentPanel && window.ContentPanel.load) window.ContentPanel.load();
  }

  function showLogin() {
    document.getElementById("app").hidden = true;
    document.getElementById("login-screen").hidden = false;
    document.getElementById("login-password").value = "";
    document.getElementById("login-username").focus();
  }

  // Sesi lama sudah ada → langsung tampil; SIGNED_IN saat login baru → tampil.
  // INITIAL_SESSION tidak ditangani di sini karena getSession() di bawah sudah
  // menampilkan app untuk sesi yang sudah tersimpan.
  sb.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") showApp();
    if (event === "SIGNED_OUT") showLogin();
  });

  sb.auth.getSession().then(({ data }) => {
    if (data.session) showApp();
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (username !== ADMIN_USERNAME) {
      errorEl.textContent = "Nama pengguna salah.";
      return;
    }
    const btn = document.getElementById("login-submit");
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    btn.disabled = false;
    if (error) {
      errorEl.textContent =
        error.message === "Invalid login credentials" ? "Nama pengguna atau kata sandi salah." : error.message;
    }
  });

  document.getElementById("btn-logout").addEventListener("click", () => {
    sb.auth.signOut();
  });

  // -------------------------------------------------------------------------
  // Tab Teks / Foto
  // -------------------------------------------------------------------------
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("tab--active", b === btn));
      document.getElementById("tab-content").hidden = btn.dataset.tab !== "content";
      document.getElementById("tab-photos").hidden = btn.dataset.tab !== "photos";
      if (btn.dataset.tab === "photos" && window.PhotosPanel) window.PhotosPanel.load();
    });
  });
})();
