/** Galeri — foto galeri utama, video galeri (YouTube), dan foto quote 1:1
 * dengan kutipannya sendiri. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["galeri"] = {
  title: "Galeri",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("image"),
  photoHandles: [],
  async mount(outlet) {
    const { field, textarea, card } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Video galeri", "Kosongkan untuk menyembunyikan thumbnail video di atas foto galeri.", `
        ${field("Video galeri (YouTube URL)", "gl-video", { type: "url" })}
      `) +
      card("Foto galeri", "", `<div id="gl-gallery-photos"></div>`) +
      card("Quote foto", "Foto 1:1 dengan kutipan di atasnya.", `
        ${textarea("Teks quote", "gl-quote-text", { rows: 3 })}
        <div class="p-field"><span>Foto quote</span><div id="gl-quote-photos"></div></div>
      `);

    outlet.querySelector("#gl-video").value = c.galleryVideo.youtube || "";
    outlet.querySelector("#gl-quote-text").value = c.quotePhoto.quote || "";

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    this.photoHandles = [
      window.PanelPhotos.mount(outlet.querySelector("#gl-gallery-photos"), "gallery"),
      window.PanelPhotos.mount(outlet.querySelector("#gl-quote-photos"), "quote")
    ];

    async function onSave() {
      window.PanelStore.set("galleryVideo.youtube", outlet.querySelector("#gl-video").value.trim());
      window.PanelStore.set("quotePhoto.quote", outlet.querySelector("#gl-quote-text").value.trim());
      const { error } = await window.PanelStore.save(["galleryVideo", "quotePhoto"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast("Tersimpan ✓");
      return true;
    }
  },
  destroy() {
    (this.photoHandles || []).forEach((h) => h.destroy());
    this.photoHandles = [];
  }
};
