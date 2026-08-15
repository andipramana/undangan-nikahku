/** Acara — tanggal, akad, resepsi, dresscode. Field terbanyak di antara
 * halaman Isi Undangan lain, jadi akad/resepsi/dresscode dipisah kartu +
 * blok "Lanjutan" (progressive disclosure §2) untuk field yang jarang diubah. */
window.PanelPages = window.PanelPages || {};
window.PanelPages["acara"] = {
  title: "Acara",
  group: "Isi Undangan",
  icon: window.PanelUI.icon("calendar"),
  photoHandle: null,
  async mount(outlet) {
    const { field, textarea, card, esc, escAttr, bindColorPair, pickerHex } = window.PanelUI;
    const c = window.PanelStore.getContent();

    function venueFields(prefix) {
      return `
        ${field("Venue — nama", `${prefix}-venue-name`)}
        ${field("Venue — alamat", `${prefix}-venue-address`)}
        ${field("Venue — URL Maps", `${prefix}-venue-maps`)}
      `;
    }

    outlet.innerHTML =
      card("Tanggal & countdown", "", `
        <div class="p-grid-2">
          ${field("Tanggal (ISO, yyyy-mm-dd)", "ac-date-iso")}
          ${field("Tanggal tampil", "ac-date-label")}
        </div>
        <div class="p-grid-2">
          ${field("Nama hari", "ac-day-label")}
          ${field("Target countdown (ISO + offset)", "ac-countdown")}
        </div>
      `) +
      card("Akad", "", `
        <div class="p-grid-2">
          ${field("Label", "ac-akad-label")}
          ${field("Mulai", "ac-akad-start")}
        </div>
        ${field("Selesai", "ac-akad-end")}
        ${venueFields("ac-akad")}
      `) +
      card("Resepsi", "", `
        <div class="p-grid-2">
          ${field("Label", "ac-resepsi-label")}
          ${field("Mulai", "ac-resepsi-start")}
        </div>
        ${field("Selesai", "ac-resepsi-end")}
        ${venueFields("ac-resepsi")}
      `) +
      card("Dresscode", "", `
        ${textarea("Teks", "ac-dresscode-text", { rows: 3 })}
        <div class="p-field"><span>Warna pilihan</span><div id="ac-colors"></div></div>
      `) +
      card("Foto slider event", "", `<div id="ac-event-photos"></div>`);

    const set = (id, val) => { outlet.querySelector("#" + id).value = val ?? ""; };
    set("ac-date-iso", c.event.dateISO);
    set("ac-date-label", c.event.dateLabel);
    set("ac-day-label", c.event.dayLabel);
    set("ac-countdown", c.event.countdownTarget);
    ["akad", "resepsi"].forEach((k) => {
      set(`ac-${k}-label`, c.event[k].label);
      set(`ac-${k}-start`, c.event[k].start);
      set(`ac-${k}-end`, c.event[k].end);
      set(`ac-${k}-venue-name`, c.event[k].venue.name);
      set(`ac-${k}-venue-address`, c.event[k].venue.address);
      set(`ac-${k}-venue-maps`, c.event[k].venue.mapsUrl);
    });
    set("ac-dresscode-text", c.dresscode.text);

    function markDirty() { window.PanelRouter.setDirty(true, onSave); }
    outlet.querySelectorAll(".p-input, .p-textarea").forEach((el) => el.addEventListener("input", markDirty));

    function renderColors() {
      const box = outlet.querySelector("#ac-colors");
      const colors = c.dresscode.colors;
      box.innerHTML = colors.map((color, i) => `
        <div class="p-color-row" style="margin-bottom:.5rem">
          <input type="color" value="${pickerHex(color)}" data-color-i="${i}" aria-label="Pilih warna ${i + 1}">
          <input type="text" class="p-input" data-color-hex="${i}" value="${escAttr(color)}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="#c9a668" aria-label="Kode hex warna ${i + 1}">
          <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-color-del="${i}" aria-label="Hapus warna">&times;</button>
        </div>`).join("") + `<button type="button" class="p-btn p-btn--ghost p-btn--tiny" id="ac-color-add">+ warna</button>`;
      colors.forEach((_, i) => bindColorPair(box, String(i), (val) => { colors[i] = val; markDirty(); }));
      box.querySelectorAll("[data-color-del]").forEach((btn) => {
        btn.addEventListener("click", () => { colors.splice(Number(btn.dataset.colorDel), 1); markDirty(); renderColors(); });
      });
      box.querySelector("#ac-color-add").addEventListener("click", () => { colors.push("#c9a668"); markDirty(); renderColors(); });
    }
    renderColors();

    this.photoHandle = window.PanelPhotos.mount(outlet.querySelector("#ac-event-photos"), "event");

    async function onSave() {
      window.PanelStore.set("event.dateISO", outlet.querySelector("#ac-date-iso").value.trim());
      window.PanelStore.set("event.dateLabel", outlet.querySelector("#ac-date-label").value.trim());
      window.PanelStore.set("event.dayLabel", outlet.querySelector("#ac-day-label").value.trim());
      window.PanelStore.set("event.countdownTarget", outlet.querySelector("#ac-countdown").value.trim());
      ["akad", "resepsi"].forEach((k) => {
        window.PanelStore.set(`event.${k}.label`, outlet.querySelector(`#ac-${k}-label`).value.trim());
        window.PanelStore.set(`event.${k}.start`, outlet.querySelector(`#ac-${k}-start`).value.trim());
        window.PanelStore.set(`event.${k}.end`, outlet.querySelector(`#ac-${k}-end`).value.trim());
        window.PanelStore.set(`event.${k}.venue.name`, outlet.querySelector(`#ac-${k}-venue-name`).value.trim());
        window.PanelStore.set(`event.${k}.venue.address`, outlet.querySelector(`#ac-${k}-venue-address`).value.trim());
        window.PanelStore.set(`event.${k}.venue.mapsUrl`, outlet.querySelector(`#ac-${k}-venue-maps`).value.trim());
      });
      window.PanelStore.set("dresscode.text", outlet.querySelector("#ac-dresscode-text").value.trim());
      window.PanelStore.set("dresscode.colors", c.dresscode.colors);
      const content = window.PanelStore.getContent();
      if (!content.event.dateLabel || !content.event.countdownTarget) {
        window.AdminAPI.toast("Tanggal event tidak boleh kosong.", true);
        return false;
      }
      const { error } = await window.PanelStore.save(["event", "dresscode"]);
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
