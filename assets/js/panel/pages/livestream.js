/** Live Streaming — link YouTube/Instagram/TikTok. Petugas check-in juga bisa
 * mengubah field ini dari admin-qr.html (peran admin_qr, dibiarkan terpisah,
 * lewat AdminShared.saveLivestream — bukan store.js ini). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["livestream"] = {
  title: "Live Streaming",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("video"),
  async mount(outlet) {
    const { field, card } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML = card("Link siaran langsung", "URL kosong = platform itu tidak ditampilkan; kosongkan semuanya untuk menyembunyikan section Live Streaming di undangan.", `
      ${field("YouTube", "ls-youtube", { type: "url" })}
      ${field("Instagram", "ls-instagram", { type: "url" })}
      ${field("TikTok", "ls-tiktok", { type: "url" })}
    `);

    outlet.querySelector("#ls-youtube").value = c.livestream.youtube || "";
    outlet.querySelector("#ls-instagram").value = c.livestream.instagram || "";
    outlet.querySelector("#ls-tiktok").value = c.livestream.tiktok || "";

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input").forEach((el) => el.addEventListener("input", markDirty));

    async function onSave() {
      window.PanelStore.set("livestream.youtube", outlet.querySelector("#ls-youtube").value.trim());
      window.PanelStore.set("livestream.instagram", outlet.querySelector("#ls-instagram").value.trim());
      window.PanelStore.set("livestream.tiktok", outlet.querySelector("#ls-tiktok").value.trim());
      const { error } = await window.PanelStore.save(["livestream"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast("Tersimpan ✓");
      return true;
    }
  },
  destroy() {}
};
