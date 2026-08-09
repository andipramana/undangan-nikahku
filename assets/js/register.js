(function () {
  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;
  const form = document.getElementById("register-form");
  const message = document.getElementById("message");
  const result = document.getElementById("result");
  const clientsPanel = document.getElementById("clients-panel");
  const clientsList = document.getElementById("clients-list");
  const refreshClients = document.getElementById("clients-refresh");
  const openClients = document.getElementById("clients-open");
  const syncDemo = document.getElementById("sync-demo");
  const captureDefault = document.getElementById("capture-default");
  if (!window.supabase || !cfg) { message.textContent = "Supabase belum dikonfigurasi."; return; }
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);

  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const invoke = async body => {
    const { data, error } = await sb.functions.invoke("provision-invitation", { body });
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
  async function ensureRootLogin() {
    const { data: { session } } = await sb.auth.getSession();
    if (session) return;
    const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("owner-email").value.trim(), password: document.getElementById("owner-password").value });
    if (error) throw error;
  }
  async function loadClients() {
    clientsPanel.hidden = false;
    clientsList.innerHTML = "<p class='muted'>Memuat daftar client…</p>";
    try {
      await ensureRootLogin();
      const { clients } = await invoke({ action: "list" });
      clientsList.innerHTML = clients?.length ? clients.map(client => {
        const admin = client.members?.find(m => m.role === "admin")?.email || "—";
        const qr = client.members?.find(m => m.role === "admin_qr")?.email || "—";
        return `<article class="client-row" data-id="${esc(client.id)}" data-name="${esc(client.display_name)}">
          <div class="client-row__main"><strong>${esc(client.display_name)}</strong><small>/${esc(client.slug)}/ · dibuat ${new Date(client.created_at).toLocaleDateString("id-ID")}</small><small>Admin: ${esc(admin)} · QR: ${esc(qr)}</small></div>
          <span class="client-status client-status--${client.is_active ? "active" : "inactive"}">${client.is_active ? "Aktif" : "Nonaktif"}</span>
          <div class="client-row__actions"><button type="button" class="btn btn--tiny" data-client-edit>Edit</button><button type="button" class="btn btn--tiny" data-client-toggle>${client.is_active ? "Nonaktifkan" : "Aktifkan"}</button><button type="button" class="btn btn--tiny btn--danger" data-client-delete>Hapus</button></div>
        </article>`;
      }).join("") : "<p class='muted'>Belum ada client selain undangan root.</p>";
    } catch (err) { clientsList.innerHTML = `<p class="warning">Gagal memuat client: ${esc(err.message || err)}</p>`; }
  }
  clientsList.addEventListener("click", async event => {
    const button = event.target.closest("button"); const row = event.target.closest(".client-row");
    if (!button || !row) return;
    const invitationId = row.dataset.id; const currentName = row.dataset.name;
    try {
      if (button.hasAttribute("data-client-edit")) {
        const displayName = prompt("Nama client / judul undangan:", currentName);
        if (!displayName?.trim()) return;
        await invoke({ action:"update", invitationId, displayName:displayName.trim(), isActive:!row.querySelector(".client-status").classList.contains("client-status--inactive") });
        await loadClients();
      } else if (button.hasAttribute("data-client-toggle")) {
        const isActive = row.querySelector(".client-status").classList.contains("client-status--active");
        if (!confirm(`${isActive ? "Nonaktifkan" : "Aktifkan"} client "${currentName}"?`)) return;
        await invoke({ action:"update", invitationId, displayName:currentName, isActive:!isActive }); await loadClients();
      } else if (button.hasAttribute("data-client-delete")) {
        if (!confirm(`HAPUS client "${currentName}"?\n\nSemua data undangan, foto Storage tenant, akun Admin dan Admin QR akan dihapus permanen.`)) return;
        if (prompt(`Ketik HAPUS untuk menghapus "${currentName}" secara permanen:`) !== "HAPUS") return;
        button.disabled = true;
        const data = await invoke({ action:"delete", invitationId });
        if (data.retainedUserIds?.length) alert("Data tenant dihapus. Ada akun yang dipertahankan karena masih dipakai tenant lain.");
        await loadClients();
      }
    } catch (err) { alert("Gagal: " + (err.message || err)); button.disabled = false; }
  });
  refreshClients.addEventListener("click", loadClients);
  openClients.addEventListener("click", loadClients);
  captureDefault.addEventListener("click", async () => {
    message.textContent = "";
    captureDefault.disabled = true;
    try {
      await ensureRootLogin();
      await invoke({ action: "capture_default_template" });
      message.textContent = "Default statis berhasil dibuat dari root saat ini. Root berikutnya tidak akan mengubah default ini.";
    } catch (err) { message.textContent = err.message || "Gagal mengambil default dari root."; }
    finally { captureDefault.disabled = false; }
  });
  syncDemo.addEventListener("click", async () => {
    message.textContent = "";
    syncDemo.disabled = true;
    try {
      await ensureRootLogin();
      await invoke({ action: "sync_demo" });
      message.textContent = "Demo sudah disalin dari root. Client baru sekarang akan memakai template demo ini.";
    } catch (err) { message.textContent = err.message || "Gagal memperbarui demo."; }
    finally { syncDemo.disabled = false; }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault(); message.textContent = ""; result.hidden = true;
    const get = id => document.getElementById(id).value.trim(); const slug = get("slug").toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { message.textContent = "Slug hanya huruf kecil, angka, dan tanda hubung."; return; }
    const submit = document.getElementById("submit"); submit.disabled = true;
    try {
      await ensureRootLogin();
      const data = await invoke({ action:"create", slug, displayName:get("display-name"), brideName:get("bride-name"), groomName:get("groom-name"), adminEmail:get("admin-email"), adminPassword:document.getElementById("admin-password").value, qrEmail:get("qr-email"), qrPassword:document.getElementById("qr-password").value });
      result.hidden=false; result.innerHTML=`<p class="muted">Undangan berhasil dibuat. Email Admin dan Admin QR otomatis terdaftar di Supabase Auth.</p><ul><li><a href="${data.urls.invitation}" target="_blank">Undangan</a></li><li><a href="${data.urls.admin}" target="_blank">Admin</a></li><li><a href="${data.urls.adminQr}" target="_blank">Admin QR</a></li></ul>`;
      form.reset(); await loadClients();
    } catch (err) { message.textContent=err.message || "Gagal membuat undangan."; }
    finally { submit.disabled=false; }
  });
})();
