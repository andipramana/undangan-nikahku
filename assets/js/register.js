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

  /* Katalog template — file statis publik, tidak perlu menunggu sesi login
   * gerbang di atas. Satu sumber kebenaran yang sama dibaca picker Template
   * di admin panel tiap client (assets/js/panel/pages/template.js). */
  let templateCatalog = [];
  async function loadTemplateOptions() {
    try {
      const res = await fetch("templates/index.json", { cache: "no-cache" });
      templateCatalog = (await res.json()).templates || [];
    } catch (_) {
      templateCatalog = [{ id: "klasik", name: "Classic Elegance", desc: "" }];
    }
    const select = $("template-id");
    select.innerHTML = templateCatalog.map((t) =>
      `<option value="${esc(t.id)}" ${t.id === "klasik" ? "selected" : ""}>${esc(t.name)}</option>`).join("");
    updateTemplateHint();
  }
  function updateTemplateHint() {
    const t = templateCatalog.find((x) => x.id === $("template-id").value);
    $("template-id-hint").textContent = t ? t.desc || "" : "";
  }
  $("template-id").addEventListener("change", updateTemplateHint);
  loadTemplateOptions();

  /* Cek ketersediaan slug — peringatan lunak saja, constraint unik di DB
   * (kode 23505, ditangani di handler submit) tetap jaring pengaman terakhir
   * untuk race condition (dua tab admin, dsb.). */
  let slugCheckTimer = null;
  $("slug").addEventListener("input", () => {
    const hint = $("slug-hint");
    hint.className = "p-hint";
    const slug = $("slug").value.trim().toLowerCase();
    clearTimeout(slugCheckTimer);
    if (!slug) { hint.textContent = ""; return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { hint.textContent = "Hanya huruf kecil, angka, dan tanda hubung."; return; }
    hint.textContent = "Memeriksa…";
    slugCheckTimer = setTimeout(async () => {
      try {
        const { available } = await invoke({ action: "check_slug", slug });
        // Slug di kotak bisa sudah berubah selagi menunggu jawaban server —
        // jangan menimpa hint kalau begitu.
        if ($("slug").value.trim().toLowerCase() !== slug) return;
        hint.className = available ? "p-hint" : "p-warning";
        hint.textContent = available ? "Tersedia ✓" : "Slug ini sudah dipakai.";
      } catch (_) { /* offline / gagal — diam saja, submit tetap jadi jaring pengaman */ }
    }, 400);
  });

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
      const fromDraft = pendingDraftId;
      const loginPassword = $("admin-password").value;
      const loginEmail = get("admin-email");
      await invoke({
        action: "create", slug, displayName, draftId: fromDraft || undefined,
        templateId: $("template-id").value,
        brideName: get("bride-name"), groomName: get("groom-name"),
        adminEmail: get("admin-email"), adminPassword: $("admin-password").value,
        qrEmail: get("qr-email"), qrPassword: $("qr-password").value
      });
      closeClientModal();
      form.reset();
      resetDraftMode();
      updateTemplateHint();
      $("slug-hint").textContent = "";
      api.toast(`Client "${displayName}" berhasil dibuat.`, false);
      await loadClients();
      if (fromDraft) {
        await loadDrafts();
        // Info login untuk dikirim ke client — sandi hanya terlihat sekarang (tidak disimpan di mana pun).
        window.prompt("Salin info login ini untuk client (sandi tidak bisa dilihat lagi):",
          `Undangan: https://willcome.my.id/${slug}/
Panel admin: https://willcome.my.id/${slug}/admin/
Email: ${loginEmail}
Sandi: ${loginPassword}`);
      }
    } catch (err) {
      api.toast(err.message || "Gagal membuat undangan.", true);
    } finally {
      submit.disabled = false;
    }
  });

  /* ---------- Draft masuk (dari /catin) ---------- */
  const draftsList = $("drafts-list");
  let currentDrafts = [];
  let pendingDraftId = null;       // draft yang sedang dijadikan client lewat modal

  const STATUS = { baru: ["Baru", "accent"], diproses: ["Diproses", "warn"], dibuat: ["Sudah jadi client", "ok"], ditolak: ["Ditolak", "danger"] };
  const waLink = (raw) => {
    const d = String(raw || "").replace(/[^0-9]/g, "");
    if (!d) return "";
    return "https://wa.me/" + (d.startsWith("62") ? d : d.startsWith("0") ? "62" + d.slice(1) : d);
  };
  const randomPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    return Array.from(buf, (n) => chars[n % chars.length]).join("");
  };
  const when = (iso) => new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  async function loadDrafts() {
    draftsList.innerHTML = "<p class='p-muted'>Memuat draft…</p>";
    try {
      const { drafts } = await invoke({ action: "list_drafts" });
      currentDrafts = drafts || [];
      const fresh = currentDrafts.filter((d) => d.status === "baru").length;
      const badge = $("drafts-count");
      badge.hidden = !fresh;
      badge.textContent = fresh + " baru";
      if (!currentDrafts.length) {
        draftsList.innerHTML = "<p class='p-empty'>Belum ada draft. Bagikan link <code>willcome.my.id/catin</code> ke calon pengantin.</p>";
        return;
      }
      draftsList.innerHTML = currentDrafts.map((d) => {
        const p = d.payload || {};
        const bride = p.couple?.bride?.nickname || p.couple?.bride?.name || "—";
        const groom = p.couple?.groom?.nickname || p.couple?.groom?.name || "—";
        const [label, tone] = STATUS[d.status] || [d.status, "info"];
        const wa = waLink(d.contact_wa);
        const edited = d.updated_at && new Date(d.updated_at) - new Date(d.created_at) > 5000;   // diubah pengirim setelah dikirim
        const e = p.extras || {};
        const code = String(d.id).replace(/-/g, "").slice(0, 8).toUpperCase();
        const priv = d.edit_token ? `${location.origin}/catin/?edit=${d.edit_token}` : "";
        const waMsg = wa && priv ? `${wa}?text=${encodeURIComponent(`Halo ${d.contact_name}, ini link pribadimu untuk melihat/mengubah data undangan (kode ${code}):
${priv}`)}` : "";
        const link = (u) => (/^https?:\/\//i.test(u || "") ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>` : esc(u || "—"));
        return `<article class="cl-row" data-draft="${esc(d.id)}">
          <div class="cl-top"><span class="cl-name">${esc(bride)} &amp; ${esc(groom)}</span><span>${edited ? `<span class="p-badge p-badge--info" title="Calon pengantin mengubah datanya setelah mengirim">Diubah ${esc(when(d.updated_at))}</span> ` : ""}<span class="p-badge p-badge--${tone}">${esc(label)}</span></span></div>
          <div class="dr-meta">
            <span>Dikirim ${esc(when(d.created_at))} · kode <b>${esc(code)}</b></span>
            <span>${esc(d.contact_name)} · ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">${esc(d.contact_wa)} (WhatsApp)</a>` : esc(d.contact_wa)} · ${esc(d.contact_email)}</span>
            <span>Tanggal ${esc(p.event?.date || "—")} · link <code>/${esc(d.preferred_slug || "—")}/</code></span>
          </div>
          <div class="dr-link">
            <b>Link pribadi pengirim</b>
            ${priv ? `<div class="dr-link__row"><input class="p-input" type="text" readonly value="${esc(priv)}" aria-label="Link pribadi ${esc(code)}">
              <button type="button" class="p-btn p-btn--tiny" data-draft-copy="${esc(priv)}">Salin link</button>
              <button type="button" class="p-btn p-btn--tiny" data-draft-copy="${esc(code)}">Salin kode</button>
              ${waMsg ? `<a class="p-btn p-btn--tiny" href="${esc(waMsg)}" target="_blank" rel="noopener">Kirim via WhatsApp</a>` : ""}</div>
              <span class="p-hint">Untuk pengirim yang lupa. Link ini membuka (dan bisa mengubah) datanya — kirim hanya ke dia.</span>`
              : `<span class="p-hint">Link tidak tersedia untuk draft ini.</span>`}
          </div>
          <details class="dr-det"><summary>Detail</summary><dl>
            <dt>Akad</dt><dd>${esc(p.event?.akad?.start || "—")} · ${esc(p.event?.akad?.venueName || "—")}</dd>
            <dt>Resepsi</dt><dd>${esc(p.event?.resepsi?.start || "—")} · ${esc(p.event?.resepsi?.venueName || "—")}</dd>
            <dt>Warna</dt><dd>${esc(p.theme?.label || "—")}</dd>
            <dt>Foto</dt><dd>${link(e.photoLink)}</dd>
            <dt>Lagu</dt><dd>${esc(e.song || "—")}</dd>
            <dt>Catatan</dt><dd>${esc(e.notes || "—")}</dd>
          </dl></details>
          <div class="cl-actions">
            ${d.status !== "dibuat" ? `<button type="button" class="p-btn p-btn--tiny p-btn--primary" data-draft-create>Buat client</button>` : ""}
            ${d.status === "baru" ? `<button type="button" class="p-btn p-btn--tiny" data-draft-status="diproses">Tandai diproses</button>` : ""}
            ${d.status !== "dibuat" && d.status !== "ditolak" ? `<button type="button" class="p-btn p-btn--tiny" data-draft-status="ditolak">Tolak</button>` : ""}
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-draft-delete>Hapus</button>
          </div>
        </article>`;
      }).join("");
    } catch (err) {
      draftsList.innerHTML = `<p class='p-empty'>Gagal memuat draft: ${esc(err.message || err)}</p>`;
    }
  }

  /** Isi modal "Buat client" dari sebuah draft. Password dibuat acak & ditampilkan
   * (bukan titik-titik) supaya bisa dicatat sebelum disimpan. */
  function openClientModalFromDraft(draft) {
    const p = draft.payload || {};
    const nick = (x) => x?.nickname || x?.name || "";
    pendingDraftId = draft.id;
    $("client-modal-title").textContent = "Buat client dari draft";
    $("slug").value = draft.preferred_slug || "";
    $("display-name").value = `${nick(p.couple?.bride)} & ${nick(p.couple?.groom)}`.trim();
    $("bride-name").value = p.couple?.bride?.name || "";
    $("groom-name").value = p.couple?.groom?.name || "";
    $("admin-email").value = draft.contact_email || "";
    $("admin-password").type = "text";
    $("admin-password").value = randomPassword();
    $("qr-email").value = ""; $("qr-password").value = "";
    clientModal.hidden = false;
    $("slug").dispatchEvent(new Event("input", { bubbles: true }));
  }
  function resetDraftMode() {
    pendingDraftId = null;
    $("client-modal-title").textContent = "Buat client baru";
    $("admin-password").type = "password";
  }
  // Menutup modal (tombol ×, klik di luar, atau selesai) selalu mengembalikan mode normal.
  $("client-modal-close").addEventListener("click", resetDraftMode);
  clientModal.addEventListener("click", (e) => { if (e.target === clientModal) resetDraftMode(); });
  $("client-new-open").addEventListener("click", resetDraftMode);

  draftsList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    const row = event.target.closest("[data-draft]");
    if (!button || !row) return;
    const draft = currentDrafts.find((d) => d.id === row.dataset.draft);
    if (!draft) return;
    try {
      if (button.hasAttribute("data-draft-copy")) {
        const text = button.dataset.draftCopy;
        try { await navigator.clipboard.writeText(text); }
        catch (_) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
        api.toast("Tersalin ✓", false);
        return;
      }
      if (button.hasAttribute("data-draft-create")) {
        openClientModalFromDraft(draft);
      } else if (button.dataset.draftStatus) {
        button.disabled = true;
        await invoke({ action: "update_draft", draftId: draft.id, status: button.dataset.draftStatus });
        await loadDrafts();
      } else if (button.hasAttribute("data-draft-delete")) {
        if (!confirm("Hapus draft ini permanen? Client yang sudah dibuat darinya tidak ikut terhapus.")) return;
        button.disabled = true;
        await invoke({ action: "delete_draft", draftId: draft.id });
        await loadDrafts();
      }
    } catch (err) {
      api.toast(err.message || "Aksi gagal.", true);
      button.disabled = false;
    }
  });
  $("drafts-refresh").addEventListener("click", loadDrafts);

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
    onSignedIn: () => { loadClients(); loadDrafts(); }
  });
})();
