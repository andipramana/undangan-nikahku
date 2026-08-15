/**
 * Inti bersama KETIGA panel: admin.html (v2), admin-qr.html, wa.html.
 * Pindahan dari assets/js/admin/shared.js (kini shim tipis ke sini) —
 * perilaku TIDAK berubah supaya admin-qr.html dan wa.html tetap jalan tanpa
 * disentuh: pembuatan client Supabase, pembungkus query dengan batas waktu,
 * toast, starter konten dari config.js, dan sesi login/logout + perpindahan
 * tab (dipakai admin-qr.html; admin.html v2 tidak lagi punya elemen .tab,
 * jadi loop itu di sana cukup tidak menemukan apa pun).
 *
 * Keamanan:
 *  - Password TIDAK pernah ada di kode. Form login hanya meneruskan kata
 *    sandi ke signInWithPassword — verifikasi dilakukan server Supabase.
 *  - Nama pengguna dipetakan ke email tetap per halaman; pemetaan ini bukan
 *    rahasia (email admin boleh terlihat), sedangkan kata sandi rahasia.
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

  /** Bungkus query Supabase agar TIDAK bisa menggantung selamanya — lihat
   * catatan panjang di riwayat shared.js lama; perilaku dipertahankan persis. */
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
    el.classList.toggle("p-toast--error", !!isError);
    el.classList.toggle("toast--error", !!isError); // kompatibel wa.css lama
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

  async function requireTenantAccess(allowedRoles) {
    const { data, error } = await query(
      sb.rpc("get_my_invitation_access", { p_slug: tenant.slug }),
      "Verifikasi akses undangan"
    );
    const access = Array.isArray(data) ? data[0] : null;
    if (error || !access || !access.invitation_id || (allowedRoles && !allowedRoles.includes(access.role))) {
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
   * RLS hanya mengizinkannya mengubah key ini. Dipakai admin-qr (wajib);
   * admin.html v2 TIDAK memakai ini untuk halaman Live Streaming-nya sendiri
   * (peran admin biasa boleh menulis seluruh content, lewat store.js). */
  async function saveLivestream(urls) {
    const invitationId = tenant.invitationId;
    if (!invitationId) return { data: null, error: new Error("Konteks undangan belum siap.") };
    const { data, error } = await query(
      sb.from("site_content").select("content").eq("invitation_id", invitationId).eq("id", 1).maybeSingle(),
      "Permintaan teks"
    );
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
   * halaman — lihat riwayat shared.js lama untuk catatan panjang soal
   * setTimeout(...,0) (WAJIB: melepas kunci internal auth supabase-js
   * sebelum query berikutnya, kalau tidak permintaan menggantung selamanya). */
  function initAdminAuth(opts) {
    async function showApp() {
      try {
        await requireTenantAccess(opts.allowedRoles);
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

    // Tab lama (admin-qr.html masih memakainya): sembunyikan semua panel,
    // tampilkan #tab-<dataTab>, panggil handler. admin.html v2 tidak
    // punya elemen .tab sama sekali — loop ini otomatis tidak melakukan apa-apa.
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("tab--active", b === btn));
        document.querySelectorAll(".panel").forEach((p) => { p.hidden = true; });
        const panel = document.getElementById("tab-" + btn.dataset.tab);
        if (panel) panel.hidden = false;
        const handler = opts.tabHandlers && opts.tabHandlers[btn.dataset.tab];
        if (handler) handler();
      });
    });
  }

  window.AdminShared = { initAdminAuth, saveLivestream };
})();
