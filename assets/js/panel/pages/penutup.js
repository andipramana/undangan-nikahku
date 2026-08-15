/** Penutup — teks closing statement default (fallback untuk tamu yang tidak
 * cocok kelompok sapaan mana pun — lihat halaman Sapaan Tamu untuk closing
 * per kelompok) + foto closing. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["penutup"] = {
  title: "Penutup",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("flag"),
  photoHandle: null,
  async mount(outlet) {
    const { textarea, card } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Closing statement default", "Dipakai untuk tamu yang tidak cocok dengan kelompok sapaan mana pun. Token: ${tamu} ${CPP} ${CPW}.", `
        ${textarea("Teks penutup", "pn-text", { rows: 4 })}
      `) +
      card("Foto penutup", "", `<div id="pn-photos"></div>`);

    outlet.querySelector("#pn-text").value = c.closing.text || "";

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    this.photoHandle = window.PanelPhotos.mount(outlet.querySelector("#pn-photos"), "closing");

    async function onSave() {
      window.PanelStore.set("closing.text", outlet.querySelector("#pn-text").value.trim());
      const { error } = await window.PanelStore.save(["closing"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast("Tersimpan ✓");
      return true;
    }
  },
  destroy() {
    if (this.photoHandle) this.photoHandle.destroy();
    this.photoHandle = null;
  }
};
