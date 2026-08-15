/** Cover & Sampul — foto cover (hero pertama tamu lihat) + section Subcover
 * (quotes layar penuh antara cover dan Save The Date). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["cover"] = {
  title: "Cover & Sampul",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("image"),
  photoHandles: [],
  async mount(outlet) {
    const { field, card, switchRow } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Cover", "Foto layar penuh pertama yang dilihat tamu.", `<div id="cv-cover-photos"></div>`) +
      card("Subcover", "Quotes layar penuh antara Cover dan Save The Date. Kosongkan baris mana pun untuk menyembunyikannya.", `
        ${switchRow("Tampilkan section Subcover", "cv-sub-enabled")}
        ${field("Quote baris 1", "cv-sub-quote1")}
        ${field("Quote baris 2", "cv-sub-quote2")}
        <div class="p-field"><span>Foto subcover</span><div id="cv-sub-photos"></div></div>
      `);

    outlet.querySelector("#cv-sub-quote1").value = c.subcover.quoteLine1 || "";
    outlet.querySelector("#cv-sub-quote2").value = c.subcover.quoteLine2 || "";
    outlet.querySelector("#cv-sub-enabled").checked = c.subcover.enabled !== false;

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-switch input").forEach((el) => el.addEventListener("input", markDirty));

    this.photoHandles = [
      window.PanelPhotos.mount(outlet.querySelector("#cv-cover-photos"), "cover"),
      window.PanelPhotos.mount(outlet.querySelector("#cv-sub-photos"), "subcover")
    ];

    async function onSave() {
      window.PanelStore.set("subcover.enabled", outlet.querySelector("#cv-sub-enabled").checked);
      window.PanelStore.set("subcover.quoteLine1", outlet.querySelector("#cv-sub-quote1").value.trim());
      window.PanelStore.set("subcover.quoteLine2", outlet.querySelector("#cv-sub-quote2").value.trim());
      const { error } = await window.PanelStore.save(["subcover"]);
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
