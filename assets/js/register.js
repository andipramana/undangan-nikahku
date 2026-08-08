(function () {
  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;
  const form = document.getElementById("register-form");
  const message = document.getElementById("message");
  const result = document.getElementById("result");
  if (!window.supabase || !cfg) { message.textContent = "Supabase belum dikonfigurasi."; return; }
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); message.textContent = ""; result.hidden = true;
    const get = (id) => document.getElementById(id).value.trim();
    const slug = get("slug").toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { message.textContent = "Slug hanya huruf kecil, angka, dan tanda hubung."; return; }
    const submit = document.getElementById("submit"); submit.disabled = true;
    try {
      const { error: loginError } = await sb.auth.signInWithPassword({ email: get("owner-email"), password: document.getElementById("owner-password").value });
      if (loginError) throw loginError;
      const { data, error } = await sb.functions.invoke("provision-invitation", { body: {
        slug, displayName: get("display-name"), brideName: get("bride-name"), groomName: get("groom-name"), adminEmail: get("admin-email"), adminPassword: document.getElementById("admin-password").value,
        qrEmail: get("qr-email"), qrPassword: document.getElementById("qr-password").value
      }});
      if (error) throw error;
      if (!data || data.error) throw new Error(data && data.error || "Provisioning gagal.");
      result.hidden = false;
      result.innerHTML = `<p class="muted">Undangan berhasil dibuat.</p><ul><li><a href="${data.urls.invitation}" target="_blank">Undangan</a></li><li><a href="${data.urls.admin}" target="_blank">Admin</a></li><li><a href="${data.urls.adminQr}" target="_blank">Admin QR</a></li></ul>`;
      form.reset();
    } catch (err) { message.textContent = err.message || "Gagal membuat undangan."; }
    finally { submit.disabled = false; }
  });
})();
