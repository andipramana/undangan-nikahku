/** Mempelai — teks & foto BERSATU dalam satu halaman (bukti utama alasan v2
 * ada: dulu admin harus bolak-balik tab Teks/Foto untuk satu bagian). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["mempelai"] = {
  title: "Mempelai",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("heart"),
  photoHandles: [],
  async mount(outlet) {
    const { field, card } = window.PanelUI;
    const c = window.PanelStore.getContent();

    function personCard(label, key, folder) {
      return card(label, "", `
        <div class="p-grid-2">
          ${field("Nama lengkap", `mp-${key}-name`)}
          ${field("Panggilan", `mp-${key}-nickname`)}
        </div>
        ${field("Instagram (opsional)", `mp-${key}-instagram`)}
        <div class="p-grid-2">
          ${field("Nama ayah", `mp-${key}-father`)}
          ${field("Nama ibu", `mp-${key}-mother`)}
        </div>
        <div class="p-field"><span>Foto ${label.toLowerCase()}</span><div id="mp-${key}-photos"></div></div>
      `);
    }

    outlet.innerHTML = personCard("Mempelai wanita", "bride", "bride") + personCard("Mempelai pria", "groom", "groom");

    const set = (id, val) => { outlet.querySelector("#" + id).value = val ?? ""; };
    ["bride", "groom"].forEach((key) => {
      set(`mp-${key}-name`, c.couple[key].name);
      set(`mp-${key}-nickname`, c.couple[key].nickname);
      set(`mp-${key}-instagram`, c.couple[key].instagram);
      set(`mp-${key}-father`, c.couple[key].father);
      set(`mp-${key}-mother`, c.couple[key].mother);
    });

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input").forEach((el) => el.addEventListener("input", markDirty));

    this.photoHandles = [
      window.PanelPhotos.mount(outlet.querySelector("#mp-bride-photos"), "bride"),
      window.PanelPhotos.mount(outlet.querySelector("#mp-groom-photos"), "groom")
    ];

    async function onSave() {
      ["bride", "groom"].forEach((key) => {
        window.PanelStore.set(`couple.${key}.name`, outlet.querySelector(`#mp-${key}-name`).value.trim());
        window.PanelStore.set(`couple.${key}.nickname`, outlet.querySelector(`#mp-${key}-nickname`).value.trim());
        window.PanelStore.set(`couple.${key}.instagram`, outlet.querySelector(`#mp-${key}-instagram`).value.trim());
        window.PanelStore.set(`couple.${key}.father`, outlet.querySelector(`#mp-${key}-father`).value.trim());
        window.PanelStore.set(`couple.${key}.mother`, outlet.querySelector(`#mp-${key}-mother`).value.trim());
      });
      const content = window.PanelStore.getContent();
      if (!content.couple.bride.name || !content.couple.groom.name) {
        window.AdminAPI.toast("Nama mempelai tidak boleh kosong.", true);
        return false;
      }
      const { error } = await window.PanelStore.save(["couple"]);
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
