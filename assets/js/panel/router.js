/**
 * Hash router dalam satu shell (admin.html): #/, #/mempelai, #/acara, dst.
 * Alasan hash routing (bukan path asli /<slug>/admin/mempelai/): situs statis
 * di GitHub Pages, path asli butuh perubahan 404.html + tenant.js untuk TIAP
 * halaman baru. Hash routing memberi hasil sama bagi pengguna (bookmark,
 * tombol Back, halaman terpisah) tanpa menyentuh routing tenant sama sekali.
 *
 * Navigasi v3 — "Strip Bab" + sidebar pendamping. DUA jalur ke tujuan yang
 * SAMA, keduanya aktif:
 *   1. STRIP horizontal di bawah topbar (utama, semua viewport): chip flat
 *      TANPA label grup — BAB (01–09, dinomori mengikuti urutan section yang
 *      benar-benar dibaca tamu di halaman undangan: sampul → penutup) lalu
 *      ALAT flat setelah satu pemisah tipis.
 *   2. SIDEBAR parent-child (jalur tambahan): permanen ≥1024px, di HP jadi
 *      drawer dari tombol hamburger topbar. Parent-nya TIGA kelompok besar
 *      (Bab undangan / Tamu / Tampilan & setelan) yang memecah "alat" strip
 *      secara logis, bukan kembali ke pengelompokan lama yang dibuang.
 * Halaman awal bukan "hub kartu" melainkan Ringkasan: checklist peluncuran
 * (lihat pages/home.js). Struktur kedua jalur didefinisikan SEKALI di sini;
 * halaman (window.PanelPages[key]) hanya menyumbang title/icon/mount/destroy.
 */
