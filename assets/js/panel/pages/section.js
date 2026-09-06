/** Renderer bab generik — membangun satu halaman editor dari skema template.
 *
 * Menggantikan sembilan halaman bab yang dulu ditulis tangan (cover.js,
 * pembuka.js, mempelai.js, acara.js, livestream.js, cerita.js, galeri.js,
 * hadiah.js, penutup.js). Kesembilannya mengerjakan hal yang sama persis —
 * susun field, isi dari content, tandai kotor, simpan beberapa top-level key —
 * dan yang membedakannya cuma DAFTAR field & foto. Daftar itu sekarang tinggal
 * di templates/<id>/template.json, sehingga bab yang muncul di admin mengikuti
 * template yang sedang dipakai: Nocturne tidak punya subcover atau quote foto,
 * jadi field-nya memang tidak ada — bukan ditampilkan lalu diam-diam diabaikan.
 *
 * Bentuk satu section (lihat docs/kontrak-template.md):
 *   { key, label, icon,
 *     fields: [ { path, type, label, card?, cardDesc?, rows?, placeholder?,
 *                 required?, options?, item?, addLabel?, newItem? } ],
 *     photos: [ { slot, label, card?, ... } ] }
 *
 * `card` mengelompokkan field ke kartu bernama (urutan kemunculan pertama =
 * urutan kartu). Tanpa `card`, semuanya masuk satu kartu berjudul label
 * section. Foto boleh menumpang kartu yang sama dengan field lewat `card`
 * yang sama — itulah cara halaman Mempelai menaruh foto tepat di bawah data
 * orangnya, bukan terlempar ke kartu terpisah di bawah.
 */
