/** Pengaturan Undangan — identitas situs, slideshow, backsound. Halaman paling
 * sederhana dari 18 halaman non-Beranda; juga jadi pembuktian pertama siklus
 * simpan lewat store.js (Fase 2 rencana v2). */
window.PanelPages = window.PanelPages || {};
/** Ikon undangan tersimpan di content.appIcon = { path, version, source, letters, custom }.
 *  source "auto"   = monogram dari huruf depan nama CPP+CPW (dibuat sistem / hurufnya diubah client)
 *  source "upload" = gambar unggahan client */
function hasIcon(c) { return !!(c.appIcon && c.appIcon.path && c.appIcon.version); }
function iconUrl(c) {
  return hasIcon(c)
    ? `${window.AdminAPI.photoUrl(c.appIcon.path + "/icon-192.png")}?v=${encodeURIComponent(c.appIcon.version)}`
    : "assets/icons/inv-192.png";
}
function iconStatusText(c, derived) {
  if (hasIcon(c) && c.appIcon.source === "upload") return "Ikon unggahanmu sedang dipakai.";
  if (hasIcon(c)) return `Ikon dibuat dari huruf ${c.appIcon.letters || ""}${c.appIcon.custom ? " (diatur manual)" : " (otomatis dari nama)"}.`;
  return derived ? "Belum disimpan. Tekan Simpan untuk memakai ikon dari huruf di atas."
    : "Memakai ikon bawaan WillCome. Isi nama CPP dan CPW di bab Mempelai untuk membuat ikon dari huruf depan nama.";
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
      ${card("Ikon undangan", "Gambar kecil di tab browser dan di layar utama HP tamu saat undangan dipasang. Bawaannya huruf depan nama CPP dan CPW.", `
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <img id="st-icon-preview" src="${escAttr(iconUrl(c))}" alt="Ikon undangan" width="96" height="96"
               style="width:96px;height:96px;border-radius:22px;border:1px solid var(--p-hairline);object-fit:cover;background:var(--p-sunken)">
          <div style="display:grid;gap:10px;justify-items:start">
            <div style="display:flex;gap:10px;align-items:end">
              <label class="p-field" style="width:84px"><span>Huruf CPP</span>
                <input class="p-input" id="st-icon-l1" maxlength="1" autocomplete="off" style="text-align:center;text-transform:uppercase"></label>
              <label class="p-field" style="width:84px"><span>Huruf CPW</span>
                <input class="p-input" id="st-icon-l2" maxlength="1" autocomplete="off" style="text-align:center;text-transform:uppercase"></label>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="p-btn p-btn--ghost p-btn--tiny" for="st-icon-file" style="cursor:pointer">Unggah ikon sendiri</label>
              <input type="file" id="st-icon-file" accept="image/png,image/jpeg,image/webp" hidden>
              <button type="button" class="p-btn p-btn--ghost p-btn--tiny" id="st-icon-reset">Kembali ke otomatis</button>
            </div>
          </div>
        </div>
        <p class="p-hint" id="st-icon-status"></p>
        <p class="p-hint">Untuk ikon unggahan: gambar persegi, minimal 512×512 (PNG, JPG, atau WebP, maks. 5 MB); kalau tidak persegi, dipotong dari tengah. Ikon di HP yang sudah memasang undangan bisa butuh beberapa hari untuk ikut berubah.</p>
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
       Dua jalan, hasil akhirnya sama (empat berkas di Storage + content.appIcon):
       huruf CPP/CPW → monogram dari templat SVG, atau gambar unggahan client.
       Dibangun SAAT DIPILIH/DIKETIK (kesalahan langsung terlihat, pratinjau
       akurat); diunggah baru saat Simpan. */
    const derived = window.PanelAppIcon.deriveLetters(c);        // mis. "AM"
    const savedLetters = c.appIcon && c.appIcon.source === "auto" ? c.appIcon.letters : null;
    let pendingIconSet = null;   // { "icon-192.png": Blob, ... } menunggu Simpan
    let pendingMeta = null;      // { source, letters?, custom? } untuk content.appIcon
    let removeIcon = false;      // tak ada huruf yang bisa diturunkan: kembali ke ikon netral
    let previewUrl = null;
    const iconStatus = outlet.querySelector("#st-icon-status");
    const iconPreview = outlet.querySelector("#st-icon-preview");
    const l1 = outlet.querySelector("#st-icon-l1");
    const l2 = outlet.querySelector("#st-icon-l2");
    const iconFile = outlet.querySelector("#st-icon-file");
    const iconReset = outlet.querySelector("#st-icon-reset");

    const shown = (savedLetters || derived || "");
    l1.value = shown.charAt(0);
    l2.value = shown.charAt(1);
    iconStatus.textContent = iconStatusText(c, derived);
    const refreshResetVisibility = (cc) => {
      const ai = cc.appIcon;
      iconReset.hidden = !(ai && (ai.source === "upload" || ai.custom)) && !pendingMeta;
    };
    refreshResetVisibility(c);

    function showPreview(set) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(set["icon-512.png"]);
      iconPreview.src = previewUrl;
    }

    /** Bangun monogram dari dua kolom huruf; true bila valid. */
    async function applyLetters(custom) {
      const a = window.PanelAppIcon.firstLetter(l1.value);
      const b = window.PanelAppIcon.firstLetter(l2.value);
      if (!a || !b) { iconStatus.textContent = "Isi satu huruf untuk CPP dan satu huruf untuk CPW."; return false; }
      l1.value = a; l2.value = b;
      try {
        pendingIconSet = await window.PanelAppIcon.buildMonogramSet(a + b);
      } catch (err) {
        pendingIconSet = null;
        iconStatus.textContent = err.message;
        window.AdminAPI.toast(err.message, true);
        return false;
      }
      pendingMeta = { source: "auto", letters: a + b, custom: custom && (a + b) !== derived };
      removeIcon = false;
      showPreview(pendingIconSet);
      iconStatus.textContent = "Ikon baru siap. Tekan Simpan untuk memakainya.";
      iconReset.hidden = false;
      markDirty();
      return true;
    }
    [l1, l2].forEach((el) => el.addEventListener("input", () => { if (el.value) applyLetters(true); }));

    iconFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      iconStatus.textContent = "Memproses gambar…";
      try {
        pendingIconSet = await window.PanelAppIcon.buildSet(file);
      } catch (err) {
        pendingIconSet = null;
        pendingMeta = null;
        e.target.value = "";
        iconStatus.textContent = err.message;
        window.AdminAPI.toast(err.message, true);
        return;
      }
      pendingMeta = { source: "upload" };
      removeIcon = false;
      showPreview(pendingIconSet);
      iconStatus.textContent = "Ikon unggahan siap. Tekan Simpan untuk memakainya.";
      iconReset.hidden = false;
      markDirty();
    });

    iconReset.addEventListener("click", async () => {
      iconFile.value = "";
      if (derived) {
        l1.value = derived.charAt(0);
        l2.value = derived.charAt(1);
        if (await applyLetters(false)) iconStatus.textContent = "Kembali ke otomatis dari nama. Tekan Simpan.";
      } else {
        pendingIconSet = null; pendingMeta = null; removeIcon = true;
        iconPreview.src = "assets/icons/inv-192.png";
        iconStatus.textContent = "Akan kembali ke ikon bawaan. Tekan Simpan.";
        iconReset.hidden = true;
        markDirty();
      }
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
        window.PanelStore.set("appIcon", { path: up.path, version: up.version, ...pendingMeta });
      } else if (removeIcon) {
        window.PanelStore.set("appIcon", null);
      }

      const { error } = await window.PanelStore.save(["siteTitle", "guestParam", "defaultGuestName", "heroSlideInterval", "audio", "qrCheckin", "appIcon"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast(audioFile ? "Backsound dan pengaturan tersimpan ✓" : "Tersimpan ✓");
      if (removeIcon) window.PanelAppIcon.removeAll();
      if (pendingIconSet || removeIcon) {
        const c2 = window.PanelStore.getContent();
        iconStatus.textContent = iconStatusText(c2, derived);
        pendingIconSet = null;
        pendingMeta = null;
        removeIcon = false;
        refreshResetVisibility(c2);
      }
      return true;
    }
  },
  destroy() {}
};
