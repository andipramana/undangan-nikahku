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

    const { data, error } = await window.AdminAPI.query(
      sb.from("site_content").select("content").eq("id", 1).maybeSingle(),
      "Permintaan teks"
    );
    if (error && error.code !== "PGRST116") {
      // Jangan tinggalkan layar di "Memuat teks…" selamanya — toast hilang
      // dalam 2,5 detik dan tamu-admin tidak punya petunjuk apa pun soal
      // apa yang salah maupun cara mencoba lagi.
      formRoot.innerHTML =
        `<p class="warning">Gagal memuat teks: ${escAttr(error.message)}</p>` +
        `<button type="button" class="btn btn--primary" id="content-retry">Coba lagi</button>`;
      document.getElementById("content-retry").addEventListener("click", load);
      toast("Gagal memuat teks: " + error.message, true);
      return;
    }
    content = data && data.content
      ? JSON.parse(JSON.stringify(data.content))
      : window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);
    seedDefaults(content);
    render();
  }

  /** Tanam default untuk key yang belum ada di site_content versi lama (DB
   * diisi sebelum field-field baru ditambahkan). Form — terutama renderList —
   * membaca struktur state ini LANGSUNG: kalau key-nya hilang, guard `|| []`
   * di renderList mencegah crash, TAPI array hasilnya array lepas — tombol
   * "+ tambah rekomendasi" mendorong item ke array itu, lalu render ulang
   * menghitung ulang dari `undefined || []` dan itemnya HILANG (bug:
   * tombol terlihat hidup, hasilnya tidak pernah bertahan, ketikannya tidak
   * ikut tersimpan). Seed dijalankan DI SINI — sebelum render — supaya
   * state-nya benar sejak awal, bukan diperbaiki parsial di renderList. */
  function seedDefaults(c) {
    c.livestream = Object.assign(
      { youtube: "", instagram: "", tiktok: "" },
      isPlainObject(c.livestream) ? c.livestream : {}
    );
    c.galleryVideo = Object.assign({ youtube: "" }, isPlainObject(c.galleryVideo) ? c.galleryVideo : {});
    if (!isPlainObject(c.gift)) c.gift = {};
    if (!Array.isArray(c.gift.accounts)) c.gift.accounts = [];
    // Template pesan WA PER REKENING — kosong = pakai default hardcoded di
    // gift.js (bukan menyimpan string default panjang ke DB).
    c.gift.accounts.forEach((a) => { if (typeof a.template !== "string") a.template = ""; });
    if (!isPlainObject(c.gift.address)) c.gift.address = {};
    if (typeof c.gift.address.template !== "string") c.gift.address.template = "";
    if (c.gift.contactCPP === undefined) c.gift.contactCPP = "";
    if (c.gift.contactCPW === undefined) c.gift.contactCPW = "";
    if (!Array.isArray(c.giftRecommendations)) c.giftRecommendations = [];
    // Sapaan tamu per kelompok nama (Bagian D) — kosong = fallback "Kepada Yth."
    if (!Array.isArray(c.guestGreetings)) c.guestGreetings = [];
    if (c.defaultGuestGreeting === undefined) c.defaultGuestGreeting = "Kepada Yth.";
    // Guard per grup: renderGreetings memanggil g.names.map LANGSUNG — grup
    // dari DB versi lama tanpa names/label akan mematahkan render kalau lewat.
    c.guestGreetings.forEach((g) => {
      if (!Array.isArray(g.names)) g.names = [];
      if (typeof g.label !== "string") g.label = "";
    });
  }

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
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

  /** id (slug pendek) dipakai untuk lompatan langsung dari menu navigasi
   * section (section-nav.js) — lihat id="sec-${id}" di bawah. */
  function section(id, title, body) {
    return `<fieldset class="form-section" id="sec-${id}"><legend>${title}</legend>${body}</fieldset>`;
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
        ${section("umum", "Umum", `
          ${field("Judul situs", "f-site-title")}
          ${field("Parameter nama tamu (URL)", "f-guest-param")}
          ${field("Nama tamu default", "f-default-guest")}
        `)}

        ${section("sapaan", "Sapaan tamu", `
          ${field("Sapaan default (fallback)", "f-default-guest-greeting")}
          <p class="muted">Sapaan default dipakai untuk tamu yang tidak cocok
          dengan kelompok mana pun. Nama tamu dicocokkan PERSIS dengan daftar di
          bawah (abaikan besar kecil huruf) — cocok berarti sapaan kelompok itulah
          yang dipakai, bukan yang default.</p>
          <div id="guest-greetings-list"></div>
        `)}

        ${section("mempelai", "Mempelai", `
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

        ${section("opening", "Opening — ayat", `
          ${textarea("Bismillah (arab)", "f-opening-arabic", 2)}
          ${textarea("Terjemahan", "f-opening-quote", 4)}
          ${field("Sumber (QS …)", "f-opening-source")}
        `)}

        ${section("event", "Event", `
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

        ${section("dresscode", "Dresscode", `
          ${textarea("Teks", "f-dresscode-text", 3)}
          <div class="form-field">
            <span>Warna pilihan</span>
            <div id="dresscode-colors"></div>
          </div>
        `)}

        ${section("quote", "Quote foto", `
          ${textarea("Teks quote", "f-quote-text", 3)}
        `)}

        ${section("live-streaming", "Live Streaming & Video Galeri", `
          <div class="form-grid">
            ${field("YouTube (URL)", "f-live-youtube", "url")}
            ${field("Instagram (URL)", "f-live-instagram", "url")}
            ${field("TikTok (URL)", "f-live-tiktok", "url")}
            ${field("Video galeri (YouTube)", "f-gallery-video", "url")}
          </div>
          <p class="muted">Kosongkan URL untuk menyembunyikan platform itu.
          Section Live Streaming ikut hilang kalau ketiganya kosong. Video galeri
          tampil sebagai thumbnail di atas foto galeri.</p>
        `)}

        ${section("love-story", "Love Story (tiap babak)", `
          <div id="love-story-list"></div>
        `)}

        ${section("gift-rekening", "Gift — rekening", `
          <div id="gift-accounts-list"></div>
        `)}

        ${section("gift-kontak", "Gift — kontak WhatsApp", `
          <div class="form-grid">
            ${field("CPW — nomor WA (62…)", "f-gift-contact-cpw")}
            ${field("CPP — nomor WA (62…)", "f-gift-contact-cpp")}
          </div>
          <p class="muted">Dituju tombol "Konfirmasi Pengiriman", dipilih otomatis
          dari field <code>owner</code> tiap rekening. Kosong = rekening itu tidak
          ikut di dropdown.</p>
        `)}

        ${section("gift-alamat", "Gift — alamat kado", `
          <div class="form-grid">
            ${field("Penerima", "f-gift-recipient")}
            ${field("Telepon", "f-gift-phone")}
            ${field("Detail alamat", "f-gift-detail")}
          </div>
          ${textarea("Template pesan konfirmasi kado", "f-gift-template-kado", 3)}
          <p class="muted">Token: <code>\${tamu}</code> nama tamu,
          <code>\${CPP}</code>/<code>\${CPW}</code> panggilan mempelai,
          <code>\${LABEL}</code> nama rekening/opsi. Kosongkan = pesan default.
          Template tiap rekening bisa dikustom di daftar rekening di atas.</p>
        `)}

        ${section("gift-rekomendasi", "Gift — rekomendasi kado", `
          <div id="gift-recs-list"></div>
          <p class="muted">Foto kado diunggah di tab Foto (folder "Rekomendasi
          Kado") — foto ke-i dipasangkan dengan baris ke-i di sini.</p>
        `)}

        ${section("lainnya", "Lainnya", `
          <div class="form-grid">
            ${field("Jeda slideshow hero (ms)", "f-hero-interval", "number")}
            ${field("Audio — sumber", "f-audio-src")}
            ${field("Audio — judul", "f-audio-title")}
            ${textarea("Closing", "f-closing-text", 3)}
          </div>
        `)}
      </form>
    `;
    // Tombol "Simpan semua" TIDAK dirender di sini — ia elemen statis di
    // admin.html (btn-save-float, form="content-form") supaya bisa fixed di
    // luar scroller; kliknya tetap memicu submit form ini (lihat admin.html).

    // Isi nilai dari state
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };
    set("f-site-title", c.siteTitle);
    set("f-guest-param", c.guestParam);
    set("f-default-guest", c.defaultGuestName);
    set("f-default-guest-greeting", v("defaultGuestGreeting"));
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
    set("f-live-youtube", v("livestream.youtube"));
    set("f-live-instagram", v("livestream.instagram"));
    set("f-live-tiktok", v("livestream.tiktok"));
    set("f-gallery-video", v("galleryVideo.youtube"));
    set("f-gift-contact-cpp", v("gift.contactCPP"));
    set("f-gift-contact-cpw", v("gift.contactCPW"));
    set("f-gift-recipient", v("gift.address.recipient"));
    set("f-gift-phone", v("gift.address.phone"));
    set("f-gift-detail", v("gift.address.detail"));
    set("f-gift-template-kado", v("gift.address.template"));
    set("f-hero-interval", v("heroSlideInterval"));
    set("f-audio-src", v("audio.src"));
    set("f-audio-title", v("audio.title"));
    set("f-closing-text", v("closing.text"));

    renderColors();
    renderList("loveStory", "love-story-list");
    renderList("accounts", "gift-accounts-list");
    renderList("giftRecommendations", "gift-recs-list");
    renderGreetings();

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

  /** Kelompok sapaan tamu — daftar DUA tingkat: label kelompok + nama-nama
   * anggotanya (renderGreetings di sini; dipakai main.js via resolveGreeting).
   * Pola sama seperti renderList: nilai ditulis ke state saat mengetik,
   * dirender ulang penuh tiap aksi struktur (tambah nama, tambah/hapus/pindah
   * grup) supaya urutan state dan DOM tidak pernah berbeda. */
  function renderGreetings() {
    const list = document.getElementById("guest-greetings-list");
    if (!list) return;
    const groups = content.guestGreetings;

    list.innerHTML = groups
      .map((g, gi) => `
        <div class="list-item">
          <div class="list-item__controls">
            <button type="button" class="btn btn--tiny" data-g-move="${gi}" data-dir="-1" ${gi === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="btn btn--tiny" data-g-move="${gi}" data-dir="1" ${gi === groups.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="btn btn--tiny btn--danger" data-g-del="${gi}" aria-label="Hapus grup">&times;</button>
          </div>
          <div class="list-item__fields">
            <input type="text" class="input" data-g-i="${gi}" data-g-key="label" value="${escAttr(g.label)}"
                   placeholder="Sapaan kelompok, mis. Keluarga Besar">
            <div class="greeting-names">
              ${g.names
                .map(
                  (n, ni) => `
                <span class="greeting-name">
                  <input type="text" class="input" data-g-i="${gi}" data-n-i="${ni}" value="${escAttr(n)}"
                         placeholder="Nama tamu (persis seperti di URL)">
                  <button type="button" class="btn btn--tiny" data-g-name-del="${gi}" data-n-del="${ni}" aria-label="Hapus nama">&times;</button>
                </span>`
                )
                .join("")}
            </div>
            <div class="greeting-actions">
              <button type="button" class="btn btn--ghost" data-g-add-name="${gi}">+ nama</button>
            </div>
          </div>
        </div>`)
      .join("") +
      `<button type="button" class="btn btn--ghost" id="greetings-add">+ tambah grup sapaan</button>`;

    // Label grup + nama: tulis ke state saat mengetik.
    list.querySelectorAll("[data-g-key]").forEach((input) => {
      input.addEventListener("input", () => {
        groups[Number(input.dataset.gI)][input.dataset.gKey] = input.value;
      });
    });
    list.querySelectorAll("[data-n-i]").forEach((input) => {
      input.addEventListener("input", () => {
        groups[Number(input.dataset.gI)].names[Number(input.dataset.nI)] = input.value;
      });
    });
    list.querySelectorAll("[data-g-add-name]").forEach((btn) => {
      btn.addEventListener("click", () => {
        groups[Number(btn.dataset.gAddName)].names.push("");
        renderGreetings();
      });
    });
    list.querySelectorAll("[data-g-name-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        groups[Number(btn.dataset.gNameDel)].names.splice(Number(btn.dataset.nDel), 1);
        renderGreetings();
      });
    });
    list.querySelectorAll("[data-g-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const from = Number(btn.dataset.gMove);
        const to = from + Number(btn.dataset.dir);
        if (to < 0 || to >= groups.length) return;
        [groups[from], groups[to]] = [groups[to], groups[from]];
        renderGreetings();
      });
    });
    list.querySelectorAll("[data-g-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        groups.splice(Number(btn.dataset.gDel), 1);
        renderGreetings();
      });
    });
    document.getElementById("greetings-add").addEventListener("click", () => {
      groups.push({ label: "", names: [] });
      renderGreetings();
    });
  }

  /** Render daftar berulang (loveStory / gift.accounts / giftRecommendations)
   * dengan tombol naik/turun + hapus. Value input langsung ditulis ke state
   * (bukan dibaca saat simpan) — dirender ulang penuh tiap aksi sehingga
   * urutan state dan DOM tidak pernah berbeda. */
  function renderList(kind, containerId) {
    const container = document.getElementById(containerId);
    // || [] jaring pengaman kedua — key-nya seharusnya sudah dijamin ada
    // oleh seedDefaults() di load(); kalau pun lepas, setidaknya form tidak
    // patah di tengah render.
    const items =
      kind === "loveStory" ? content.loveStory
        : kind === "accounts" ? content.gift.accounts
        : content.giftRecommendations || [];

    // Pilihan pemilik rekening — menentukan nomor WA tujuan di tombol
    // "Konfirmasi Pengiriman" (lihat gift.js); "" = rekening itu tidak ikut.
    const ownerOptions = (item) => `
      <select class="input" data-item-i="__I__" data-key="owner">
        <option value="">Tidak ikut</option>
        <option value="cpw" ${item.owner === "cpw" ? "selected" : ""}>CPW (wanita)</option>
        <option value="cpp" ${item.owner === "cpp" ? "selected" : ""}>CPP (pria)</option>
      </select>`;

    container.innerHTML = items
      .map((item, i) => {
        const inner =
          kind === "loveStory"
            ? `
          <input type="text" class="input" data-item-i="${i}" data-key="date" value="${escAttr(item.date)}" placeholder="Tahun">
          <input type="text" class="input" data-item-i="${i}" data-key="title" value="${escAttr(item.title)}" placeholder="Judul babak">
          <textarea class="input" data-item-i="${i}" data-key="text" rows="4" placeholder="Cerita…">${escAttr(item.text)}</textarea>`
            : kind === "accounts"
            ? `
          <input type="text" class="input" data-item-i="${i}" data-key="bank" value="${escAttr(item.bank)}" placeholder="Bank">
          <input type="text" class="input" data-item-i="${i}" data-key="number" value="${escAttr(item.number)}" placeholder="Nomor rekening">
          <input type="text" class="input" data-item-i="${i}" data-key="holder" value="${escAttr(item.holder)}" placeholder="Atas nama">
          ${ownerOptions(item).replace("__I__", String(i))}
          <label class="check-row">
            <input type="checkbox" data-item-i="${i}" data-key="placeholder" ${item.placeholder ? "checked" : ""}>
            Sembunyikan nomor (placeholder)
          </label>
          <textarea class="input" data-item-i="${i}" data-key="template" rows="3" placeholder="Pesan WA kustom (kosongkan = pakai default). Token: \${tamu} \${CPP} \${CPW} \${LABEL}">${escAttr(item.template)}</textarea>`
            : `
          <input type="text" class="input" data-item-i="${i}" data-key="name" value="${escAttr(item.name)}" placeholder="Nama kado">
          <input type="text" class="input" data-item-i="${i}" data-key="price" value="${escAttr(item.price)}" placeholder="Harga, mis. Rp 250.000">
          <input type="url" class="input" data-item-i="${i}" data-key="link" value="${escAttr(item.link)}" placeholder="Link beli (Shopee/Tokopedia/…)">`;
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
        kind === "loveStory" ? "babak"
          : kind === "accounts" ? "rekening"
          : "rekomendasi"
      }</button>`;

    // Tulis nilai ke state saat mengetik (select memakai 'change' — ia tidak
    // memicu 'input' di semua browser)
    container.querySelectorAll("[data-key]").forEach((input) => {
      const write = () => {
        const item = items[Number(input.dataset.itemI)];
        item[input.dataset.key] = input.type === "checkbox" ? input.checked : input.value;
      };
      input.addEventListener("input", write);
      input.addEventListener("change", write);
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
        kind === "loveStory"
          ? { date: "", title: "", text: "" }
          : kind === "accounts"
          ? { bank: "", number: "", holder: "", owner: "", placeholder: false }
          : { name: "", price: "", link: "" }
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
    grab("f-default-guest-greeting", "defaultGuestGreeting");
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
    grab("f-live-youtube", "livestream.youtube");
    grab("f-live-instagram", "livestream.instagram");
    grab("f-live-tiktok", "livestream.tiktok");
    grab("f-gallery-video", "galleryVideo.youtube");
    grab("f-gift-contact-cpp", "gift.contactCPP");
    grab("f-gift-contact-cpw", "gift.contactCPW");
    grab("f-gift-recipient", "gift.address.recipient");
    grab("f-gift-phone", "gift.address.phone");
    grab("f-gift-detail", "gift.address.detail");
    grab("f-gift-template-kado", "gift.address.template");
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
