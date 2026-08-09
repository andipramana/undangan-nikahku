/**
 * Inti bersama KEDUA panel admin (admin.html & admin-qr.html): pembuatan client
 * Supabase, pembungkus query dengan batas waktu, toast, starter konten dari
 * config.js, sesi login/logout + perpindahan tab, dan penyimpanan livestream
 * (SELECT → mutate → UPSERT).
 *
 * Logika yang dipakai dua-duanya hidup di sini supaya perbaikan bug cukup
 * dilakukan sekali, tidak diingat di dua file terpisah. admin.js / admin-qr.js
 * tinggal memegang hal spesifik halaman masing-masing.
 *
 * Keamanan:
 *  - Password TIDAK pernah ada di kode. Form login hanya meneruskan kata
 *    sandi ke signInWithPassword — verifikasi dilakukan server Supabase.
 *  - Nama pengguna dipetakan ke email tetap per halaman (lihat admin.js /
 *    admin-qr.js); pemetaan ini bukan rahasia (email admin boleh terlihat),
 *    sedangkan kata sandi rahasia.
 */
(function () {
  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;
  const sb = window.supabase && cfg && cfg.url && cfg.anonKey
    ? window.supabase.createClient(cfg.url, cfg.anonKey)
    : null;

  if (!sb) {
    document.body.innerHTML = "<p style='padding:2rem;font-family:sans-serif'>Supabase tidak tersedia — cek blok `supabase` di assets/js/config.js.</p>";
    throw new Error("Supabase client tidak bisa diinisialisasi");
  }

  /** Bungkus query Supabase agar TIDAK bisa menggantung selamanya.
   *
   * Menunda pemanggilan keluar dari callback auth sudah sangat mengurangi
   * peluang macet, tapi tidak menghapusnya: kalau kunci auth tetap tertahan,
   * permintaan diam tanpa pernah menolak, dan layar berhenti di "Memuat…"
   * tanpa error, tanpa jalan keluar. Jaring ini mengubah kondisi itu jadi
   * kegagalan biasa yang bisa ditampilkan lengkap dengan tombol "Coba lagi".
   *
   * Bentuk kembaliannya sengaja disamakan dengan supabase-js ({ data, error })
   * supaya pemanggilnya tidak perlu menangani dua pola berbeda. */
  async function query(builder, label) {
    const TIMEOUT_MS = 12000;
    let timer;
    try {
      return await Promise.race([
        builder,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} tidak dijawab dalam 12 detik. Coba lagi.`)),
            TIMEOUT_MS
          );
        })
      ]);
    } catch (err) {
      return { data: null, error: err, count: null };
    } finally {
      clearTimeout(timer);
    }
  }

  function toast(message, isError) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("toast--error", !!isError);
    el.classList.add("show");
    clearTimeout(window.__adminToastTimer);
    window.__adminToastTimer = setTimeout(() => el.classList.remove("show"), 2500);
  }

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
        akad: {
          label: c.event.akad.label, start: c.event.akad.start, end: c.event.akad.end,
          venue: { name: c.event.akad.venue.name, address: c.event.akad.venue.address, mapsUrl: c.event.akad.venue.mapsUrl }
        },
        resepsi: {
          label: c.event.resepsi.label, start: c.event.resepsi.start, end: c.event.resepsi.end,
          venue: { name: c.event.resepsi.venue.name, address: c.event.resepsi.venue.address, mapsUrl: c.event.resepsi.venue.mapsUrl }
        }
      },
      dresscode: { text: c.dresscode.text, colors: [...c.dresscode.colors] },
      quotePhoto: { quote: c.quotePhoto.quote },
      loveStory: c.loveStory.map(({ photo, ...rest }) => ({ ...rest })),
      livestream: {
        youtube: (c.livestream && c.livestream.youtube) || "",
        instagram: (c.livestream && c.livestream.instagram) || "",
        tiktok: (c.livestream && c.livestream.tiktok) || ""
      },
      galleryVideo: {
        youtube: (c.galleryVideo && c.galleryVideo.youtube) || ""
      },
      gift: {
        accounts: c.gift.accounts.map((a) => ({ ...a })),
        contactCPP: (c.gift && c.gift.contactCPP) || "",
        contactCPW: (c.gift && c.gift.contactCPW) || "",
        address: { recipient: c.gift.address.recipient, phone: c.gift.address.phone, detail: c.gift.address.detail },
        note: c.gift.note || ""
      },
      giftRecommendations: Array.isArray(c.giftRecommendations)
        ? c.giftRecommendations.map((r) => ({ ...r }))
        : [],
      heroSlideInterval: c.heroSlideInterval,
      // `path` adalah objek Storage privat per-undangan (slug/audio/uuid.ext).
      // `src` dipertahankan untuk backsound lokal/URL lama sebagai fallback.
      audio: { src: c.audio.src, path: (c.audio && c.audio.path) || "", title: c.audio.title },
      closing: { text: c.closing.text }
    };
  }

  const tenant = window.TenantContext || { slug: "root", invitationId: null, setInvitation() {} };

  async function requireTenantAccess() {
    const { data, error } = await query(
      sb.rpc("get_my_invitation_access", { p_slug: tenant.slug }),
      "Verifikasi akses undangan"
    );
    const access = Array.isArray(data) ? data[0] : null;
    if (error || !access || !access.invitation_id) {
      await sb.auth.signOut();
      throw new Error("Akun ini tidak berhak mengakses undangan ini.");
    }
    tenant.setInvitation({ id: access.invitation_id, slug: access.slug });
    return access;
  }

  window.AdminAPI = {
    sb,
    query,
    tenant,
    requireTenantAccess,
    // URL publik foto di bucket 'photos' (path selalu slug/folder/file).
    photoUrl: (path) => sb.storage.from("photos").getPublicUrl(path).data.publicUrl,
    toast,
    contentFromConfig: buildContentFromConfig
  };
  window.AdminToast = toast;

  /** Simpan key `livestream` saja di site_content — jalur aman untuk admin_qr:
   * RLS hanya mengizinkannya mengubah key ini, jadi UPSERT objek utuh yang
   * field-nya basi akan DITOLAK (nilai content - 'livestream' tidak sama).
   * SELECT → ubah livestream di JS → UPSERT seluruh objek dalam satu alur
   * pendek; risiko tabrakan dengan edit admin lain di detik yang sama bisa
   * diterima untuk alat internal ini. Dipakai admin-qr (wajib) dan boleh juga
   * admin biasa untuk field livestream-nya. */
  async function saveLivestream(urls) {
    const invitationId = tenant.invitationId;
    if (!invitationId) return { data: null, error: new Error("Konteks undangan belum siap.") };
    const { data, error } = await query(
      sb.from("site_content").select("content").eq("invitation_id", invitationId).eq("id", 1).maybeSingle(),
      "Permintaan teks"
    );
    // PGRST116 = baris belum ada — lanjut dengan starter dari config.js supaya
    // yang di-upsert objek utuh, bukan hanya { livestream } (yang akan
    // menimpa isi lain dengan kosong kalau admin yang menyimpannya).
    if (error && error.code !== "PGRST116") return { data: null, error };
    const content = data && data.content
      ? JSON.parse(JSON.stringify(data.content))
      : buildContentFromConfig(window.WEDDING_CONFIG);
    content.livestream = { ...(content.livestream || {}), ...urls };
    return query(
      sb.from("site_content").upsert({ invitation_id: invitationId, id: 1, content, updated_at: new Date().toISOString() }, { onConflict: "invitation_id,id" }),
      "Penyimpanan livestream"
    );
  }

  /** Inisialisasi sesi login/logout + perpindahan tab, diparameterisasi per
   * halaman:
   *   opts.email        — email tetap yang dituju (per halaman)
   *   opts.username     — nama pengguna yang diketik di form
   *   opts.onSignedIn   — dipanggil setelah app tampil (mis. muat tab aktif)
   *   opts.tabHandlers  — { dataTab: () => void } dipanggil saat tab di-klik
   *
   * HTML yang diasumsikan (sama di kedua halaman): #login-screen/#login-form/
   * #login-username/#login-password/#login-submit/#login-error, #app,
   * #btn-logout, tombol .tab dengan data-tab, panel #tab-<dataTab>.
   *
   * Sesi lama sudah ada → langsung tampil; SIGNED_IN saat login baru → tampil.
   * INITIAL_SESSION tidak ditangani di sini karena getSession() di bawah sudah
   * menampilkan app untuk sesi yang sudah tersimpan.
   *
   * setTimeout(..., 0) BUKAN hiasan. Selama callback ini berjalan, supabase-js
   * memegang kunci internal auth; memanggil query Supabase lain dari dalamnya
   * membuat query itu menunggu kunci yang tidak akan pernah dilepas — permintaan
   * menggantung selamanya tanpa error. Itulah sebab tab Teks kadang berhenti di
   * "Memuat teks…" dan tidak pernah memunculkan apa pun. Menunda satu putaran
   * event loop membuat callback selesai lebih dulu, kuncinya lepas, baru
   * pemanggilan berikutnya menembak query-nya.
   *
   * Jalur getSession() dipakai saat halaman dimuat ulang dengan sesi tersimpan
   * (SIGNED_IN tidak menyala; yang menyala INITIAL_SESSION). Penundaannya sama
   * pentingnya dengan di atas: saat memuat ulang, supabase-js kerap sedang
   * menyegarkan token dan masih memegang kunci auth ketika .then() ini
   * dijalankan. */
  function initAdminAuth(opts) {
    async function showApp() {
      try {
        await requireTenantAccess();
        document.getElementById("login-screen").hidden = true;
        document.getElementById("app").hidden = false;
        if (opts.onSignedIn) opts.onSignedIn();
      } catch (err) {
        document.getElementById("login-error").textContent = err.message || "Akses ditolak.";
        showLogin();
      }
    }

    function showLogin() {
      document.getElementById("app").hidden = true;
      document.getElementById("login-screen").hidden = false;
      const pw = document.getElementById("login-password");
      if (pw) pw.value = "";
      const un = document.getElementById("login-username");
      if (un) un.focus();
    }

    sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(showApp, 0);
      if (event === "SIGNED_OUT") setTimeout(() => {
        showLogin();
        if (opts.onSignedOut) opts.onSignedOut();
      }, 0);
    });

    sb.auth.getSession().then(({ data }) => {
      if (data.session) setTimeout(showApp, 0);
    });

    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("login-error");
      errorEl.textContent = "";
      const username = document.getElementById("login-username").value.trim();
      const password = document.getElementById("login-password").value;
      // Tenant accounts dibuat dinamis oleh admin root, jadi identitas login
      // tidak boleh lagi di-hardcode per halaman. Gunakan email akun Supabase.
      const email = opts.email || username;
      if (!email.includes("@")) {
        errorEl.textContent = "Masukkan email akun admin yang terdaftar.";
        return;
      }
      const btn = document.getElementById("login-submit");
      btn.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      btn.disabled = false;
      if (error) {
        errorEl.textContent =
          error.message === "Invalid login credentials" ? "Nama pengguna atau kata sandi salah." : error.message;
      }
    });

    document.getElementById("btn-logout").addEventListener("click", () => {
      sb.auth.signOut();
    });

    // Tab: sembunyikan semua panel, tampilkan #tab-<dataTab>, panggil handler.
    // Daftar handler ditentukan per halaman — admin-qr punya 2 tab, admin 3.
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("tab--active", b === btn));
        document.querySelectorAll(".panel").forEach((p) => { p.hidden = true; });
        const panel = document.getElementById("tab-" + btn.dataset.tab);
        if (panel) panel.hidden = false;
        // Tombol simpan mengambang khusus tab Font tidak boleh tertinggal saat
        // admin pindah ke tab lain.
        const fontsSave = document.getElementById("btn-save-fonts");
        if (fontsSave) fontsSave.hidden = btn.dataset.tab !== "fonts";
        const visualSave = document.getElementById("btn-save-visual-editor");
        if (visualSave) visualSave.hidden = btn.dataset.tab !== "editor-visual";
        const handler = opts.tabHandlers && opts.tabHandlers[btn.dataset.tab];
        if (handler) handler();
      });
    });
  }

  window.AdminShared = { initAdminAuth, saveLivestream };
})();