(function () {
  // Urutan bab = urutan section di index.html (cover → opening → couple →
  // event → livestream → love-story → gallery → gift → closing). Nomor bab
  // pada strip & kicker stage dihitung dari posisi array ini.
  const CHAPTERS = [
    "cover", "pembuka", "mempelai", "acara", "livestream", "cerita", "galeri", "hadiah", "penutup"
  ];
  // Alat — dua sub-kelompok: strip merendahkannya jadi SATU runtunan flat
  // (TOOLS = gabungan keduanya), sidebar memunculkan parent-nya masing-masing.
  // Link wa/admin-qr tetap dibawa router sendiri (menuju wa.html/
  // admin-qr.html, bukan PanelPages).
  const TOOL_GUEST = [
    { key: "sapaan" },
    { key: "kontak" },
    { link: "wa", title: "Kirim WhatsApp", iconName: "whatsapp" },
    { key: "ucapan" },
    { link: "admin-qr", title: "Check-in QR", iconName: "qr" }
  ];
  const TOOL_LOOK = [
    { key: "template" }, { key: "warna" }, { key: "font" }, { key: "editor-visual" },
    { key: "pengaturan" }, { key: "admin-akun" }
  ];
  const TOOLS = [...TOOL_GUEST, ...TOOL_LOOK];
  // Parent-child untuk sidebar: kelompok besar → tujuan di bawahnya.
  const SIDEBAR_GROUPS = [
    { label: "Bab undangan", items: CHAPTERS.map((key) => ({ key })) },
    { label: "Tamu", items: TOOL_GUEST },
    { label: "Tampilan & setelan", items: TOOL_LOOK }
  ];

  let currentKey = null;
  let currentPage = null;
  let dirty = false;
  let dirtySave = null;
  let lastPublishStatus = null;
  let publishListener = null;

  const $ = (id) => document.getElementById(id);
  const pageDef = (key) => window.PanelPages && window.PanelPages[key];
  const chapterNo = (key) => {
    const i = CHAPTERS.indexOf(key);
    return i < 0 ? null : String(i + 1).padStart(2, "0");
  };

  /** BUG KRITIS (dilaporkan dari HP): admin.html punya <base href="/">
   * (perlu untuk semua script/asset relatif). Href fragment-saja seperti
   * "#/mempelai" diresolusi HTML terhadap base URL itu, BUKAN terhadap URL
   * dokumen saat ini — jadi link itu sebenarnya menunjuk ke
   * http://host/#/mempelai, yaitu ROOT (undangan tamu), bukan admin.html.
   * Menambahkan location.pathname di depan membuat href-nya path-qualified
   * dan kebal terhadap base tag apa pun isinya. `location.hash = ...`
   * (dipakai navigate() di bawah) TIDAK kena bug ini — setter itu mengubah
   * fragment URL dokumen saat ini secara langsung, tidak lewat resolusi
   * referensi relatif seperti atribut href. */
  function hashHref(key) {
    return location.pathname + (key === "home" ? "#/" : `#/${key}`);
  }
  function navItemHref(item) {
    return item.link ? window.AdminAPI.tenant.path(item.link) : hashHref(item.key);
  }
  function navItemTitle(item) {
    if (item.link) return item.title;
    const p = pageDef(item.key);
    return p ? p.title : item.key;
  }

  function renderStrip() {
    const strip = $("p-chapters");
    if (!strip) return;
    const esc = window.PanelUI.esc;
    let html = `<a class="p-chapter p-chapter--home" href="${hashHref("home")}" data-nav-key="home">Ringkasan</a>`;
    CHAPTERS.forEach((key) => {
      html += `<a class="p-chapter" href="${hashHref(key)}" data-nav-key="${key}">` +
        `<span class="p-chapter__num">${chapterNo(key)}</span>` +
        `<span>${esc(navItemTitle({ key }))}</span></a>`;
    });
    html += `<span class="p-chapters__rule" role="presentation"></span>`;
    TOOLS.forEach((item) => {
      const icon = item.link
        ? window.PanelUI.icon(item.iconName)
        : ((pageDef(item.key) || {}).icon || "");
      html += `<a class="p-chapter p-chapter--tool" href="${navItemHref(item)}" data-nav-key="${item.key || item.link}" title="${esc(navItemTitle(item))}">` +
        `${icon}<span>${esc(navItemTitle(item))}</span></a>`;
    });
    strip.innerHTML = html;
  }

  /** SIDEBAR parent-child — jalur navigasi KEDUA di samping strip. Parent =
   * kelompok besar (label mono, bisa diciutkan), child = tujuan halaman.
   * ≥1024px: kolom permanen sticky di bawah framehead. Di bawah itu: drawer
   * dari kiri (openSidebar/closeSidebar di bawah), dibuka tombol hamburger
   * #p-menu-btn di topbar; strip bab tetap tampil di semua viewport. */
  const CHEVRON_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

  function sideItemHtml(item) {
    const icon = item.link
      ? window.PanelUI.icon(item.iconName)
      : ((pageDef(item.key) || {}).icon || "");
    const num = chapterNo(item.key);
    return `<a class="p-sideitem" href="${navItemHref(item)}" data-nav-key="${item.key || item.link}" title="${window.PanelUI.esc(navItemTitle(item))}">` +
      (num ? `<span class="p-sideitem__num">${num}</span>` : `${icon}`) +
      `<span>${window.PanelUI.esc(navItemTitle(item))}</span></a>`;
  }

  function renderSidebar() {
    const nav = $("p-sidebar-nav");
    if (!nav) return;
    nav.innerHTML = SIDEBAR_GROUPS.map((group) => `
      <section class="p-sidegroup">
        <button type="button" class="p-sidegroup__head" aria-expanded="true">
          ${CHEVRON_SVG}<span>${window.PanelUI.esc(group.label)}</span>
        </button>
        <div class="p-sidegroup__items">${group.items.map(sideItemHtml).join("")}</div>
      </section>`).join("");
  }

  function openSidebar() {
    const sb = $("p-sidebar");
    const scrim = $("p-scrim");
    const btn = $("p-menu-btn");
    if (sb) sb.classList.add("p-sidebar--open");
    if (scrim) scrim.classList.add("p-scrim--show");
    if (btn) btn.setAttribute("aria-expanded", "true");
    // Kunci gulir halaman di belakang drawer — permintaan eksplisit: saat
    // sidebar dibuka, layar utama tidak boleh bisa discroll.
    document.documentElement.classList.add("p-scroll-lock");
  }
  function closeSidebar() {
    const sb = $("p-sidebar");
    const scrim = $("p-scrim");
    const btn = $("p-menu-btn");
    if (sb) sb.classList.remove("p-sidebar--open");
    if (scrim) scrim.classList.remove("p-scrim--show");
    if (btn) btn.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("p-scroll-lock");
  }
  function toggleSidebar() {
    const sb = $("p-sidebar");
    if (sb && sb.classList.contains("p-sidebar--open")) closeSidebar();
    else openSidebar();
  }

  /** Satu listener untuk semua interaksi sidebar: toggle parent (ciut/
   * buka child-nya), tombol hamburger, klik scrim, dan Escape. */
  function bindSidebar() {
    const nav = $("p-sidebar-nav");
    if (nav) {
      nav.addEventListener("click", (e) => {
        const head = e.target.closest(".p-sidegroup__head");
        if (!head) return;
        const items = head.nextElementSibling;
        if (!items) return;
        const willOpen = head.getAttribute("aria-expanded") !== "true";
        head.setAttribute("aria-expanded", String(willOpen));
        items.hidden = !willOpen;
      });
    }
    const menuBtn = $("p-menu-btn");
    if (menuBtn) menuBtn.addEventListener("click", () => toggleSidebar());
    const scrim = $("p-scrim");
    if (scrim) scrim.addEventListener("click", () => closeSidebar());
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const menu = $("p-topmenu"); // menu ⋯ tertutup lebih dulu daripada drawer
      if (menu && menu.open) { menu.open = false; return; }
      closeSidebar();
    });
  }

  /** Menu ⋯ topbar: elemen <details> native TIDAK menutup sendiri saat klik
   * terjadi di luarnya — tutup manual kalau titik klik di luar elemennya.
   * Klik di DALAM menu (summary maupun isinya) tidak dijamak; navigasi lewat
   * mount() juga sudah menutupnya. */
  function bindTopMenuOutsideClose() {
    const menu = $("p-topmenu");
    if (!menu) return;
    document.addEventListener("click", (e) => {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }

  /** Sidebar desktop sticky di BAWAH framehead — butuh tinggi framehead
   * aktual (topbar + strip bisa berubah antar viewport). Tulis ke CSS var
   * --p-framehead-h tiap kali ukurannya berubah. */
  function watchFrameheadHeight() {
    const head = document.querySelector(".p-framehead");
    if (!head || !window.ResizeObserver) return;
    const apply = () => document.documentElement.style.setProperty("--p-framehead-h", head.offsetHeight + "px");
    apply();
    new ResizeObserver(apply).observe(head);
  }

  function updateActiveNav(key) {
    document.querySelectorAll("[data-nav-key]").forEach((el) => {
      if (el.dataset.navKey === key) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    // Jaga chip aktif selalu terlihat — strip bisa lebih lebar dari layar.
    const active = document.querySelector('#p-chapters [aria-current="page"]');
    if (active && active.scrollIntoView) {
      try { active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }); }
      catch { active.scrollIntoView(); }
    }
  }

  /** Stage head — kicker mono (tenant · bab/alat) + judul besar, DI DALAM
   * aliran konten (tidak sticky, tidak ada tombol back: strip bab di atas
   * adalah navigasinya). */
  function renderStage(def, key) {
    const stage = $("p-stage");
    if (!stage) return;
    const slug = window.AdminAPI.tenant.slug;
    const no = chapterNo(key);
    const kicker = key === "home"
      ? `/${slug}/ · ringkasan`
      : no ? `/${slug}/ · bab ${no}` : `/${slug}/ · alat`;
    stage.innerHTML = `
      <p class="p-stage__kicker">${window.PanelUI.esc(kicker)}</p>
      <h1 class="p-stage__title">${window.PanelUI.esc(def.title)}</h1>`;
  }

  function applyPublishBadge() {
    const pill = $("p-pubpill");
    if (!pill || !lastPublishStatus) return;
    pill.hidden = false;
    pill.classList.toggle("p-pubpill--live", !lastPublishStatus.dirty);
    pill.textContent = lastPublishStatus.dirty ? "Draft" : "Live";
    pill.title = lastPublishStatus.dirty
      ? "Ada perubahan belum dipublikasikan — klik untuk membuka Ringkasan"
      : "Semua perubahan sudah dipublikasikan";
  }

  // ---------------------------------------------------------------------
  // Status publikasi — satu sumber (invitations.content_updated_at vs
  // published_at, RPC & trigger sudah ada lewat migration 0020). Dipakai
  // pill topbar dan halaman Ringkasan (lewat onPublishStatus).
  // ---------------------------------------------------------------------
  function fmtTime(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return ""; }
  }

  async function refreshPublishStatus() {
    const api = window.AdminAPI;
    if (!api.tenant.invitationId) return null;
    const { data, error } = await api.query(
      api.sb.from("invitations").select("content_updated_at, published_at").eq("id", api.tenant.invitationId).single(),
      "Status publikasi"
    );
    if (error || !data) return lastPublishStatus;
    const isDirty = !data.published_at || new Date(data.content_updated_at) > new Date(data.published_at);
    lastPublishStatus = { dirty: isDirty, publishedAt: data.published_at, publishedAtLabel: fmtTime(data.published_at) };
    applyPublishBadge();
    if (publishListener) publishListener(lastPublishStatus);
    return lastPublishStatus;
  }

  async function publishNow() {
    const api = window.AdminAPI;
    const { error } = await api.query(
      api.sb.rpc("publish_invitation", { p_invitation_id: api.tenant.invitationId }),
      "Publikasi"
    );
    if (error) { api.toast("Gagal publikasi: " + error.message, true); return false; }
    api.toast("Berhasil dipublikasikan.");
    await refreshPublishStatus();
    return true;
  }

  /** Buka pratinjau DRAFT (perubahan belum dipublikasikan) di tab baru —
   * tulis draft terkini ke cache localStorage yang dibaca fetchInvitation()
   * sisi tamu, baru buka dengan ?preview=1 supaya tidak memanggil RPC publik. */
  async function openDraftPreview() {
    const api = window.AdminAPI;
    try {
      const { data, error } = await api.sb.rpc("get_invitation_draft", { p_slug: api.tenant.slug });
      if (error) throw error;
      localStorage.setItem(`wedding_invitation_v2_${api.tenant.slug}`, JSON.stringify(data));
    } catch (err) {
      console.warn("Gagal menyiapkan pratinjau draft, tampilkan versi terpublikasi:", err);
    }
    const base = api.tenant.path();
    const url = base + (base.includes("?") ? "&" : "?") + "preview=1";
    window.open(url, "_blank", "noopener");
  }

  // ---------------------------------------------------------------------
  // Ganti Password (menu ⋯ → "Ganti Password") — modal statis di
  // admin.html (#p-passwd-modal), dibuka lewat helper PanelUI.openModal
  // (focus trap + Escape urusannya). Submit memanggil
  // sb.auth.updateUser({ password }): user sedang login, jadi Supabase
  // tidak minta password lama.
  // ---------------------------------------------------------------------
  function bindPasswordModal() {
    const modal = $("p-passwd-modal");
    const menuBtn = $("p-menu-password");
    if (!modal || !menuBtn) return;
    const form = $("p-passwd-form");
    const errEl = $("p-passwd-error");
    const newInput = $("p-passwd-new");
    const confirmInput = $("p-passwd-confirm");
    const showErr = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

    menuBtn.addEventListener("click", () => {
      const menu = $("p-topmenu");
      if (menu) menu.open = false; // jangan biarkan dropdown menutupi modal
      form.reset();
      errEl.hidden = true;
      window.PanelUI.openModal(modal);
    });
    $("p-passwd-close").addEventListener("click", () => window.PanelUI.closeModal(modal));
    $("p-passwd-cancel").addEventListener("click", () => window.PanelUI.closeModal(modal));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      const pw = newInput.value;
      if (pw.length < 8) { showErr("Password minimal 8 karakter."); newInput.focus(); return; }
      if (pw !== confirmInput.value) { showErr("Konfirmasi tidak sama dengan password baru."); confirmInput.focus(); return; }
      const saveBtn = $("p-passwd-save");
      saveBtn.disabled = true;
      try {
        const { error } = await window.AdminAPI.sb.auth.updateUser({ password: pw });
        if (error) {
          showErr(error.message || "Gagal mengganti password.");
          window.AdminAPI.toast("Gagal mengganti password: " + (error.message || error), true);
          return;
        }
        window.AdminAPI.toast("Password berhasil diganti.");
        window.PanelUI.closeModal(modal);
      } catch (err) {
        showErr((err && err.message) || "Gagal mengganti password.");
        window.AdminAPI.toast("Gagal mengganti password.", true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------
  // Dirty tracking + save bar
  // ---------------------------------------------------------------------
  function setDirty(isDirty, onSave) {
    dirty = isDirty;
    dirtySave = onSave || null;
    const bar = $("p-savebar");
    if (bar) bar.hidden = !isDirty;
  }
  function clearDirty() { setDirty(false, null); }

  async function handleSaveBarClick() {
    if (!dirtySave) return;
    const btn = $("p-savebar-btn");
    btn.disabled = true;
    try {
      const ok = await dirtySave();
      if (ok !== false) clearDirty();
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------
  // Mount / navigasi
  // ---------------------------------------------------------------------
  function resolveKey() {
    const hash = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
    return hash || "home";
  }

  function navigate(key) {
    location.hash = key === "home" ? "#/" : `#/${key}`;
  }

  async function mount(key) {
    if (key === currentKey) return;
    if (dirty) {
      const ok = confirm("Ada perubahan belum disimpan. Tinggalkan halaman ini?");
      if (!ok) {
        // Kembalikan hash ke halaman saat ini tanpa memicu mount ulang
        // (hashchange akan datang lagi, tapi key === currentKey diam).
        location.hash = currentKey === "home" ? "#/" : `#/${currentKey}`;
        return;
      }
    }
    const def = pageDef(key);
    if (!def) { navigate("home"); return; }
    if (currentPage && typeof currentPage.destroy === "function") {
      try { currentPage.destroy(); } catch (err) { console.error(err); }
    }
    clearDirty();
    currentKey = key;
    currentPage = def;
    const menu = $("p-topmenu"); // tutup dropdown ⋯ kalau kebuka saat pindah
    if (menu) menu.open = false;
    closeSidebar(); // di HP: tutup drawer setelah memilih tujuan
    renderStage(def, key);
    updateActiveNav(key);
    const outlet = $("p-outlet-inner");
    outlet.innerHTML = "";
    window.scrollTo(0, 0);
    try {
      await def.mount(outlet);
    } catch (err) {
      console.error(err);
      outlet.innerHTML = `<div class="p-warning p-warning--danger">Gagal memuat halaman: ${window.PanelUI.esc(err.message || err)}</div>`;
    }
    refreshPublishStatus();
  }

  /** Sabuk pengaman untuk bug <base href="/"> di atas: kalau href tetap saja
   * salah lagi suatu saat (mis. lupa dipakai di halaman baru, atau
   * location.pathname belum sempat dibersihkan tenant.js saat boot lewat
   * redirect 404.html), klik pada [data-nav-key] TETAP dicegat di sini dan
   * dinavigasikan lewat navigate() (location.hash=, bukan href) — jalur yang
   * terbukti kebal terhadap base tag. Dipasang di document supaya menjangkau
   * strip bab (dirender ulang tiap start()) maupun elemen nav apa pun yang
   * dirender halaman (mis. baris Ringkasan) tanpa pasang ulang listener.
   * Hanya kunci HALAMAN INTERNAL (punya entri window.PanelPages) yang
   * dicegat — link eksternal (Kirim WhatsApp/Check-in QR ke wa.html/
   * admin-qr.html, data-nav-key="wa"/"admin-qr") sengaja dibiarkan navigasi
   * normal karena memang menuju halaman lain, bukan bug.
   */
  function bindNavClickSafetyNet() {
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-nav-key]");
      if (!el) return;
      const key = el.dataset.navKey;
      if (!pageDef(key)) return; // link eksternal (wa/admin-qr) — biarkan default
      e.preventDefault();
      navigate(key);
    });
  }

  function start() {
    renderStrip();
    renderSidebar();
    bindNavClickSafetyNet();
    bindSidebar();
    bindTopMenuOutsideClose();
    watchFrameheadHeight();
    const previewBtn = $("p-menu-preview");
    if (previewBtn) previewBtn.addEventListener("click", () => openDraftPreview());
    bindPasswordModal();
    const btn = $("p-savebar-btn");
    if (btn) btn.addEventListener("click", handleSaveBarClick);
    window.addEventListener("hashchange", () => mount(resolveKey()));
    window.addEventListener("beforeunload", (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
    mount(resolveKey());
  }

  window.PanelRouter = {
    start,
    navigate,
    /** Dipinjam halaman (mis. baris Ringkasan) supaya href path-qualified —
     * lihat komentar bug base-tag di atas; jangan pernah menulis atribut
     * href yang isinya cuma fragment URL tanpa path. */
    hashHref,
    setDirty,
    clearDirty,
    refreshPublishStatus,
    publishNow,
    openDraftPreview,
    getPublishStatus: () => lastPublishStatus,
    onPublishStatus: (fn) => { publishListener = fn; }
  };
})();
