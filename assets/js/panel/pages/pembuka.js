/** Pembuka & Ayat — Save the Date + ayat pembuka. Folder "opening" dipakai
 * hero Save the Date; "std2" foto statis Save the Date 2. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["pembuka"] = {
  title: "Pembuka & Ayat",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("quote"),
  photoHandles: [],
  async mount(outlet) {
    const { field, textarea, card } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Ayat pembuka", "Ditampilkan di section Save the Date.", `
        ${textarea("Bismillah (arab)", "pb-arabic", { rows: 2 })}
        ${textarea("Terjemahan", "pb-quote", { rows: 4 })}
        ${field("Sumber (QS …)", "pb-source")}
      `) +
      card("Foto Save the Date", "Folder \"opening\" (hero) dan \"std2\" (foto statis Save the Date 2).", `
        <div class="p-field"><span>Foto opening</span><div id="pb-opening-photos"></div></div>
        <div class="p-field"><span>Foto Save the Date 2</span><div id="pb-std2-photos"></div></div>
      `);

    outlet.querySelector("#pb-arabic").value = c.opening.arabicQuote || "";
    outlet.querySelector("#pb-quote").value = c.opening.quote || "";
    outlet.querySelector("#pb-source").value = c.opening.source || "";

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    this.photoHandles = [
      window.PanelPhotos.mount(outlet.querySelector("#pb-opening-photos"), "opening"),
      window.PanelPhotos.mount(outlet.querySelector("#pb-std2-photos"), "std2")
    ];

    async function onSave() {
      window.PanelStore.set("opening.arabicQuote", outlet.querySelector("#pb-arabic").value.trim());
      window.PanelStore.set("opening.quote", outlet.querySelector("#pb-quote").value.trim());
      window.PanelStore.set("opening.source", outlet.querySelector("#pb-source").value.trim());
      const { error } = await window.PanelStore.save(["opening"]);
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
