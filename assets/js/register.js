(function () {
  /* Dashboard root — register.html.
   *
   * Gerbang login reuse panel/core.js: initAdminAuth → requireTenantAccess
   * memanggil RPC get_my_invitation_access dengan slug "root" (dari
   * TenantContext, halaman ini hidup di /register.html) dan hanya menerima
   * role "root_owner". Semua operasi data lewat Edge Function service-role
   * provision-invitation — halaman ini tidak pernah menyentuh tabel
   * Supabase langsung, dan tidak pernah meminta kredensial root di form
   * manapun: sesi gerbang yang dipakai.
   */
  const api = window.AdminAPI;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const clientsList = $("clients-list");
  const clientModal = $("client-modal");
  const accountModal = $("account-modal");
  const accountLabel = $("account-client-label");
  const accountList = $("account-list");
  if (!api || !clientsList) return;

  const invoke = async (body) => {
    const { data, error } = await api.sb.functions.invoke("provision-invitation", { body });
    if (error) {
      // functions.invoke menyederhanakan non-2xx menjadi pesan generik. Baca
      // body JSON yang memang dikirim function agar root owner tahu aksi mana
      // yang ditolak, tanpa membuka secret/stack trace.
      let detail = "";
      try {
        const response = error.context;
        if (response && typeof response.clone === "function") {
          const payload = await response.clone().json();
          detail = payload?.error || "";
        }
      } catch (_) { /* fallback ke pesan generik di bawah */ }
      throw new Error(detail || error.message || "Permintaan Edge Function gagal.");
    }
    if (!data || data.error) throw new Error(data?.error || "Permintaan gagal.");
    return data;
  };

  /* URL per client dibangun dari slug memakai konvensi path yang sama dengan
   * tenant.js/tenant-routing.mjs — tidak perlu field tambahan dari server. */
  const clientUrls = (slug) => ({
    invitation: `/${slug}/`,
    admin: `/${slug}/admin/`,
    adminQr: `/${slug}/admin-qr/`
  });
  const roleLabel = (role) => (role === "admin" ? "Admin undangan" : role === "admin_qr" ? "Admin QR" : role);

  let currentClients = [];

  async function loadClients() {
    clientsList.innerHTML = "<p class='p-muted'>Memuat daftar client…</p>";
    try {
      const { clients } = await invoke({ action: "list" });
      currentClients = clients || [];
      if (!currentClients.length) {
        clientsList.innerHTML = "<p class='p-empty'>Belum ada client. Klik “+ Client baru” untuk membuat undangan pertama.</p>";
        return;
      }
      clientsList.innerHTML = currentClients.map((client) => {
        const admin = client.members?.find((m) => m.role === "admin")?.email || "—";
        const qr = client.members?.find((m) => m.role === "admin_qr")?.email || "—";
        const urls = clientUrls(client.slug);
        return `<article class="cl-row" data-id="${esc(client.id)}" data-slug="${esc(client.slug)}" data-name="${esc(client.display_name)}" data-active="${client.is_active ? "1" : ""}">
          <div class="cl-top"><span class="cl-name">${esc(client.display_name)}</span><span class="p-badge p-badge--${client.is_active ? "ok" : "warn"}">${client.is_active ? "Aktif" : "Nonaktif"}</span></div>
          <span class="cl-meta">/${esc(client.slug)}/ · dibuat ${new Date(client.created_at).toLocaleDateString("id-ID")}</span>
          <span class="cl-meta">Admin: ${esc(admin)} · QR: ${esc(qr)}</span>
          <div class="cl-links">
            <a href="${urls.invitation}" target="_blank" rel="noopener">Undangan ↗</a>
            <a href="${urls.admin}" target="_blank" rel="noopener">Panel admin ↗</a>
            <a href="${urls.adminQr}" target="_blank" rel="noopener">Panel QR ↗</a>
          </div>
          <div class="cl-actions">
            <button type="button" class="p-btn p-btn--tiny" data-client-edit>Edit nama</button>
            <button type="button" class="p-btn p-btn--tiny" data-client-toggle>${client.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
            <button type="button" class="p-btn p-btn--tiny" data-account-manage>Kelola akun</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-client-delete>Hapus permanen</button>
          </div>
        </article>`;
      }).join("");
    } catch (err) {
      clientsList.innerHTML = `<p class='p-empty'>Gagal memuat client: ${esc(err.message || err)}</p>`;
    }
  }

  /* ---------- Aksi per client (delegation di daftar) ---------- */
  clientsList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    const row = event.target.closest(".cl-row");
    if (!button || !row) return;
    const invitationId = row.dataset.id;
    const currentName = row.dataset.name;
    const isActive = row.dataset.active === "1";
    try {
      if (button.hasAttribute("data-client-edit")) {
        const displayName = prompt("Nama client / judul undangan:", currentName);
        if (!displayName?.trim()) return;
        await invoke({ action: "update", invitationId, displayName: displayName.trim(), isActive });
        await loadClients();
      } else if (button.hasAttribute("data-client-toggle")) {
        if (!confirm(`${isActive ? "Nonaktifkan" : "Aktifkan"} client "${currentName}"?`)) return;
        await invoke({ action: "update", invitationId, displayName: currentName, isActive: !isActive });
        await loadClients();
      } else if (button.hasAttribute("data-account-manage")) {
        const client = currentClients.find((c) => c.id === invitationId);
        if (client) openAccountModal(client);
      } else if (button.hasAttribute("data-client-delete")) {
        if (!confirm(`HAPUS client "${currentName}"?\n\nSemua data undangan, foto Storage tenant, akun Admin dan Admin QR akan dihapus permanen.`)) return;
        if (prompt(`Ketik HAPUS untuk menghapus "${currentName}" secara permanen:`) !== "HAPUS") return;
        button.disabled = true;
        const data = await invoke({ action: "delete", invitationId });
        if (data.retainedUserIds?.length) alert("Data tenant dihapus. Ada akun yang dipertahankan karena masih dipakai tenant lain.");
        await loadClients();
      }
    } catch (err) {
      api.toast(err.message || "Aksi gagal.", true);
      button.disabled = false;
    }
  });
  $("clients-refresh").addEventListener("click", loadClients);

  /* ---------- Modal kelola akun (reset sandi / ganti email) ---------- */
  function openAccountModal(client) {
    accountModal.dataset.clientId = client.id;
    accountLabel.textContent = `${client.display_name} · /${client.slug}/`;
    accountList.innerHTML = client.members?.length
      ? client.members.map((m) => `
        <div class="ac-member" data-user-id="${esc(m.userId)}">
          <div class="ac-member__head"><strong>${esc(roleLabel(m.role))}</strong><span class="ac-mail">${esc(m.email || "(email tidak terbaca)")}</span></div>
          <div class="ac-line">
            <input class="p-input" type="email" placeholder="Email login baru" aria-label="Email login baru untuk ${esc(roleLabel(m.role))}" data-ac-email>
            <button type="button" class="p-btn p-btn--tiny" data-ac-save-email>Ganti email</button>
          </div>
          <div class="ac-line">
            <input class="p-input" type="password" minlength="8" placeholder="Kata sandi baru (min. 8 karakter)" autocomplete="new-password" aria-label="Kata sandi baru untuk ${esc(roleLabel(m.role))}" data-ac-pass>
            <button type="button" class="p-btn p-btn--tiny" data-ac-reset>Reset sandi</button>
          </div>
        </div>`).join("")
      : "<p class='p-muted'>Client ini belum punya akun anggota.</p>";
    accountModal.hidden = false;
  }

  accountList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    const memberEl = button?.closest(".ac-member");
    if (!button || !memberEl) return;
    const userId = memberEl.dataset.userId;
    try {
      if (button.hasAttribute("data-ac-reset")) {
        const passInput = memberEl.querySelector("[data-ac-pass]");
        const newPassword = passInput.value;
        if (newPassword.length < 8) {
          api.toast("Kata sandi minimal 8 karakter.", true);
          passInput.focus();
          return;
        }
        button.disabled = true;
        await invoke({ action: "update_member_account", userId, newPassword });
        passInput.value = "";
        api.toast("Kata sandi berhasil direset.");
      } else if (button.hasAttribute("data-ac-save-email")) {
        const mailInput = memberEl.querySelector("[data-ac-email]");
        const newEmail = mailInput.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          api.toast("Format email tidak valid.", true);
          mailInput.focus();
          return;
        }
        button.disabled = true;
        await invoke({ action: "update_member_account", userId, newEmail });
        mailInput.value = "";
        api.toast("Email akun diganti.");
        await loadClients(); // email di daftar utama ikut segar
      }
    } catch (err) {
      api.toast(err.message || "Gagal memperbarui akun.", true);
    } finally {
      button.disabled = false;
    }
  });

  /* ---------- Modal client baru (alur sekunder) ---------- */
  $("client-new-open").addEventListener("click", () => { clientModal.hidden = false; });
  const closeClientModal = () => { clientModal.hidden = true; };
  $("client-modal-close").addEventListener("click", closeClientModal);
  const closeAccountModal = () => { accountModal.hidden = true; };
  $("account-modal-close").addEventListener("click", closeAccountModal);
  // Klik scrim (di luar panel) menutup modal — pola panel lain juga begini.
  [clientModal, accountModal].forEach((modal) =>
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; })
  );

  const form = $("register-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const get = (id) => $(id).value.trim();
    const slug = get("slug").toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      api.toast("Slug hanya huruf kecil, angka, dan tanda hubung.", true);
      return;
    }
    const displayName = get("display-name");
    const submit = $("submit");
    submit.disabled = true;
    try {
      await invoke({
        action: "create", slug, displayName,
        brideName: get("bride-name"), groomName: get("groom-name"),
        adminEmail: get("admin-email"), adminPassword: $("admin-password").value,
        qrEmail: get("qr-email"), qrPassword: $("qr-password").value
      });
      closeClientModal();
      form.reset();
      api.toast(`Client "${displayName}" berhasil dibuat.`, false);
      await loadClients();
    } catch (err) {
      api.toast(err.message || "Gagal membuat undangan.", true);
    } finally {
      submit.disabled = false;
    }
  });

  /* ---------- Tools lanjutan ---------- */
  $("capture-default").addEventListener("click", async () => {
    const btn = $("capture-default");
    btn.disabled = true;
    try {
      await invoke({ action: "capture_default_template" });
      api.toast("Default statis berhasil dibuat dari root saat ini.");
    } catch (err) {
      api.toast(err.message || "Gagal mengambil default dari root.", true);
    } finally {
      btn.disabled = false;
    }
  });
  $("sync-demo").addEventListener("click", async () => {
    const btn = $("sync-demo");
    btn.disabled = true;
    try {
      await invoke({ action: "sync_demo" });
      api.toast("Demo sudah disalin dari default statis.");
    } catch (err) {
      api.toast(err.message || "Gagal memperbarui demo.", true);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Gerbang login (core.js) ---------- */
  window.AdminShared.initAdminAuth({
    allowedRoles: ["root_owner"],
    onSignedIn: loadClients
  });
})();
