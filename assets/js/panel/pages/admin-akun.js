/**
 * Akun Admin (#/admin-akun) — daftar email akun yang punya akses ke
 * undangan ini (invitation_members), beserta perannya (Admin / Admin QR),
 * dan — khusus pemilik akar — tombol ganti sandi per anggota.
 *
 * Email akun lain TIDAK bisa dibaca dari client (auth.users terlindungi),
 * dan mengganti sandi orang lain butuh service-role — semuanya lewat Edge
 * Function `manage-admins` (action list / reset_password, pola sama dengan
 * provision-invitation). Kalau function belum ter-deploy, halaman tetap
 * tampil dengan pesan yang menjelaskan, bukan rusak.
 */
(function () {
  const ROLE_LABEL = {
    admin: ["Admin", "ok"],
    admin_qr: ["Admin QR", "info"],
    root_owner: ["Pemilik akar", "warn"]
  };

  async function invoke(api, body) {
    const { data, error } = await api.sb.functions.invoke("manage-admins", { body });
    if (error) {
      // functions.invoke menyederhanakan non-2xx menjadi pesan generik; baca
      // body JSON yang dikirim function agar penyebabnya jelas (pola register.js).
      let detail = "";
      try {
        const response = error.context;
        if (response && typeof response.clone === "function") {
          detail = (await response.clone().json())?.error || "";
        }
      } catch (_) { /* fallback ke pesan generik */ }
      throw new Error(detail || error.message || "Permintaan gagal.");
    }
    if (!data || data.error) throw new Error(data?.error || "Permintaan gagal.");
    return data;
  }

  window.PanelPages["admin-akun"] = {
    title: "Akun Admin",
    group: "Pengaturan",
    icon: window.PanelUI.icon("users"),

    async mount(outlet) {
      const api = window.AdminAPI;
      const ui = window.PanelUI;
      const esc = ui.esc;
      const escAttr = ui.escAttr;

      // Boot sudah memverifikasi akses tenant; panggil lagi (RPC ringan) hanya
      // untuk membaca ROLE pemanggil: "root_owner" membuka tombol ganti sandi.
      let role = "";
      try {
        const access = await api.requireTenantAccess();
        role = access && access.role ? access.role : "";
      } catch (_) { role = ""; }
      const isRootOwner = role === "root_owner";

      outlet.innerHTML = `
        ${ui.card("Daftar email admin", "Akun-akun yang bisa masuk ke panel undangan ini, beserta perannya. Sandi akunmu sendiri diganti lewat menu ⋯ → Ganti Password di kanan atas.", `
          <div id="aa-list"><p class="p-muted">Memuat daftar akun…</p></div>
        `, { id: "aa-card-list" })}
        ${ui.card("Ganti sandi anggota", isRootOwner
          ? "Kamu masuk sebagai pemilik akar — boleh mengatur sandi semua akun di atas. Sandi baru tidak dikirim otomatis; sampaikan langsung ke yang bersangkutan."
          : "Mengganti sandi akun lain hanya bisa dilakukan pemilik akar (root owner). Kalau sebuah akun perlu direset, hubungi pemilik undangan utama.", `
          ${isRootOwner ? "" : `<p class="p-hint">Menu ⋯ → Ganti Password selalu bisa dipakai untuk sandi akunmu sendiri.</p>`}
        `, { id: "aa-card-reset" })}
        <div id="aa-passwd-slot"></div>
      `;

      const listBox = outlet.querySelector("#aa-list");

      /** Modal ganti sandi satu anggota — dibuat dinamis di dalam outlet
       * sehingga ikut terbuang saat pindah halaman (destroy tanpa listener). */
      function openPasswdModal(member) {
        const slot = outlet.querySelector("#aa-passwd-slot");
        slot.innerHTML = `
          <div id="aa-passwd-modal" class="p-modal">
            <form class="p-modal__panel" id="aa-passwd-form">
              <div class="p-modal__header"><h3>Ganti sandi</h3><button type="button" class="p-modal__close" id="aa-passwd-close">&times;</button></div>
              <p class="p-muted" style="margin:.2rem 0 .6rem">Untuk akun <strong>${esc(member.email || member.userId)}</strong></p>
              <label class="p-field"><span>Password baru</span><input class="p-input" type="password" id="aa-passwd-new" autocomplete="new-password" required></label>
              <label class="p-field"><span>Konfirmasi password baru</span><input class="p-input" type="password" id="aa-passwd-confirm" autocomplete="new-password" required></label>
              <p class="p-hint">Minimal 8 karakter. Yang bersangkutan akan keluar dari sesi lama setelah sandinya diganti.</p>
              <p class="p-warning p-warning--danger" id="aa-passwd-error" hidden></p>
              <div style="display:flex; gap:12px; margin-top:16px">
                <button type="submit" class="p-btn p-btn--primary" id="aa-passwd-save">Simpan password</button>
                <button type="button" class="p-btn p-btn--ghost" id="aa-passwd-cancel">Batal</button>
              </div>
            </form>
          </div>`;
        const modal = slot.querySelector("#aa-passwd-modal");
        const form = slot.querySelector("#aa-passwd-form");
        const errEl = slot.querySelector("#aa-passwd-error");
        const showErr = (msg) => { errEl.textContent = msg; errEl.hidden = false; };
        ui.openModal(modal);
        slot.querySelector("#aa-passwd-close").addEventListener("click", () => ui.closeModal(modal));
        slot.querySelector("#aa-passwd-cancel").addEventListener("click", () => ui.closeModal(modal));
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          errEl.hidden = true;
          const pw = slot.querySelector("#aa-passwd-new").value;
          if (pw.length < 8) { showErr("Password minimal 8 karakter."); return; }
          if (pw !== slot.querySelector("#aa-passwd-confirm").value) { showErr("Konfirmasi tidak sama dengan password baru."); return; }
          const saveBtn = slot.querySelector("#aa-passwd-save");
          saveBtn.disabled = true;
          try {
            await invoke(api, { action: "reset_password", invitationId: api.tenant.invitationId, userId: member.userId, password: pw });
            ui.toast(`Sandi ${member.email || "anggota"} berhasil diganti.`);
            ui.closeModal(modal);
            slot.innerHTML = "";
          } catch (err) {
            showErr(err.message || "Gagal mengganti password.");
          } finally {
            saveBtn.disabled = false;
          }
        });
      }

      try {
        const { members } = await invoke(api, { action: "list", invitationId: api.tenant.invitationId });
        const rows = (members || []).map((m) => {
          const [label, variant] = ROLE_LABEL[m.role] || [m.role || "Anggota", "info"];
          const when = m.createdAt ? new Date(m.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "";
          return `
            <div class="p-list-row" style="margin-bottom:.55rem">
              <div class="p-list-row__fields">
                <strong>${esc(m.email || "(email tidak terbaca)")}</strong>
                <span class="p-muted" style="font-size:.78rem;display:block">${when ? `anggota sejak ${esc(when)}` : "&nbsp;"}</span>
                ${ui.badge(label, variant)}
              </div>
              <div class="p-list-row__controls">
                ${isRootOwner && m.role !== "root_owner" ? `<button type="button" class="p-btn p-btn--tiny" data-aa-userid="${escAttr(m.userId)}" data-aa-email="${escAttr(m.email)}">Ganti sandi</button>` : ""}
              </div>
            </div>`;
        }).join("");
        listBox.innerHTML = rows || `<p class="p-muted">Belum ada anggota terdaftar di undangan ini.</p>`;
      } catch (err) {
        listBox.innerHTML = `<p class="p-warning p-warning--danger">Gagal memuat daftar akun: ${esc(err.message || err)}</p>
          <p class="p-hint">Kalau pesannya "Failed to fetch" atau function tidak ditemukan, Edge Function <code>manage-admins</code> belum ter-deploy — jalankan <code>npx supabase functions deploy manage-admins</code>.</p>`;
      }

      outlet.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-aa-userid]");
        if (!btn) return;
        openPasswdModal({ userId: btn.getAttribute("data-aa-userid"), email: btn.getAttribute("data-aa-email") });
      });
    },

    destroy() {}
  };
})();
