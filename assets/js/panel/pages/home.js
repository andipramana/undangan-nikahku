/**
 * Beranda — hub. Kartu status publikasi paling atas (inverted pyramid: status
 * dulu, baru detail), lalu ringkasan angka, lalu navigasi ke seluruh 18
 * halaman lain (dikelompokkan, lihat PanelRouter.renderNavGridHtml()).
 *
 * Di HP, halaman ini SATU-SATUNYA tempat tombol Keluar terlihat (sidebar
 * disembunyikan di bawah 1024px) — lihat baris "tenant + keluar" di bawah.
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["home"] = {
  title: "Beranda",
  group: null,
  icon: window.PanelUI ? window.PanelUI.icon("home") : "",
  async mount(outlet) {
    outlet.innerHTML = `
      <div class="p-toolbar" style="margin-bottom:-.5rem">
        <span class="p-chip">/${window.PanelUI.escAttr(window.AdminAPI.tenant.slug)}/</span>
        <button type="button" class="p-btn p-btn--ghost p-btn--tiny" id="home-logout">Keluar</button>
      </div>
      <div class="p-status-card" id="home-status">
        <div class="p-status-card__text"><strong>Memeriksa status publikasi…</strong></div>
      </div>
      <div class="p-kpi-row" id="home-kpi">
        <div class="p-kpi"><div class="p-kpi__value">—</div><div class="p-kpi__label">Ucapan &amp; RSVP</div></div>
        <div class="p-kpi"><div class="p-kpi__value">—</div><div class="p-kpi__label">Tamu check-in</div></div>
        <div class="p-kpi"><div class="p-kpi__value">—</div><div class="p-kpi__label">Kontak WA</div></div>
      </div>
      ${window.PanelRouter.renderNavGridHtml()}
    `;

    outlet.querySelector("#home-logout").addEventListener("click", () => {
      window.AdminAPI.sb.auth.signOut();
    });

    window.PanelRouter.onPublishStatus(renderStatus);
    const status = await window.PanelRouter.refreshPublishStatus();
    renderStatus(status);
    loadKpis();

    function renderStatus(s) {
      const box = outlet.querySelector("#home-status");
      if (!box || !s) return;
      box.innerHTML = `
        <div class="p-status-card__text">
          <strong>${s.dirty ? "Ada perubahan belum dipublikasikan" : "Semua perubahan sudah dipublikasikan"}</strong>
          <span>${s.dirty ? "Tamu masih melihat versi terakhir yang dipublikasikan." : `Dipublikasikan ${window.PanelUI.esc(s.publishedAtLabel || "")}.`}</span>
        </div>
        <span class="p-badge ${s.dirty ? "p-badge--warn" : "p-badge--ok"}">${s.dirty ? "Draft" : "Live"}</span>
        <div class="p-status-card__actions">
          <button type="button" class="p-btn p-btn--ghost" id="home-preview">Pratinjau draft</button>
          <button type="button" class="p-btn p-btn--primary" id="home-publish" ${s.dirty ? "" : "disabled"}>Publikasikan</button>
        </div>
      `;
      box.querySelector("#home-preview").addEventListener("click", () => window.PanelRouter.openDraftPreview());
      box.querySelector("#home-publish").addEventListener("click", async (e) => {
        e.target.disabled = true;
        await window.PanelRouter.publishNow();
      });
    }

    async function loadKpis() {
      const api = window.AdminAPI;
      const wishesTable = (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes";
      const [wishesRes, checkinsRes, waRes] = await Promise.all([
        api.query(api.sb.from(wishesTable).select("id", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah ucapan"),
        // checkins tidak punya kolom id — primary key-nya guest_key (lihat
        // migrations/0004_roles_livestream_checkins.sql).
        api.query(api.sb.from("checkins").select("guest_key", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah check-in"),
        api.query(api.sb.from("wa_contacts").select("id", { count: "exact", head: true }).eq("invitation_id", api.tenant.invitationId), "Jumlah kontak WA")
      ]);
      const cells = outlet.querySelectorAll("#home-kpi .p-kpi__value");
      if (!cells.length) return;
      cells[0].textContent = wishesRes.error ? "—" : String(wishesRes.count ?? 0);
      cells[1].textContent = checkinsRes.error ? "—" : String(checkinsRes.count ?? 0);
      cells[2].textContent = waRes.error ? "—" : String(waRes.count ?? 0);
    }
  },
  destroy() {
    window.PanelRouter.onPublishStatus(null);
  }
};