(function () {
  const { field, textarea, switchRow, card, esc, escAttr, pickerHex, bindColorPair } = window.PanelUI;

  const FIELD_ID = (path) => "sf-" + String(path).replace(/[^a-zA-Z0-9]+/g, "-");
  /** Key top-level site_content yang disentuh sebuah path ("event.akad.label"
   * → "event"). Itulah satuan yang dipahami PanelStore.save(). */
  const topKey = (path) => String(path).split(".")[0];

  function inputHtml(f) {
    const id = FIELD_ID(f.path);
    if (f.type === "textarea") return textarea(f.label, id, { rows: f.rows || 3, placeholder: f.placeholder || "" });
    if (f.type === "switch") return switchRow(f.label, id, { hint: f.hint });
    if (f.type === "colorlist") return `<div class="p-field"><span>${esc(f.label)}</span><div id="${escAttr(id)}"></div></div>`;
    if (f.type === "list") return `<div class="p-field"><span>${esc(f.label)}</span><div id="${escAttr(id)}"></div></div>`;
    return field(f.label, id, { type: "text", extra: f.placeholder ? `placeholder="${escAttr(f.placeholder)}"` : "" });
  }

  /** Satu baris di dalam editor daftar (loveStory, gift.accounts, …). */
  function itemInputHtml(spec, i, value) {
    const attrs = `data-i="${i}" data-k="${escAttr(spec.key)}" aria-label="${escAttr(spec.label)} baris ${i + 1}"`;
    if (spec.type === "textarea") {
      return `<textarea class="p-textarea" ${attrs} rows="${spec.rows || 3}" placeholder="${escAttr(spec.placeholder || spec.label)}">${escAttr(value)}</textarea>`;
    }
    if (spec.type === "switch") {
      return `<label class="p-switch"><input type="checkbox" ${attrs} ${value ? "checked" : ""}><span>${esc(spec.label)}</span></label>`;
    }
    if (spec.type === "select") {
      const opts = (spec.options || []).map((o) =>
        `<option value="${escAttr(o.value)}" ${String(value || "") === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("");
      return `<select class="p-select" ${attrs}>${opts}</select>`;
    }
    return `<input type="text" class="p-input" ${attrs} value="${escAttr(value)}" placeholder="${escAttr(spec.placeholder || spec.label)}">`;
  }

  window.PanelSectionPage = function (section) {
    return {
      title: section.label,
      group: "Isi Undangan",
      icon: window.PanelUI.icon(section.icon || "page"),
      photoHandles: [],

      async mount(outlet) {
        const store = window.PanelStore;
        const fields = Array.isArray(section.fields) ? section.fields : [];
        const photos = Array.isArray(section.photos) ? section.photos : [];

        // Urutan kartu = urutan kemunculan pertama namanya di fields lalu photos.
        const cards = [];
        const cardOf = (name, desc) => {
          let c = cards.find((x) => x.name === name);
          if (!c) { c = { name, desc: desc || "", parts: [] }; cards.push(c); }
          else if (desc && !c.desc) c.desc = desc;
          return c;
        };
        // Urutan & deskripsi kartu boleh ditetapkan lebih dulu lewat
        // section.cards — perlu ketika kartu pertama isinya cuma foto sedangkan
        // field milik kartu kedua (mis. bab Cover: kartu "Cover" hanya berisi
        // foto, kartu "Subcover" yang punya field).
        (Array.isArray(section.cards) ? section.cards : []).forEach((c) => cardOf(c.name, c.desc));
        fields.forEach((f) => cardOf(f.card || section.label, f.cardDesc).parts.push({ field: f }));
        photos.forEach((p) => cardOf(p.card || (photos.length === 1 && !fields.length ? section.label : p.label), p.cardDesc).parts.push({ photo: p }));

        outlet.innerHTML = cards.filter((c) => c.parts.length).map((c) => {
          const body = c.parts.map((part) => {
            if (part.field) return inputHtml(part.field);
            const p = part.photo;
            // Judul kartu sudah menyebut fotonya kalau kartunya memang milik
            // foto itu sendiri — jangan diulang jadi label ganda.
            const inner = `<div id="ph-${escAttr(p.slot)}"></div>`;
            return c.name === p.label ? inner : `<div class="p-field"><span>${esc(p.label)}</span>${inner}</div>`;
          }).join("");
          return card(c.name, c.desc, body);
        }).join("");

        function markDirty() { window.PanelRouter.setDirty(true, onSave); }

        /* ── Isi nilai awal + pasang listener ─────────────────────────────── */
        const listStates = new Map();   // path → array (referensi hidup, diedit di tempat)

        fields.forEach((f) => {
          const el = outlet.querySelector("#" + FIELD_ID(f.path));
          if (!el) return;

          if (f.type === "colorlist") {
            const colors = store.get(f.path, []) || [];
            listStates.set(f.path, colors);
            renderColorList(el, f, colors, markDirty);
            return;
          }
          if (f.type === "list") {
            const items = store.get(f.path, []) || [];
            listStates.set(f.path, items);
            renderList(el, f, items, markDirty);
            return;
          }
          if (f.type === "switch") {
            // Default AKTIF untuk data lama yang belum punya field-nya —
            // menyembunyikan section yang selama ini tampil akan terasa seperti
            // fitur hilang, bukan bawaan baru.
            el.checked = store.get(f.path, true) !== false;
            el.addEventListener("change", markDirty);
            return;
          }
          el.value = store.get(f.path, "") ?? "";
          el.addEventListener("input", markDirty);
        });

        this.photoHandles = photos.map((p) =>
          window.PanelPhotos.mount(outlet.querySelector("#ph-" + p.slot), p.slot));

        /* ── Simpan ───────────────────────────────────────────────────────── */
        async function onSave() {
          const missing = [];
          fields.forEach((f) => {
            if (f.type === "colorlist" || f.type === "list") {
              store.set(f.path, listStates.get(f.path));
              return;
            }
            const el = outlet.querySelector("#" + FIELD_ID(f.path));
            if (!el) return;
            if (f.type === "switch") { store.set(f.path, el.checked); return; }
            const value = el.value.trim();
            if (f.required && !value) missing.push(f.label);
            store.set(f.path, value);
          });

          if (missing.length) {
            window.AdminAPI.toast(`Belum diisi: ${missing.join(", ")}.`, true);
            return false;
          }

          const keys = [...new Set(fields.map((f) => topKey(f.path)))];
          if (!keys.length) return true;   // section foto saja — tidak ada teks untuk disimpan
          const { error } = await store.save(keys);
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
  };

  /* ── Editor daftar warna (dresscode) ───────────────────────────────────── */
  function renderColorList(box, f, colors, markDirty) {
    const draw = () => {
      box.innerHTML = colors.map((color, i) => `
        <div class="p-color-row" style="margin-bottom:.5rem">
          <input type="color" value="${pickerHex(color)}" data-color-i="${i}" aria-label="Pilih warna ${i + 1}">
          <input type="text" class="p-input" data-color-hex="${i}" value="${escAttr(color)}" maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="#c9a668" aria-label="Kode hex warna ${i + 1}">
          <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-color-del="${i}" aria-label="Hapus warna">&times;</button>
        </div>`).join("") + `<button type="button" class="p-btn p-btn--ghost p-btn--tiny" data-color-add>+ warna</button>`;

      colors.forEach((_, i) => bindColorPair(box, String(i), (val) => { colors[i] = val; markDirty(); }));
      box.querySelectorAll("[data-color-del]").forEach((btn) => btn.addEventListener("click", () => {
        colors.splice(Number(btn.dataset.colorDel), 1); markDirty(); draw();
      }));
      box.querySelector("[data-color-add]").addEventListener("click", () => {
        colors.push(f.newItem || "#c9a668"); markDirty(); draw();
      });
    };
    draw();
  }

  /* ── Editor daftar objek (loveStory, gift.accounts) ────────────────────── */
  function renderList(box, f, items, markDirty) {
    const specs = Array.isArray(f.item) ? f.item : [];
    const draw = () => {
      box.innerHTML = items.map((item, i) => `
        <div class="p-list-row" style="margin-bottom:.6rem">
          <div class="p-list-row__fields">
            ${specs.map((spec) => itemInputHtml(spec, i, item[spec.key])).join("")}
          </div>
          <div class="p-list-row__controls">
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="1" ${i === items.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
          </div>
        </div>`).join("") +
        `<button type="button" class="p-btn p-btn--ghost" data-add>${esc(f.addLabel || "+ tambah")}</button>`;

      box.querySelectorAll("[data-i]").forEach((input) => {
        const write = () => {
          const item = items[Number(input.dataset.i)];
          item[input.dataset.k] = input.type === "checkbox" ? input.checked : input.value;
          markDirty();
        };
        input.addEventListener("input", write);
        input.addEventListener("change", write);
      });
      box.querySelectorAll("[data-move]").forEach((btn) => btn.addEventListener("click", () => {
        const from = Number(btn.dataset.move), to = from + Number(btn.dataset.dir);
        if (to < 0 || to >= items.length) return;
        [items[from], items[to]] = [items[to], items[from]];
        markDirty(); draw();
      }));
      box.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => {
        items.splice(Number(btn.dataset.del), 1); markDirty(); draw();
      }));
      box.querySelector("[data-add]").addEventListener("click", () => {
        // Baris baru dibentuk dari skema item supaya key-nya lengkap sejak awal
        // (input yang value-nya undefined tidak pernah memicu event "input").
        const blank = {};
        specs.forEach((spec) => { blank[spec.key] = spec.type === "switch" ? false : ""; });
        items.push(Object.assign(blank, f.newItem || {}));
        markDirty(); draw();
      });
    };
    draw();
  }
})();
