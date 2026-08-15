/** Sapaan Tamu — sapaan default + kelompok sapaan (label, daftar nama, closing
 * statement khusus kelompok). Nama tamu dicocokkan PERSIS (abaikan besar
 * kecil huruf) terhadap daftar nama tiap kelompok. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["sapaan"] = {
  title: "Sapaan Tamu",
  group: "Tamu",
  icon: window.PanelUI.icon("users"),
  async mount(outlet) {
    const { field, textarea, card, escAttr } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Default (fallback)", "Dipakai untuk tamu yang tidak cocok dengan kelompok mana pun. Closing statement default diatur di halaman Penutup.", `
        ${field("Sapaan default", "sp-default-greeting")}
      `) +
      card("Kelompok sapaan", "Token di closing tiap kelompok: ${tamu} nama tamu, ${CPP} panggilan mempelai pria, ${CPW} panggilan mempelai wanita. Kosongkan closing kelompok untuk memakai closing default (halaman Penutup).", `<div id="sp-groups"></div>`);

    outlet.querySelector("#sp-default-greeting").value = c.defaultGuestGreeting || "";

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    function renderGroups() {
      const box = outlet.querySelector("#sp-groups");
      const groups = c.guestGreetings;
      box.innerHTML = groups.map((g, gi) => `
        <div class="p-list-row" style="margin-bottom:.6rem">
          <div class="p-list-row__fields">
            <input type="text" class="p-input" data-g="${gi}" data-k="label" value="${escAttr(g.label)}" placeholder="Sapaan kelompok, mis. Keluarga Besar">
            <textarea class="p-textarea" data-g="${gi}" data-k="closing" rows="2" placeholder="Closing khusus kelompok ini (kosongkan = default)">${escAttr(g.closing)}</textarea>
            <div class="p-field"><span>Nama tamu</span>
              <div class="p-grid-2" style="gap:.4rem">
                ${g.names.map((n, ni) => `
                  <span style="display:flex;gap:.3rem;align-items:center">
                    <input type="text" class="p-input" data-g="${gi}" data-name-i="${ni}" value="${escAttr(n)}" placeholder="Nama tamu (persis seperti di URL)">
                    <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-name-del="${gi}:${ni}" aria-label="Hapus nama">&times;</button>
                  </span>`).join("")}
              </div>
              <button type="button" class="p-btn p-btn--ghost p-btn--tiny" data-add-name="${gi}">+ nama</button>
            </div>
          </div>
          <div class="p-list-row__controls">
            <button type="button" class="p-btn p-btn--tiny" data-move="${gi}" data-dir="-1" ${gi === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${gi}" data-dir="1" ${gi === groups.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del-group="${gi}" aria-label="Hapus grup">&times;</button>
          </div>
        </div>`).join("") + `<button type="button" class="p-btn p-btn--ghost" id="sp-add-group">+ tambah grup sapaan</button>`;

      box.querySelectorAll("[data-k]").forEach((input) => {
        input.addEventListener("input", () => { groups[Number(input.dataset.g)][input.dataset.k] = input.value; markDirty(); });
      });
      box.querySelectorAll("[data-name-i]").forEach((input) => {
        input.addEventListener("input", () => { groups[Number(input.dataset.g)].names[Number(input.dataset.nameI)] = input.value; markDirty(); });
      });
      box.querySelectorAll("[data-add-name]").forEach((btn) => {
        btn.addEventListener("click", () => { groups[Number(btn.dataset.addName)].names.push(""); markDirty(); renderGroups(); });
      });
      box.querySelectorAll("[data-name-del]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const [gi, ni] = btn.dataset.nameDel.split(":").map(Number);
          groups[gi].names.splice(ni, 1); markDirty(); renderGroups();
        });
      });
      box.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const from = Number(btn.dataset.move), to = from + Number(btn.dataset.dir);
          if (to < 0 || to >= groups.length) return;
          [groups[from], groups[to]] = [groups[to], groups[from]];
          markDirty(); renderGroups();
        });
      });
      box.querySelectorAll("[data-del-group]").forEach((btn) => {
        btn.addEventListener("click", () => { groups.splice(Number(btn.dataset.delGroup), 1); markDirty(); renderGroups(); });
      });
      box.querySelector("#sp-add-group").addEventListener("click", () => {
        groups.push({ label: "", names: [], closing: "" });
        markDirty(); renderGroups();
      });
    }
    renderGroups();

    async function onSave() {
      window.PanelStore.set("defaultGuestGreeting", outlet.querySelector("#sp-default-greeting").value.trim());
      window.PanelStore.set("guestGreetings", c.guestGreetings);
      const { error } = await window.PanelStore.save(["defaultGuestGreeting", "guestGreetings"]);
      if (error) { window.AdminAPI.toast("Gagal menyimpan: " + error.message, true); return false; }
      window.AdminAPI.toast("Tersimpan ✓");
      return true;
    }
  },
  destroy() {}
};
