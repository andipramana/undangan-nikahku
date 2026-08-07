/**
 * Tab Teks: form satu halaman yang mencerminkan struktur `content` (site_content).
 * Tanpa framework — form di-render dari HTML string, nilai dikumpulkan lewat
 * pemetaan id → path JSON. Bagian berulang (loveStory, gift.accounts,
 * dresscode.colors) dirender ulang dari state tiap ada tambah/hapus/urut,
 * sehingga tidak ada dua sumber kebenaran untuk daftar.
 */
(function () {
  const { sb, toast } = window.AdminAPI;

  let content = null; // objek kerja; disalin dalam sebelum form diedit
  let formRoot = null;

  window.ContentPanel = { load };

  async function load() {
    formRoot = document.getElementById("content-form-root");
    formRoot.innerHTML = "<p class='muted'>Memuat teks…</p>";

    const { data, error } = await sb
      .from("site_content")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      toast("Gagal memuat teks: " + error.message, true);
      return;
    }
    content = data && data.content
      ? JSON.parse(JSON.stringify(data.content))
      : window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);
    render();
  }

  // -------------------------------------------------------------------------
  // Render form
  // -------------------------------------------------------------------------
  function field(label, id, type = "text", extra = "") {
    return `
      <label class="form-field">
        <span>${label}</span>
        <input type="${type}" id="${id}" ${extra}>
      </label>`;
  }

  function textarea(label, id, rows = 3) {
    return `
      <label class="form-field">
        <span>${label}</span>
        <textarea id="${id}" rows="${rows}"></textarea>
      </label>`;
  }

  function section(title, body) {
    return `<fieldset class="form-section"><legend>${title}</legend>${body}</fieldset>`;
  }

  function render() {
    const c = content;
    // String() WAJIB: heroSlideInterval bernilai angka (4500), dan tanpa
    // pemaksaan tipe ini `.replace` melempar TypeError di tengah pengisian form.
    // Akibatnya semua yang dijalankan SESUDAHNYA ikut mati diam-diam — warna
    // dresscode, daftar Love Story, daftar rekening, sampai pemasangan listener
    // tombol "Simpan semua" (yang lalu memuat ulang halaman alih-alih menyimpan).
    // Bandingkan escAttr() di bawah yang sejak awal sudah memakai String().
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const v = (path) => esc(getPath(c, path));

    // Kartu berulang dirender dari state — lihat renderList() di bawah.
    formRoot.innerHTML = `
      <form id="content-form" class="content-form">
        ${section("Umum", `
          ${field("Judul situs", "f-site-title")}
          ${field("Parameter nama tamu (URL)", "f-guest-param")}
          ${field("Nama tamu default", "f-default-guest")}
        `)}

        ${section("Mempelai", `
          <div class="form-grid">
            ${field("Nama pengantin wanita", "f-bride-name")}
            ${field("Panggilan", "f-bride-nickname")}
            ${field("Instagram (opsional)", "f-bride-instagram")}
            ${field("Nama ayah", "f-bride-father")}
            ${field("Nama ibu", "f-bride-mother")}
            ${field("Nama pengantin pria", "f-groom-name")}
            ${field("Panggilan", "f-groom-nickname")}
            ${field("Instagram (opsional)", "f-groom-instagram")}
            ${field("Nama ayah", "f-groom-father")}
            ${field("Nama ibu", "f-groom-mother")}
          </div>
        `)}

        ${section("Opening — ayat", `
          ${textarea("Bismillah (arab)", "f-opening-arabic", 2)}
          ${textarea("Terjemahan", "f-opening-quote", 4)}
          ${field("Sumber (QS …)", "f-opening-source")}
        `)}

        ${section("Event", `
          <div class="form-grid">
            ${field("Tanggal (ISO, yyyy-mm-dd)", "f-event-iso")}
            ${field("Tanggal tampil", "f-event-label")}
            ${field("Nama hari", "f-event-day")}
            ${field("Target countdown (ISO + offset)", "f-event-countdown")}
            ${field("Akad — label", "f-akad-label")}
            ${field("Akad — mulai", "f-akad-start")}
            ${field("Akad — selesai", "f-akad-end")}
            ${field("Resepsi — label", "f-resepsi-label")}
            ${field("Resepsi — mulai", "f-resepsi-start")}
            ${field("Resepsi — selesai", "f-resepsi-end")}
            ${field("Nama venue", "f-venue-name")}
            ${field("Alamat venue", "f-venue-address")}
            ${field("URL Google Maps", "f-venue-maps")}
          </div>
        `)}

        ${section("Dresscode", `
          ${textarea("Teks", "f-dresscode-text", 3)}
          <div class="form-field">
            <span>Warna pilihan</span>
            <div id="dresscode-colors"></div>
          </div>
        `)}

        ${section("Quote foto", `
          ${textarea("Teks quote", "f-quote-text", 3)}
        `)}

        ${section("Love Story (tiap babak)", `
          <div id="love-story-list"></div>
        `)}

        ${section("Gift — rekening", `
          <div id="gift-accounts-list"></div>
        `)}

        ${section("Gift — alamat kado", `
          <div class="form-grid">
            ${field("Penerima", "f-gift-recipient")}
            ${field("Telepon", "f-gift-phone")}
            ${field("Detail alamat", "f-gift-detail")}
          </div>
        `)}

        ${section("Lainnya", `
          <div class="form-grid">
            ${field("Jeda slideshow hero (ms)", "f-hero-interval", "number")}
            ${field("Audio — sumber", "f-audio-src")}
            ${field("Audio — judul", "f-audio-title")}
            ${textarea("Closing", "f-closing-text", 3)}
          </div>
        `)}

        <div class="form-actions">
          <button type="submit" class="btn btn--primary" id="btn-save-content">Simpan semua</button>
        </div>
      </form>
    `;

    // Isi nilai dari state
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    set("f-site-title", c.siteTitle);
    set("f-guest-param", c.guestParam);
    set("f-default-guest", c.defaultGuestName);
    set("f-bride-name", v("couple.bride.name"));
    set("f-bride-nickname", v("couple.bride.nickname"));
    set("f-bride-instagram", v("couple.bride.instagram"));
    set("f-bride-father", v("couple.bride.father"));
    set("f-bride-mother", v("couple.bride.mother"));
    set("f-groom-name", v("couple.groom.name"));
    set("f-groom-nickname", v("couple.groom.nickname"));
    set("f-groom-instagram", v("couple.groom.instagram"));
    set("f-groom-father", v("couple.groom.father"));
    set("f-groom-mother", v("couple.groom.mother"));
    set("f-opening-arabic", v("opening.arabicQuote"));
    set("f-opening-quote", v("opening.quote"));
    set("f-opening-source", v("opening.source"));
    set("f-event-iso", v("event.dateISO"));
    set("f-event-label", v("event.dateLabel"));
    set("f-event-day", v("event.dayLabel"));
    set("f-event-countdown", v("event.countdownTarget"));
    set("f-akad-label", v("event.akad.label"));
    set("f-akad-start", v("event.akad.start"));
    set("f-akad-end", v("event.akad.end"));
    set("f-resepsi-label", v("event.resepsi.label"));
    set("f-resepsi-start", v("event.resepsi.start"));
    set("f-resepsi-end", v("event.resepsi.end"));
    set("f-venue-name", v("event.venue.name"));
    set("f-venue-address", v("event.venue.address"));
    set("f-venue-maps", v("event.venue.mapsUrl"));
    set("f-dresscode-text", v("dresscode.text"));
    set("f-quote-text", v("quotePhoto.quote"));
    set("f-gift-recipient", v("gift.address.recipient"));
    set("f-gift-phone", v("gift.address.phone"));
    set("f-gift-detail", v("gift.address.detail"));
    set("f-hero-interval", v("heroSlideInterval"));
    set("f-audio-src", v("audio.src"));
    set("f-audio-title", v("audio.title"));
    set("f-closing-text", v("closing.text"));

    renderColors();
    renderList("loveStory", "love-story-list");
    renderList("accounts", "gift-accounts-list");

    document.getElementById("content-form").addEventListener("submit", onSave);
  }

  // Warna dresscode: deretan input color + tombol tambah/hapus. Dirender ulang
  // penuh tiap berubah supaya urutannya selalu mencerminkan state.
  function renderColors() {
    const box = document.getElementById("dresscode-colors");
    if (!box) return;
    const colors = content.dresscode.colors;
    // Dua cara memasukkan warna yang saling tersinkron: pemilih visual untuk
    // memilih cepat, dan kotak teks hex untuk menyalin kode persis dari palet
    // atau undangan lain (memilih #c9a668 dengan mata di pemilih warna nyaris
    // mustahil).
    box.innerHTML = colors
      .map(
        (color, i) => `
      <span class="color-row">
        <input type="color" value="${pickerHex(color)}" data-color-i="${i}" aria-label="Pilih warna ${i + 1}">
        <input type="text" class="color-hex" value="${escAttr(color)}" data-color-hex="${i}"
               maxlength="7" spellcheck="false" autocapitalize="off" autocomplete="off"
               placeholder="#c9a668" aria-label="Kode hex warna ${i + 1}">
        <button type="button" class="btn btn--tiny" data-color-del="${i}" aria-label="Hapus warna">&times;</button>
      </span>`
      )
      .join("") +
      `<button type="button" class="btn btn--tiny" id="color-add">+ warna</button>`;

    box.querySelectorAll("input[type=color]").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.colorI);
        colors[i] = input.value;
        const hex = box.querySelector(`[data-color-hex="${i}"]`);
        if (hex) {
          hex.value = input.value;
          hex.classList.remove("is-invalid");
        }
      });
    });

    box.querySelectorAll("[data-color-hex]").forEach((input) => {
      input.addEventListener("input", () => {
        const i = Number(input.dataset.colorHex);
        let val = input.value.trim();
        if (val && !val.startsWith("#")) val = "#" + val; // mengetik "c9a668" pun diterima
        const ok = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val);
        input.classList.toggle("is-invalid", !ok);
        // Nilai setengah jadi ("#c9a6", "#c9a66") sengaja TIDAK ditulis ke
        // state — kalau ditulis, satu ketikan di tengah jalan sudah mengubah
        // warna asli dan nilai lamanya hilang sebelum kodenya utuh.
        // Catatan: "#c9a" TIDAK termasuk setengah jadi — hex singkat 3 digit
        // itu sah dan mengembang jadi #cc99aa.
        if (!ok) return;
        colors[i] = val;
        const picker = box.querySelector(`[data-color-i="${i}"]`);
        if (picker) picker.value = pickerHex(val);
      });
      // Selesai mengetik: kembalikan tampilan ke nilai yang benar-benar tersimpan,
      // supaya kotak tidak ditinggalkan berisi kode tak sah.
      input.addEventListener("blur", () => {
        input.value = colors[Number(input.dataset.colorHex)] || "";
        input.classList.remove("is-invalid");
      });
    });
    box.querySelectorAll("[data-color-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        content.dresscode.colors.splice(Number(btn.dataset.colorDel), 1);
        renderColors();
      });
    });
    document.getElementById("color-add").addEventListener("click", () => {
      content.dresscode.colors.push("#c9a668");
      renderColors();
    });
  }

  /** Render daftar berulang (loveStory / gift.accounts) dengan tombol
   * naik/turun + hapus. Value input langsung ditulis ke state (bukan dibaca
   * saat simpan) — dirender ulang penuh tiap aksi sehingga urutan state
   * dan DOM tidak pernah berbeda. */
  function renderList(kind, containerId) {
    const container = document.getElementById(containerId);
    const items = kind === "loveStory" ? content.loveStory : content.gift.accounts;

    container.innerHTML = items
      .map((item, i) => {
        const inner =
          kind === "loveStory"
            ? `
          <input type="text" data-item-i="${i}" data-key="date" value="${escAttr(item.date)}" placeholder="Tahun">
          <input type="text" data-item-i="${i}" data-key="title" value="${escAttr(item.title)}" placeholder="Judul babak">
          <textarea data-item-i="${i}" data-key="text" rows="2" placeholder="Cerita…">${escAttr(item.text)}</textarea>`
            : `
          <input type="text" data-item-i="${i}" data-key="bank" value="${escAttr(item.bank)}" placeholder="Bank">
          <input type="text" data-item-i="${i}" data-key="number" value="${escAttr(item.number)}" placeholder="Nomor rekening">
          <input type="text" data-item-i="${i}" data-key="holder" value="${escAttr(item.holder)}" placeholder="Atas nama">
          <label class="check-row">
            <input type="checkbox" data-item-i="${i}" data-key="placeholder" ${item.placeholder ? "checked" : ""}>
            Sembunyikan nomor (placeholder)
          </label>`;
        return `
        <div class="list-item">
          <div class="list-item__controls">
            <button type="button" class="btn btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="btn btn--tiny" data-move="${i}" data-dir="1" ${i === items.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="btn btn--tiny btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
          </div>
          <div class="list-item__fields">${inner}</div>
        </div>`;
      })
      .join("") +
      `<button type="button" class="btn btn--ghost" id="${kind}-add">+ tambah ${
        kind === "loveStory" ? "babak" : "rekening"
      }</button>`;

    // Tulis nilai ke state saat mengetik
    container.querySelectorAll("[data-key]").forEach((input) => {
      input.addEventListener("input", () => {
        const item = items[Number(input.dataset.itemI)];
        const key = input.dataset.key;
        item[key] = input.type === "checkbox" ? input.checked : input.value;
      });
    });
    container.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const from = Number(btn.dataset.move);
        const to = from + Number(btn.dataset.dir);
        if (to < 0 || to >= items.length) return;
        [items[from], items[to]] = [items[to], items[from]];
        renderList(kind, containerId);
      });
    });
    container.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        items.splice(Number(btn.dataset.del), 1);
        renderList(kind, containerId);
      });
    });
    document.getElementById(`${kind}-add`).addEventListener("click", () => {
      items.push(
        kind === "loveStory" ? { date: "", title: "", text: "" } : { bank: "", number: "", holder: "", placeholder: false }
      );
      renderList(kind, containerId);
    });
  }

  // -------------------------------------------------------------------------
  // Simpan
  // -------------------------------------------------------------------------
  function onSave(e) {
    e.preventDefault();
    // Field tunggal (non-daftar) dibaca dari DOM ke state. Bagian berulang
    // sudah menulis ke state saat mengetik, jadi tidak disentuh di sini.
    const grab = (id, path, type = "string") => {
      const val = document.getElementById(id).value.trim();
      setPath(content, path, type === "number" ? Number(val) || 0 : val);
    };
    grab("f-site-title", "siteTitle");
    grab("f-guest-param", "guestParam");
    grab("f-default-guest", "defaultGuestName");
    grab("f-bride-name", "couple.bride.name");
    grab("f-bride-nickname", "couple.bride.nickname");
    grab("f-bride-instagram", "couple.bride.instagram");
    grab("f-bride-father", "couple.bride.father");
    grab("f-bride-mother", "couple.bride.mother");
    grab("f-groom-name", "couple.groom.name");
    grab("f-groom-nickname", "couple.groom.nickname");
    grab("f-groom-instagram", "couple.groom.instagram");
    grab("f-groom-father", "couple.groom.father");
    grab("f-groom-mother", "couple.groom.mother");
    grab("f-opening-arabic", "opening.arabicQuote");
    grab("f-opening-quote", "opening.quote");
    grab("f-opening-source", "opening.source");
    grab("f-event-iso", "event.dateISO");
    grab("f-event-label", "event.dateLabel");
    grab("f-event-day", "event.dayLabel");
    grab("f-event-countdown", "event.countdownTarget");
    grab("f-akad-label", "event.akad.label");
    grab("f-akad-start", "event.akad.start");
    grab("f-akad-end", "event.akad.end");
    grab("f-resepsi-label", "event.resepsi.label");
    grab("f-resepsi-start", "event.resepsi.start");
    grab("f-resepsi-end", "event.resepsi.end");
    grab("f-venue-name", "event.venue.name");
    grab("f-venue-address", "event.venue.address");
    grab("f-venue-maps", "event.venue.mapsUrl");
    grab("f-dresscode-text", "dresscode.text");
    grab("f-quote-text", "quotePhoto.quote");
    grab("f-gift-recipient", "gift.address.recipient");
    grab("f-gift-phone", "gift.address.phone");
    grab("f-gift-detail", "gift.address.detail");
    grab("f-hero-interval", "heroSlideInterval", "number");
    grab("f-audio-src", "audio.src");
    grab("f-audio-title", "audio.title");
    grab("f-closing-text", "closing.text");

    // Validasi ringan — jangan biarkan undangan simpan data yang rusak.
    if (!content.couple.bride.name || !content.couple.groom.name) {
      toast("Nama mempelai tidak boleh kosong.", true);
      return;
    }
    if (!content.event.dateLabel || !content.event.countdownTarget) {
      toast("Tanggal event tidak boleh kosong.", true);
      return;
    }

    const btn = document.getElementById("btn-save-content");
    btn.disabled = true;
    sb.from("site_content")
      .upsert({ id: 1, content, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .then(({ error }) => {
        btn.disabled = false;
        if (error) toast("Gagal menyimpan: " + error.message, true);
        else toast("Tersimpan ✓");
      });
  }

  // -------------------------------------------------------------------------
  // Helper path
  // -------------------------------------------------------------------------
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  /** <input type="color"> hanya menerima #rrggbb. Bentuk singkat (#fff) atau
   * nilai tak sah membuatnya diam-diam jatuh ke hitam, jadi dipanjangkan dulu
   * di sini — nilai yang DISIMPAN tetap apa adanya seperti yang diketik. */
  function pickerHex(value) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || "").trim());
    if (!m) return "#000000";
    const h = m[1];
    return ("#" + (h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h)).toLowerCase();
  }

  function escAttr(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }
})();
