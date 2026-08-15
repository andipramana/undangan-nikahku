/** Hadiah — rekening, kontak WA konfirmasi, alamat kado, dan rekomendasi kado
 * (rekomendasi diedit langsung di kartu foto folder gift_item — foto ke-i
 * berpasangan dengan rekomendasi ke-i, sama seperti perilaku lama). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["hadiah"] = {
  title: "Hadiah",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("gift"),
  photoHandle: null,
  async mount(outlet) {
    const { field, textarea, card, escAttr } = window.PanelUI;
    const c = window.PanelStore.getContent();

    outlet.innerHTML =
      card("Rekening", "", `<div id="hd-accounts"></div>`) +
      card("Kontak WhatsApp konfirmasi", "Dituju tombol \"Konfirmasi Pengiriman\", dipilih otomatis dari field pemilik tiap rekening.", `
        <div class="p-grid-2">
          ${field("CPW — nomor WA (62…)", "hd-contact-cpw")}
          ${field("CPP — nomor WA (62…)", "hd-contact-cpp")}
        </div>
      `) +
      card("Alamat kado", "", `
        <div class="p-grid-2">
          ${field("Penerima", "hd-recipient")}
          ${field("Telepon", "hd-phone")}
        </div>
        ${field("Detail alamat", "hd-detail")}
        ${textarea("Template pesan konfirmasi kado", "hd-template", { rows: 3, placeholder: "Token: ${tamu} ${CPP} ${CPW} ${LABEL}. Kosongkan = pesan default." })}
      `) +
      card("Rekomendasi kado", "Nama, harga, dan link tiap rekomendasi diedit langsung pada kartu fotonya di bawah — foto ke-1 berpasangan dengan rekomendasi ke-1, dst.", `<div id="hd-gift-photos"></div>`);

    const set = (id, val) => { outlet.querySelector("#" + id).value = val ?? ""; };
    set("hd-contact-cpw", c.gift.contactCPW);
    set("hd-contact-cpp", c.gift.contactCPP);
    set("hd-recipient", c.gift.address.recipient);
    set("hd-phone", c.gift.address.phone);
    set("hd-detail", c.gift.address.detail);
    set("hd-template", c.gift.address.template);

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    function renderAccounts() {
      const box = outlet.querySelector("#hd-accounts");
      const items = c.gift.accounts;
      box.innerHTML = items.map((item, i) => `
        <div class="p-list-row" style="margin-bottom:.6rem">
          <div class="p-list-row__fields">
            <input type="text" class="p-input" data-i="${i}" data-k="bank" value="${escAttr(item.bank)}" placeholder="Bank">
            <input type="text" class="p-input" data-i="${i}" data-k="number" value="${escAttr(item.number)}" placeholder="Nomor rekening">
            <input type="text" class="p-input" data-i="${i}" data-k="holder" value="${escAttr(item.holder)}" placeholder="Atas nama">
            <select class="p-select" data-i="${i}" data-k="owner">
              <option value="">Tidak ikut</option>
              <option value="cpw" ${item.owner === "cpw" ? "selected" : ""}>CPW (wanita)</option>
              <option value="cpp" ${item.owner === "cpp" ? "selected" : ""}>CPP (pria)</option>
            </select>
            <label class="p-switch"><input type="checkbox" data-i="${i}" data-k="placeholder" ${item.placeholder ? "checked" : ""}><span>Sembunyikan nomor (placeholder)</span></label>
            <textarea class="p-textarea" data-i="${i}" data-k="template" rows="3" placeholder="Pesan WA kustom (kosongkan = default). Token: \${tamu} \${CPP} \${CPW} \${LABEL}">${escAttr(item.template)}</textarea>
          </div>
          <div class="p-list-row__controls">
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="1" ${i === items.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
          </div>
        </div>`).join("") + `<button type="button" class="p-btn p-btn--ghost" id="hd-add">+ tambah rekening</button>`;

      box.querySelectorAll("[data-i]").forEach((input) => {
        const write = () => {
          const item = items[Number(input.dataset.i)];
          item[input.dataset.k] = input.type === "checkbox" ? input.checked : input.value;
          markDirty();
        };
        input.addEventListener("input", write);
        input.addEventListener("change", write);
      });
      box.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const from = Number(btn.dataset.move), to = from + Number(btn.dataset.dir);
          if (to < 0 || to >= items.length) return;
          [items[from], items[to]] = [items[to], items[from]];
          markDirty(); renderAccounts();
        });
      });
      box.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => { items.splice(Number(btn.dataset.del), 1); markDirty(); renderAccounts(); });
      });
      box.querySelector("#hd-add").addEventListener("click", () => {
        items.push({ bank: "", number: "", holder: "", owner: "", placeholder: false, template: "" });
        markDirty(); renderAccounts();
      });
    }
    renderAccounts();

    this.photoHandle = window.PanelPhotos.mount(outlet.querySelector("#hd-gift-photos"), "gift_item");

    async function onSave() {
      window.PanelStore.set("gift.accounts", c.gift.accounts);
      window.PanelStore.set("gift.contactCPW", outlet.querySelector("#hd-contact-cpw").value.trim());
      window.PanelStore.set("gift.contactCPP", outlet.querySelector("#hd-contact-cpp").value.trim());
      window.PanelStore.set("gift.address.recipient", outlet.querySelector("#hd-recipient").value.trim());
      window.PanelStore.set("gift.address.phone", outlet.querySelector("#hd-phone").value.trim());
      window.PanelStore.set("gift.address.detail", outlet.querySelector("#hd-detail").value.trim());
      window.PanelStore.set("gift.address.template", outlet.querySelector("#hd-template").value.trim());
      const { error } = await window.PanelStore.save(["gift"]);
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
