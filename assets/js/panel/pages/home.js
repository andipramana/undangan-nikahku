/**
 * Ringkasan — halaman awal panel. BUKAN hub kartu: satu baris status
 * publikasi, lalu CHECKLIST PELUNCURAN berupa baris list — tiap bab
 * undangan (urutan sama dengan strip navigasi) dinilai "siap/belum" dari
 * isi content + jumlah foto foldernya, klik baris = lompat ke bab itu.
 * Ditutup angka ringkas tamu (ucapan/check-in/kontak) sebagai baris list.
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["home"] = {
  title: "Ringkasan",
  group: null,
  icon: window.PanelUI ? window.PanelUI.icon("home") : "",
  async mount(outlet) {
    const esc = window.PanelUI.esc;
    outlet.innerHTML = `
      <div class="p-pubrow" id="home-status">
        <div class="p-pubrow__text"><strong>Memeriksa status publikasi…</strong></div>
      </div>
      <!-- Shortcut aksi paling sering: blast undangan ke tamu. Link keluar ke
           wa.html (path tenant, path-qualified) — SENGAJA tanpa data-nav-key:
           safetyNet router hanya mencegat kunci yang punya PanelPages, tapi
           elemen ini murni tautan keluar, bukan rute internal. -->
      <a class="p-cta" href="${esc(window.AdminAPI.tenant.path("wa"))}">
        <span class="p-cta__icon" aria-hidden="true">${window.PanelUI.icon("whatsapp")}</span>
        <span class="p-cta__text">
          <strong>Kirim undangan via WhatsApp</strong>
          <span>Pilih tamu, atur pesan, dan blast link undangan dari satu tempat.</span>
        </span>
        <span class="p-checkrow__go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>
      </a>
      <p class="p-section-label">Bab undangan</p>
      <div class="p-checklist" id="home-chapters"></div>
      <p class="p-section-label">Tamu &amp; alat</p>
      <div class="p-checklist" id="home-counts"></div>
    `;

    // Kesiapan tiap bab dinilai dari field content yang paling mewakili
    // bab itu (seedDefaults di store.js menjamin semua key sudah ada).
    // Bab foto (cover/galeri) memakai hitungan tabel photos — kalau query
    // foto gagal, statusnya "—" (tidak diketahui), bukan salah "belum".
    const CHAPTER_CHECKS = [
      { key: "cover", photo: true, ready: (c, ph) => !!ph && ph.cover > 0 },
      { key: "pembuka", ready: (c) => !!c.opening.quote },
      { key: "mempelai", ready: (c) => !!(c.couple.bride.name && c.couple.groom.name) },
      { key: "acara", ready: (c) => !!(c.event.dateISO && (c.event.akad.venue.name || c.event.resepsi.venue.name)) },
      { key: "livestream", ready: (c) => !!(c.livestream.youtube || c.livestream.instagram || c.livestream.tiktok) },
      { key: "cerita", ready: (c) => c.loveStory.length > 0 },
      { key: "galeri", photo: true, ready: (c, ph) => !!ph && ph.gallery > 0 },
      { key: "hadiah", ready: (c) => c.gift.accounts.length > 0 },
      { key: "penutup", ready: (c) => !!c.closing.text }
    ];

    const router = window.PanelRouter;
    const content = window.PanelStore.getContent();
    const photoCounts = await loadPhotoCounts();
    renderChapters(content, photoCounts);
    renderCounts();

    window.PanelRouter.onPublishStatus(renderStatus);
    const status = await window.PanelRouter.refreshPublishStatus();
    renderStatus(status);

    function renderStatus(s) {
      const box = outlet.querySelector("#home-status");
      if (!box || !s) return;
      box.innerHTML = `
        <div class="p-pubrow__text">
          <strong>${s.dirty ? "Ada perubahan belum dipublikasikan" : "Semua perubahan sudah dipublikasikan"}</strong>
          <span>${s.dirty ? "Tamu masih melihat versi terakhir yang dipublikasikan." : `Dipublikasikan ${window.PanelUI.esc(s.publishedAtLabel || "")}.`}</span>
        </div>
        <span class="p-badge ${s.dirty ? "p-badge--warn" : "p-badge--ok"}">${s.dirty ? "Draft" : "Live"}</span>
        <div class="p-pubrow__actions">
          <button type="button" class="p-btn p-btn--ghost p-btn--tiny" id="home-preview">Pratinjau draft</button>
          <button type="button" class="p-btn p-btn--primary p-btn--tiny" id="home-publish" ${s.dirty ? "" : "disabled"}>Publikasikan</button>
        </div>
      `;
      box.querySelector("#home-preview").addEventListener("click", () => router.openDraftPreview());
      box.querySelector("#home-publish").addEventListener("click", async (e) => {
        e.target.disabled = true;
        await router.publishNow();
      });
    }

    function renderChapters(c, ph) {
      const wrap = outlet.querySelector("#home-chapters");
      if (!wrap) return;
      wrap.innerHTML = CHAPTER_CHECKS.map((chk, i) => {
        const def = window.PanelPages[chk.key];
        // Query foto gagal → bab berbasis foto ditandai "—" (tidak diketahui),
        // bukan salah melapor "belum".
        const known = chk.ready(c, ph === null ? {} : ph);
        const unknown = !known && chk.photo && ph === null;
        const state = unknown
          ? `<span class="p-checkrow__state">—</span>`
          : known
            ? `<span class="p-checkrow__state p-checkrow__state--done">Siap</span>`
            : `<span class="p-checkrow__state p-checkrow__state--todo">Belum</span>`;
        const no = String(i + 1).padStart(2, "0");
        return `
          <a class="p-checkrow" href="${router.hashHref(chk.key)}" data-nav-key="${chk.key}">
            <span class="p-checkrow__num">${no}</span>
            <span class="p-checkrow__name">${esc(def ? def.title : chk.key)}</span>
            ${state}
            <span class="p-checkrow__go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>
          </a>`;
      }).join("");
    }

    async function loadPhotoCounts() {
      const api = window.AdminAPI;
      const { data, error } = await api.query(
        api.sb.from("photos").select("folder").eq("invitation_id", api.tenant.invitationId),
        "Jumlah foto"
      );
      if (error || !Array.isArray(data)) return null;
      const counts = {};
      data.forEach((r) => { if (r && r.folder) counts[r.folder] = (counts[r.folder] || 0) + 1; });
      return counts;
    }

    function renderCounts() {
      const wrap = outlet.querySelector("#home-counts");
      if (!wrap) return;
      const rows = [
        { label: "Ucapan & RSVP", value: "—", href: router.hashHref("ucapan"), navKey: "ucapan" },
        { label: "Tamu check-in", value: "—", href: window.AdminAPI.tenant.path("admin-qr"), navKey: "admin-qr" },
        { label: "Kontak WA", value: "—", href: router.hashHref("kontak"), navKey: "kontak" },
        // Shortcut Kado & Amplop (permintaan pemilik produk): angkanya
        // jumlah entri kado yang sudah dicatat, bukan jumlah daftarnya.
        { label: "Kado & Amplop", value: "—", href: router.hashHref("kado"), navKey: "kado" }
      ];
      wrap.innerHTML = rows.map((r) => `
        <a class="p-checkrow" href="${esc(r.href)}" data-nav-key="${r.navKey}">
          <span class="p-checkrow__name">${esc(r.label)}</span>
          <span class="p-checkrow__value" data-count="${esc(r.label)}">${r.value}</span>
          <span class="p-checkrow__go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>
        </a>`).join("");
      loadCounts(wrap);
    }

    async function loadCounts(wrap) {
      const api = window.AdminAPI;
      const wishesTable = (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes";
      const [wishesRes, checkinsRes, waRes, kadoRes] = await Promise.all([
        api.query(api.sb.from(wishesTable).select("id", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah ucapan"),
        // checkins tidak punya kolom id — primary key-nya guest_key (lihat
        // migrations/0004_roles_livestream_checkins.sql).
        api.query(api.sb.from("checkins").select("guest_key", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah check-in"),
        api.query(api.sb.from("wa_contacts").select("id", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah kontak WA"),
        api.query(api.sb.from("gift_list_entries").select("id", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah kado")
      ]);
      const set = (label, res) => {
        const cell = wrap.querySelector(`[data-count="${CSS.escape(label)}"]`);
        if (cell) cell.textContent = res.error ? "—" : String(res.count ?? 0);
      };
      set("Ucapan & RSVP", wishesRes);
      set("Tamu check-in", checkinsRes);
      set("Kontak WA", waRes);
      set("Kado & Amplop", kadoRes);
    }
  },
  destroy() {
    window.PanelRouter.onPublishStatus(null);
  }
};
