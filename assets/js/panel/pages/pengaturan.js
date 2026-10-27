/** Pengaturan Undangan — identitas situs, slideshow, backsound. Halaman paling
 * sederhana dari 18 halaman non-Beranda; juga jadi pembuktian pertama siklus
 * simpan lewat store.js (Fase 2 rencana v2). */
window.PanelPages = window.PanelPages || {};
/** Ikon unggahan client tersimpan di content.appIcon = { path, version }. */
function hasIcon(c) { return !!(c.appIcon && c.appIcon.path && c.appIcon.version); }
function iconUrl(c) {
  return hasIcon(c)
    ? `${window.AdminAPI.photoUrl(c.appIcon.path + "/icon-192.png")}?v=${encodeURIComponent(c.appIcon.version)}`
    : "assets/icons/inv-192.png";
}

window.PanelPages["pengaturan"] = {
  title: "Pengaturan Undangan",
  group: "Pengaturan",
  icon: window.PanelUI.icon("settings"),
  async mount(outlet) {
    const { field, textarea, card, switchRow, esc, escAttr } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML = `
      ${card("Umum", "Identitas dasar situs undangan.", `
        ${field("Judul situs", "st-site-title")}
        ${field("Parameter nama tamu (URL)", "st-guest-param")}
        ${field("Nama tamu default", "st-default-guest")}
      `)}
      ${card("Ikon undangan", "Gambar kecil di tab browser dan di layar utama HP tamu saat undangan dipasang.", `
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <img id="st-icon-preview" src="${escAttr(iconUrl(c))}" alt="Ikon undangan" width="96" height="96"
               style="width:96px;height:96px;border-radius:22px;border:1px solid var(--p-hairline);object-fit:cover;background:var(--p-sunken)">
          <div style="display:grid;gap:8px;justify-items:start">
            <label class="p-btn p-btn--ghost" for="st-icon-file" style="cursor:pointer">Unggah ikon</label>
            <input type="file" id="st-icon-file" accept="image/png,image/jpeg,image/webp" hidden>
            <button type="button" class="p-btn p-btn--ghost p-btn--tiny" id="st-icon-reset" ${hasIcon(c) ? "" : "hidden"}>Kembali ke ikon bawaan</button>
          </div>
        </div>
        <p class="p-hint" id="st-icon-status">${hasIcon(c) ? "Ikon kamu sedang dipakai." : "Memakai ikon bawaan WillCome."}</p>
        <p class="p-hint">Pakai gambar persegi, minimal 512×512 (PNG, JPG, atau WebP, maks. 5 MB). Kalau tidak persegi, dipotong dari tengah. Ikon di HP yang sudah memasang undangan bisa butuh beberapa hari untuk ikut berubah.</p>
      `)}
      ${card("Check-in QR", "Tombol melayang yang muncul untuk tamu perorangan (link ber-?to=) berisi QR untuk dipindai petugas saat check-in di venue.", `
        ${switchRow("Tampilkan tombol QR check-in ke tamu", "st-qr-enabled", { hint: "Matikan kalau acara tidak memakai check-in QR di venue." })}
        <a class="p-btn p-btn--ghost" href="${escAttr(window.AdminAPI.tenant.path("admin-qr"))}" target="_blank" rel="noopener">Buka Check-in QR (petugas)</a>
      `)}
      ${card("Slideshow & audio", "Jeda pergantian slide hero, dan backsound yang diputar tamu.", `
        ${field("Jeda slideshow hero (ms)", "st-hero-interval", { type: "number" })}
        ${field("Audio — judul", "st-audio-title")}
        <label class="p-field">
          <span>Ganti backsound (MP3, M4A, WAV, OGG; maks. 15 MB)</span>
          <input class="p-input" type="file" id="st-audio-file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg">
        </label>
        <p class="p-hint" id="st-audio-status">${c.audio.path ? `Backsound tersimpan: ${esc(c.audio.path.split("/").pop())}` : "Belum ada backsound unggahan; file/URL lama tetap dipakai bila tersedia."}</p>
      `)}
    `;

    const set = (id, val) => { outlet.querySelector("#" + id).value = val ?? ""; };
    set("st-site-title", c.siteTitle);
    set("st-guest-param", c.guestParam);
    set("st-default-guest", c.defaultGuestName);
    set("st-hero-interval", c.heroSlideInterval);
    set("st-audio-title", c.audio.title);
    outlet.querySelector("#st-qr-enabled").checked = c.qrCheckin.enabled !== false;

    function markDirty() {
      window.PanelRouter.setDirty(true, onSave);
    }
    outlet.querySelectorAll(".p-input, .p-switch input").forEach((el) => el.addEventListener("input", markDirty));

    /* ── Ikon undangan ────────────────────────────────────────────────────
       Gambar dibangun jadi empat ukuran SAAT DIPILIH (kesalahan format/ukuran
       langsung terlihat, pratinjau akurat); diunggah baru saat Simpan. */
    let pendingIconSet = null;   // { "icon-192.png": Blob, ... } menunggu Simpan
    let resetIcon = false;       // kembali ke ikon bawaan saat Simpan
    let previewUrl = null;
    const iconStatus = outlet.querySelector("#st-icon-status");
    const iconPreview = outlet.querySelector("#st-icon-preview");
    const iconReset = outlet.querySelector("#st-icon-reset");

    outlet.querySelector("#st-icon-file").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      iconStatus.textContent = "Memproses gambar…";
      try {
        pendingIconSet = await window.PanelAppIcon.buildSet(file);
      } catch (err) {
        pendingIconSet = null;
        e.target.value = "";
        iconStatus.textContent = err.message;
        window.AdminAPI.toast(err.message, true);
        return;
      }
      resetIcon = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(pendingIconSet["icon-512.png"]);
      iconPreview.src = previewUrl;
      iconStatus.textContent = "Ikon baru siap. Tekan Simpan untuk memakainya.";
      iconReset.hidden = false;
      markDirty();
    });

    iconReset.addEventListener("click", () => {
      pendingIconSet = null;
      resetIcon = true;
      outlet.querySelector("#st-icon-file").value = "";
      iconPreview.src = "assets/icons/inv-192.png";
      iconStatus.textContent = "Akan kembali ke ikon bawaan. Tekan Simpan.";
      iconReset.hidden = true;
      markDirty();
    });

    async function onSave() {
      const grab = (id, path, type) => {
        const val = outlet.querySelector("#" + id).value.trim();
        window.PanelStore.set(path, type === "number" ? (Number(val) || 0) : val);
      };
      grab("st-site-title", "siteTitle");
      grab("st-guest-param", "guestParam");
      grab("st-default-guest", "defaultGuestName");
      grab("st-hero-interval", "heroSlideInterval", "number");
      grab("st-audio-title", "audio.title");
      window.PanelStore.set("qrCheckin.enabled", outlet.querySelector("#st-qr-enabled").checked);

      const fileInput = outlet.querySelector("#st-audio-file");
      const audioFile = fileInput.files && fileInput.files[0];
      if (audioFile) {
        const allowed = /\.(mp3|m4a|wav|ogg)$/i;
        if (!allowed.test(audioFile.name) || audioFile.size > 15 * 1024 * 1024) {
          window.AdminAPI.toast("Backsound harus MP3, M4A, WAV, atau OGG dengan ukuran maksimal 15 MB.", true);
          return false;
        }
        const ext = audioFile.name.split(".").pop().toLowerCase();
        const id = (window.crypto && typeof window.crypto.randomUUID === "function")
          ? window.crypto.randomUUID()
          : `a${Date.now()}${Math.random().toString(16).slice(2)}`;
        const audioPath = `${window.AdminAPI.tenant.slug}/audio/${id}.${ext}`;
        const { error: uploadError } = await window.AdminAPI.sb.storage.from("photos").upload(audioPath, audioFile, {
          contentType: audioFile.type || `audio/${ext}`, upsert: false
        });
        if (uploadError) {
          window.AdminAPI.toast("Upload backsound gagal: " + uploadError.message, true);
          return false;
        }
        window.PanelStore.set("audio.path", audioPath);
        window.PanelStore.set("audio.src", "");
      }

      if (pendingIconSet) {
        const up = await window.PanelAppIcon.upload(pendingIconSet);
        if (up.error) {
          window.AdminAPI.toast("Upload ikon gagal: " + up.error.message, true);
          return false;
        }
        window.PanelStore.set("appIcon", { path: up.path, version: up.version });
      } else if (resetIcon) {
        window.PanelStore.set("appIcon", null);
      }

      const { error } = await window.PanelStore.save(["siteTitle", "guestParam", "defaultGuestName", "heroSlideInterval", "audio", "qrCheckin", "appIcon"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast(audioFile ? "Backsound dan pengaturan tersimpan ✓" : "Tersimpan ✓");
      if (resetIcon) window.PanelAppIcon.removeAll();
      if (pendingIconSet || resetIcon) {
        const c2 = window.PanelStore.getContent();
        iconStatus.textContent = hasIcon(c2) ? "Ikon kamu sedang dipakai." : "Memakai ikon bawaan WillCome.";
        iconReset.hidden = !hasIcon(c2);
        pendingIconSet = null;
        resetIcon = false;
      }
      const status = outlet.querySelector("#st-audio-status");
      if (status && audioFile) status.textContent = `Backsound tersimpan: ${escAttr(audioFile.name)}`;
      return true;
    }
  },
  destroy() {}
};
