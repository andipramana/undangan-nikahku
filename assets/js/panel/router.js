/**
 * Hash router dalam satu shell (admin.html): #/, #/mempelai, #/acara, dst.
 * Alasan hash routing (bukan path asli /<slug>/admin/mempelai/): situs statis
 * di GitHub Pages, path asli butuh perubahan 404.html + tenant.js untuk TIAP
 * halaman baru. Hash routing memberi hasil sama bagi pengguna (bookmark,
 * tombol Back, halaman terpisah) tanpa menyentuh routing tenant sama sekali.
 *
 * Struktur navigasi (kelompok + urutan) didefinisikan SEKALI di sini (NAV) —
 * halaman itu sendiri (window.PanelPages[key]) hanya menyumbang title/icon/
 * mount/destroy. home.js memakai renderNavGridHtml() supaya hub tidak
 * mendefinisikan ulang struktur yang sama.
 */
(function () {
  const NAV = [
    { group: "Isi Undangan", items: [
      "cover", "mempelai", "pembuka", "acara", "cerita", "galeri", "hadiah", "livestream", "penutup"
    ].map((key) => ({ key })) },
    { group: "Tamu", items: [
      { key: "sapaan" },
      { link: "wa", title: "Kirim WhatsApp", iconName: "whatsapp" },
      { key: "ucapan" },
      { link: "admin-qr", title: "Check-in QR", iconName: "qr" }
    ] },
    { group: "Tampilan", items: [
      { key: "template" }, { key: "warna" }, { key: "font" }, { key: "editor-visual" }
    ] },
    { group: "Pengaturan", items: [
      { key: "pengaturan" }
    ] }
  ];

  let currentKey = null;
  let currentPage = null;
  let dirty = false;
  let dirtySave = null;
  let lastPublishStatus = null;
  let publishListener = null;

  const $ = (id) => document.getElementById(id);
  const pageDef = (key) => window.PanelPages && window.PanelPages[key];

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
  function navItemKey(item) { return item.key || item.link; }
  function navItemHref(item) { return item.link ? window.AdminAPI.tenant.path(item.link) : hashHref(item.key); }
  function navItemTitle(item) {
    if (item.link) return item.title;
    const p = pageDef(item.key);
    return p ? p.title : item.key;
  }
  function navItemIcon(item) {
    if (item.link) return window.PanelUI.icon(item.iconName);
    const p = pageDef(item.key);
    return (p && p.icon) || window.PanelUI.icon("home");
  }

  function renderNavGridHtml() {
    return NAV.map((group) => {
      const cards = group.items.map((item) => `
        <a class="p-nav-card" href="${navItemHref(item)}" data-nav-key="${navItemKey(item)}">
          ${navItemIcon(item)}
          <span class="p-nav-card__title">${window.PanelUI.esc(navItemTitle(item))}</span>
        </a>`).join("");
      return `<div class="p-nav-group"><p class="p-nav-group__label">${window.PanelUI.esc(group.group)}</p><div class="p-nav-grid">${cards}</div></div>`;
    }).join("");
  }

  function renderSidebar() {
    const nav = $("p-sidebar-nav");
    if (!nav) return;
    const home = pageDef("home");
    let html = `<a class="p-sidebar__item" href="${hashHref("home")}" data-nav-key="home">${(home && home.icon) || window.PanelUI.icon("home")}<span>Beranda</span></a>`;
    NAV.forEach((group) => {
      html += `<div><p class="p-sidebar__group-label">${window.PanelUI.esc(group.group)}</p>`;
      group.items.forEach((item) => {
        html += `<a class="p-sidebar__item" href="${navItemHref(item)}" data-nav-key="${navItemKey(item)}">${navItemIcon(item)}<span>${window.PanelUI.esc(navItemTitle(item))}</span></a>`;
      });
      html += `</div>`;
    });
    nav.innerHTML = html;
  }

  function updateActiveNav(key) {
    document.querySelectorAll("[data-nav-key]").forEach((el) => {
      if (el.dataset.navKey === key) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
  }

  function renderHeader(def, key) {
    const header = $("p-pageheader");
    if (!header) return;
    const isHome = key === "home";
    header.classList.toggle("p-pageheader--home", isHome);
    header.innerHTML = `
      <button type="button" class="p-pageheader__back" id="p-back" aria-label="Kembali ke Beranda">${window.PanelUI.icon("back")}</button>
      <div class="p-pageheader__text">
        <p class="p-pageheader__kicker">${window.PanelUI.esc(isHome ? "Panel admin" : (def.group || ""))}</p>
        <h1 class="p-pageheader__title">${window.PanelUI.esc(def.title)}</h1>
      </div>
      <span class="p-badge" id="p-header-publish-badge" hidden></span>
    `;
    const back = $("p-back");
    if (back) back.addEventListener("click", () => navigate("home"));
    if (lastPublishStatus) applyPublishBadge();
  }

  function applyPublishBadge() {
    const badge = $("p-header-publish-badge");
    if (!badge || !lastPublishStatus) return;
    badge.hidden = false;
    badge.className = "p-badge " + (lastPublishStatus.dirty ? "p-badge--warn" : "p-badge--ok");
    badge.textContent = lastPublishStatus.dirty ? "Belum dipublikasikan" : "Sudah dipublikasikan";
  }

  // ---------------------------------------------------------------------
  // Status publikasi — satu sumber (invitations.content_updated_at vs
  // published_at, RPC & trigger sudah ada lewat migration 0020). Dipakai
  // Beranda (kartu penuh) dan header tiap halaman (badge kecil).
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
    renderHeader(def, key);
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
   * sidebar (statis) maupun grid kartu Beranda (dirender ulang tiap home.js
   * mount, lewat renderNavGridHtml()) tanpa perlu pasang ulang listener tiap
   * kali. Hanya kunci HALAMAN INTERNAL (punya entri window.PanelPages) yang
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
    renderSidebar();
    bindNavClickSafetyNet();
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
    setDirty,
    clearDirty,
    refreshPublishStatus,
    publishNow,
    openDraftPreview,
    getPublishStatus: () => lastPublishStatus,
    onPublishStatus: (fn) => { publishListener = fn; },
    renderNavGridHtml
  };
})();
