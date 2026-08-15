/** Cerita Kami — Love Story, daftar babak berurut + foto folder "story". */
window.PanelPages = window.PanelPages || {};
window.PanelPages["cerita"] = {
  title: "Cerita Kami",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("story"),
  photoHandle: null,
  async mount(outlet) {
    const { card, esc, escAttr } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Love Story", "Tiap babak tampil berurutan sebagai garis waktu.", `<div id="cr-list"></div>`) +
      card("Foto Our Story", "", `<div id="cr-photos"></div>`);

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }

    function renderList() {
      const box = outlet.querySelector("#cr-list");
      const items = c.loveStory;
      box.innerHTML = items.map((item, i) => `
        <div class="p-list-row" style="margin-bottom:.6rem">
          <div class="p-list-row__fields">
            <input type="text" class="p-input" data-i="${i}" data-k="date" value="${escAttr(item.date)}" placeholder="Tahun">
            <input type="text" class="p-input" data-i="${i}" data-k="title" value="${escAttr(item.title)}" placeholder="Judul babak">
            <textarea class="p-textarea" data-i="${i}" data-k="text" rows="4" placeholder="Cerita…">${escAttr(item.text)}</textarea>
          </div>
          <div class="p-list-row__controls">
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="1" ${i === items.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
          </div>
        </div>`).join("") + `<button type="button" class="p-btn p-btn--ghost" id="cr-add">+ tambah babak</button>`;

      box.querySelectorAll("[data-i]").forEach((input) => {
        const write = () => { items[Number(input.dataset.i)][input.dataset.k] = input.value; markDirty(); };
        input.addEventListener("input", write);
      });
      box.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const from = Number(btn.dataset.move), to = from + Number(btn.dataset.dir);
          if (to < 0 || to >= items.length) return;
          [items[from], items[to]] = [items[to], items[from]];
          markDirty(); renderList();
        });
      });
      box.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => { items.splice(Number(btn.dataset.del), 1); markDirty(); renderList(); });
      });
      box.querySelector("#cr-add").addEventListener("click", () => {
        items.push({ date: "", title: "", text: "" });
        markDirty(); renderList();
      });
    }
    renderList();

    this.photoHandle = window.PanelPhotos.mount(outlet.querySelector("#cr-photos"), "story");

    async function onSave() {
      window.PanelStore.set("loveStory", c.loveStory);
      const { error } = await window.PanelStore.save(["loveStory"]);
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
