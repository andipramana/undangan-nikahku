/** Pengaturan Undangan — identitas situs, slideshow, backsound. Halaman paling
 * sederhana dari 18 halaman non-Beranda; juga jadi pembuktian pertama siklus
 * simpan lewat store.js (Fase 2 rencana v2). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["pengaturan"] = {
  title: "Pengaturan Undangan",
  group: "Pengaturan",
  icon: window.PanelUI.icon("settings"),
  async mount(outlet) {
    const { field, textarea, card, esc, escAttr } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML = `
      ${card("Umum", "Identitas dasar situs undangan.", `
        ${field("Judul situs", "st-site-title")}
        ${field("Parameter nama tamu (URL)", "st-guest-param")}
        ${field("Nama tamu default", "st-default-guest")}
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

    function markDirty() {
      window.PanelRouter.setDirty(true, onSave);
    }
    outlet.querySelectorAll(".p-input").forEach((el) => el.addEventListener("input", markDirty));

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

      const { error } = await window.PanelStore.save(["siteTitle", "guestParam", "defaultGuestName", "heroSlideInterval", "audio"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast(audioFile ? "Backsound dan pengaturan tersimpan ✓" : "Tersimpan ✓");
      const status = outlet.querySelector("#st-audio-status");
      if (status && audioFile) status.textContent = `Backsound tersimpan: ${escAttr(audioFile.name)}`;
      return true;
    }
  },
  destroy() {}
};
