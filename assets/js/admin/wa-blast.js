/**
 * Tab "Kirim WA": daftar kontak undangan + template pesan — broadcast
 * SATU-PER-SATU, BUKAN bulk-sender otomatis.
 *
 * Tiap baris kontak punya SATU tombol "Kirim" yang membuka link
 * https://wa.me/<nomor>?text=<pesan> di tab baru (pola SAMA dengan konfirmasi
 * kado di gift.js) — pesan sudah terisi, tapi ADMIN SENDIRI yang menekan tombol
 * kirim FINAL di aplikasi WhatsApp. Tidak ada yang terkirim tanpa sentuhan
 * manusia per pesan; WA mendeteksi spam dari pola kirim OTOMATIS, bukan dari
 * tab yang dibuka manual satu-satu.
 *
 * Butuh policy dari supabase/migrations/0006_wa_blast.sql (template + kontak)
 * dan 0007_wa_settings.sql (link undangan + template default). Tanpa itu,
 * daftar tampil KOSONG tanpa pesan error — RLS menolak diam-diam (pola yang
 * sama dengan tab Ucapan & migration 0003).
 *
 * Performa untuk ratusan-ribuan baris: render daftar kontak dalam SATU batch
 * innerHTML, dan aksi per baris (centang sent, ganti template, hapus) mengubah
 * BARIS ITU SAJA lewat event delegation — TIDAK re-render seluruh daftar.
 */
(function () {
  const { sb, toast } = window.AdminAPI;

  // Teks BAWAAN yang sopan — dipakai kalau wa_settings.default_template
  // KOSONG (= admin belum pernah menyimpan pengaturan). Paragraf dipisah
  // \n\n; blok tanggal/jam/venue/alamat menyambung dengan SATU \n (tanpa
  // baris kosong di antaranya), sama untuk "Kami yang berbahagia," + nama.
  // Token ${link}/${CPP}/${CPW}/${namaCPP}/${namaCPW} tetap literal string
  // biasa di sini — diganti nanti oleh buildMessage() saat tombol Kirim
  // ditekan (pola sama dengan template kustom). Baris tebal nama pakai
  // ${namaCPW}/${namaCPP} (NAMA LENGKAP), tanda tangan penutup pakai
  // ${CPW}/${CPP} (nama PANGGILAN) — persis pembagian di contoh yang
  // dikirim user, jangan disamakan jadi satu jenis token. Teks & tanggal/
  // venue lain di sini disengaja HARDCODE (bukan dibaca dari config.event)
  // — persis permintaan user, jangan diotak-atik.
  const DEFAULT_TEMPLATE_BODY =
    "Assalamu'alaikum warahmatullahi wabarakatuh.\n\n" +
    "Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada pernikahan kami:\n\n" +
    "*${namaCPW} & ${namaCPP}*\n\n" +
    "🗓️ Selasa, 25 Agustus 2026\n" +
    "🕐 Resepsi: 11.00‐14.00 WIB\n" +
    "📍 Gedung Serbaguna Mayang Arum\n" +
    "Jl. Raya Ciwidey No. KM 27 No. 66, Pasirjambu, Kec. Pasirjambu, Kabupaten Bandung, Jawa Barat 40972\n\n" +
    "Klik link undangan berikut:\n\n" +
    "${link}\n\n" +
    "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.\n\n" +
    "Atas perhatian serta doa baik yang diberikan, kami sampaikan terima kasih.\n\n" +
    "Mohon konfirmasi kehadiran melalui form RSVP pada undangan.\n\n" +
    "Wassalamu'alaikum warahmatullahi wabarakatuh.\n\n" +
    "Kami yang berbahagia,\n" +
    "🤍 ${CPW} & ${CPP}";

  let contacts = [];
  let templates = [];
  // Daftar kirim WA bisa dipecah jadi beberapa list (mis. per kelompok tamu) —
  // migration 0023, tabel wa_lists. TERPISAH dari contact_lists (buku alamat
  // sumber impor, migration 0022) — jangan disamakan namanya jadi "lists" di
  // sini, dipakai nama waLists supaya tidak bentrok dengan `lists` lokal di
  // openFromContacts() (variabel itu punya daftar contact_lists, konsep beda).
  let waLists = [];
  let currentWaListId = null;
  const waListIdKey = `wa-current-list-${window.AdminAPI.tenant.slug}`;

  /** Deep-link ke daftar tertentu lewat query string, mis. /wa?owner=Kontak+Ibu
   * ("+" didekode jadi spasi oleh URLSearchParams, konvensi sama dengan link
   * undangan personal di buildInviteLink()). Dicocokkan case-insensitive ke
   * nama daftar. Cuma dipakai SEKALI di load() pertama — supaya switch manual
   * lewat dropdown sesudahnya tidak ketimpa balik tiap load() dipanggil ulang
   * (CRUD/import/switch list semuanya lewat load() yang sama). */
  let ownerParamApplied = false;
  function ownerParamListName() {
    try {
      const raw = new URLSearchParams(location.search).get("owner");
      return raw ? raw.trim() : null;
    } catch {
      return null;
    }
  }
  const CONTACT_PAGE_SIZES = [20, 50, 100];
  let contactFilter = "all";
  let contactSearch = "";
  let contactPage = 1;
  const pageSizeKey = `wa-page-size-${window.AdminAPI.tenant.slug}`;
  let contactPageSize = Number(localStorage.getItem(pageSizeKey)) || 50;
  if (!CONTACT_PAGE_SIZES.includes(contactPageSize)) contactPageSize = 50;

  // Pengaturan tab WA (migration 0007, baris tunggal id=1) — link undangan
  // yang disisipkan ke token ${link} + template default yang bisa diedit
  // admin. Fallback dipakai kalau baris belum ada (harusnya sudah di-seed
  // migrasi); di-refresh dari DB tiap load().
  let settings = {
    invitation_link: "https://undangan.andipramana.com/",
    default_template: ""
  };

  window.WaBlast = { load };

  /* ---------- Helper ---------- */

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Normalisasi nomor WA ke format internasional 62xx — SATU fungsi untuk
   * SEMUA jalur input (import CSV/Excel & tambah manual). Pola sama dengan
   * normalizeWa() di gift.js: spasi/dash/plus dibuang, "0" depan jadi "62",
   * "8" depan (tanpa 0) diberi "62". */
  function normalizePhone(raw) {
    let d = String(raw ?? "").replace(/[\s-]/g, ""); // spasi/dash -> hilang
    d = d.replace(/^\+/, ""); // +62xxx -> 62xxx
    d = d.replace(/\D/g, ""); // sisa non-digit dibuang
    if (d.startsWith("0")) return "62" + d.slice(1); // 08xxx -> 628xxx
    if (d.startsWith("62")) return d;
    if (d.startsWith("8")) return "62" + d;
    return d;
  }

  /** Nomor dianggap valid kalau dinormalisasi berawalan 62 dengan panjang
   * wajar (62 + 8-13 digit) — sisanya dilewati, tidak disimpan. */
  function isValidPhone(p) {
    return /^62\d{8,13}$/.test(p);
  }

  /** Kontak boleh TANPA nomor sama sekali (mis. nama grup/keluarga yang mau
   * dikirim manual) — beda dari nomor yang diisi tapi salah format. */
  function hasPhone(c) {
    return !!(c && c.phone && String(c.phone).trim());
  }

  /** Bangun pesan akhir dari body template + kontak baris ini. Token dasar
   * sama PERSIS dengan konvensi yang sudah dipakai di gift.js (${tamu}/
   * ${CPP}/${CPW} = nama PANGGILAN) + ${link}. ${namaCPP}/${namaCPW} = nama
   * LENGKAP (couple.*.name) — token tambahan khusus tab WA ini, dipakai
   * kalau template butuh nama lengkap (mis. baris "Mita Meliana & Andi
   * Pramana" tebal di template default), bukan nama panggilan seperti
   * ${CPP}/${CPW}. Replace STRING biasa, aman dari karakter spesial. */
  function buildMessage(body, contact) {
    const couple = window.WEDDING_CONFIG.couple;
    const values = {
      "${tamu}": contact.name,
      "${CPP}": couple.groom.nickname,
      "${CPW}": couple.bride.nickname,
      "${namaCPP}": couple.groom.name,
      "${namaCPW}": couple.bride.name,
      "${link}": buildInviteLink(contact)
    };
    return Object.keys(values).reduce((s, token) => s.split(token).join(values[token]), body);
  }

  /** Link undangan personal per kontak: base URL dari pengaturan + parameter
   * tamu. Parameter WAJIB dari WEDDING_CONFIG.guestParam (BUKAN hardcode "to")
   * — konsisten dengan cara situs membaca tamu (main.js/rsvp.js/gift.js pakai
   * params.get(cfg.guestParam)), jadi kalau config diganti link WA ikut
   * sinkron. Nama tamu di-encode supaya aman sebagai query string, tapi spasi
   * dipakai "+" (bukan "%20") — link ini ikut ditempel MENTAH ke dalam teks
   * pesan WA (bukan cuma jadi href), jadi "%20" akan tampil literal di chat;
   * "+" jauh lebih enak dibaca DAN tetap didekode benar sebagai spasi oleh
   * URLSearchParams di sisi tamu (main.js/rsvp.js/gift.js/admin-qr.js). */
  function buildInviteLink(contact) {
    const base =
      (settings.invitation_link || "").trim() || "https://undangan.andipramana.com/";
    const param = window.WEDDING_CONFIG.guestParam || "to";
    const sep = base.includes("?") ? "&" : "?";
    const name = encodeURIComponent(contact.name).replace(/%20/g, "+");
    return `${base}${sep}${param}=${name}`;
  }

  /** Body template untuk kontak: template_id yang masih ada, default dari
   * pengaturan (kalau sudah diedit admin), atau teks bawaan. */
  function bodyFor(contact) {
    if (contact.template_id != null) {
      const t = templates.find((tpl) => tpl.id === contact.template_id);
      if (t) return t.body;
    }
    return settings.default_template || DEFAULT_TEMPLATE_BODY;
  }

  /** Urutkan array kontak lokal berdasarkan nama, case-insensitive (locale
   * id-ID) — dipanggil setelah load() maupun setelah nama kontak diedit,
   * supaya daftar tetap urut A-Z walau perubahan terjadi tanpa fetch ulang. */
  function sortContactsByName() {
    contacts.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  }

  /* ---------- Daftar kirim (wa_lists) ---------- */

  function renderListBar() {
    const select = document.getElementById("wa-list-select");
    const renameBtn = document.getElementById("wa-list-rename");
    const deleteBtn = document.getElementById("wa-list-delete");
    if (!waLists.length) {
      select.innerHTML = `<option value="">Belum ada daftar</option>`;
      renameBtn.disabled = true;
      deleteBtn.disabled = true;
      return;
    }
    select.innerHTML = waLists.map((l) => `<option value="${l.id}" ${l.id === currentWaListId ? "selected" : ""}>${esc(l.name)}</option>`).join("");
    renameBtn.disabled = false;
    deleteBtn.disabled = false;
  }

  /** Tombol tambah/impor kontak butuh daftar kirim aktif sebagai tujuan —
   * dimatikan kalau belum ada daftar sama sekali (klik label file yang
   * inputnya disabled TIDAK membuka dialog pilih file, jadi aman). */
  function setContactActionsEnabled(enabled) {
    document.getElementById("wa-add").disabled = !enabled;
    document.getElementById("wa-add-from-contacts").disabled = !enabled;
    document.getElementById("wa-import").disabled = !enabled;
    // Bottom navbar (≤800px) meniru state toolbar: item yang tombol
    // toolbarnya dimatikan tampak redup & tak bisa ditekan. "Kelola"
    // selalu aktif (link keluar, bukan aksi tulis).
    ["wa-nav-add", "wa-nav-from", "wa-nav-import"].forEach((id) => {
      const nav = document.getElementById(id);
      if (nav) nav.classList.toggle("wa-bottomnav__item--disabled", !enabled);
    });
  }

  document.getElementById("wa-list-select").addEventListener("change", (e) => {
    currentWaListId = Number(e.target.value) || null;
    if (currentWaListId) localStorage.setItem(waListIdKey, String(currentWaListId));
    contactPage = 1;
    load();
  });

  /* ---------- Load ---------- */

  async function load() {
    const listRes = await window.AdminAPI.query(
      sb.from("wa_lists").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("created_at", { ascending: true }),
      "Permintaan daftar kirim"
    );
    if (listRes.error) {
      const root = document.getElementById("wa-contacts");
      root.innerHTML =
        `<p class="warning">Gagal memuat daftar kirim: ${esc(listRes.error.message)} — pastikan ` +
        `migration <code>0023_wa_contact_lists.sql</code> sudah dijalankan.</p>` +
        `<button type="button" class="btn btn--primary" id="wa-retry">Coba lagi</button>`;
      document.getElementById("wa-retry").addEventListener("click", load);
      return;
    }
    waLists = listRes.data || [];
    let nextListId = null;
    if (!ownerParamApplied) {
      ownerParamApplied = true;
      const ownerName = ownerParamListName();
      if (ownerName) {
        const match = waLists.find((l) => l.name.toLowerCase() === ownerName.toLowerCase());
        if (match) nextListId = match.id;
      }
    }
    if (!nextListId) {
      const saved = Number(localStorage.getItem(waListIdKey));
      nextListId = waLists.some((l) => l.id === saved) ? saved : (waLists[0] ? waLists[0].id : null);
    }
    currentWaListId = nextListId;
    if (currentWaListId) localStorage.setItem(waListIdKey, String(currentWaListId));
    renderListBar();

    if (!currentWaListId) {
      contacts = [];
      templates = [];
      document.getElementById("wa-contacts").innerHTML = `<p class="wa-contact-empty">Belum ada daftar kirim — klik "+ Daftar baru" untuk membuat yang pertama (mis. per kelompok tamu).</p>`;
      setContactActionsEnabled(false);
      updateSummary();
      return;
    }
    setContactActionsEnabled(true);

    const [tplRes, conRes, setRes] = await Promise.all([
      window.AdminAPI.query(
        sb.from("wa_templates").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("created_at", { ascending: true }),
        "Permintaan template"
      ),
      window.AdminAPI.query(
        sb.from("wa_contacts").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("list_id", currentWaListId).order("name", { ascending: true }),
        "Permintaan kontak"
      ),
      window.AdminAPI.query(
        sb.from("wa_settings").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1).maybeSingle(),
        "Permintaan pengaturan"
      )
    ]);

    if (tplRes.error || conRes.error || setRes.error) {
      const msg = (tplRes.error || conRes.error || setRes.error).message;
      const root = document.getElementById("wa-contacts");
      root.innerHTML =
        `<p class="warning">Gagal memuat tab Kirim WA: ${esc(msg)} — pastikan ` +
        `migration <code>0006_wa_blast.sql</code> dan ` +
        `<code>0007_wa_settings.sql</code> sudah dijalankan (RLS menolak ` +
        `diam-diam kalau tabel/policy belum ada).</p>` +
        `<button type="button" class="btn btn--primary" id="wa-retry">Coba lagi</button>`;
      document.getElementById("wa-retry").addEventListener("click", load);
      return;
    }

    templates = tplRes.data || [];
    contacts = conRes.data || [];
    // ORDER BY di query sudah "name" ascending, tapi collation Postgres bisa
    // beda urutan huruf besar/kecil dibanding locale ID — sortir ulang di
    // klien (case-insensitive) supaya urutan konsisten apa pun collation DB-nya.
    sortContactsByName();
    // maybeSingle() mengembalikan null kalau baris belum ada (belum di-seed
    // migrasi) — biarkan fallback awal; kalau ada, pakai isi DB.
    if (setRes.data) settings = setRes.data;
    renderSettings();
    renderTemplates();
    renderContacts();
    updateSummary();
  }

  /* ---------- CRUD daftar kirim (modal) ---------- */

  const listModal = document.getElementById("wa-list-modal");
  const listModalTitle = document.getElementById("wa-list-modal-title");
  const listNameInput = document.getElementById("wa-list-name");
  let editingListId = null;

  function openListModal(existing) {
    editingListId = existing ? existing.id : null;
    listModalTitle.textContent = existing ? "Ganti nama daftar" : "Daftar baru";
    listNameInput.value = existing ? existing.name : "";
    listModal.hidden = false;
    listNameInput.focus();
  }
  document.getElementById("wa-list-new").addEventListener("click", () => openListModal());
  document.getElementById("wa-list-rename").addEventListener("click", () => {
    const current = waLists.find((l) => l.id === currentWaListId);
    if (current) openListModal(current);
  });
  document.getElementById("wa-list-modal-close").addEventListener("click", () => { listModal.hidden = true; });
  listModal.addEventListener("click", (e) => { if (e.target === listModal) listModal.hidden = true; });
  document.getElementById("wa-list-save").addEventListener("click", async () => {
    const name = listNameInput.value.trim();
    if (!name) { toast("Nama daftar wajib diisi.", true); return; }
    if (editingListId) {
      const { error } = await window.AdminAPI.query(
        sb.from("wa_lists").update({ name }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", editingListId),
        "Penyimpanan nama daftar"
      );
      if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
    } else {
      const { data, error } = await window.AdminAPI.query(
        sb.from("wa_lists").insert({ invitation_id: window.AdminAPI.tenant.invitationId, name }).select().single(),
        "Pembuatan daftar"
      );
      if (error) { toast("Gagal membuat daftar: " + error.message, true); return; }
      currentWaListId = data.id;
      localStorage.setItem(waListIdKey, String(data.id));
    }
    listModal.hidden = true;
    toast("Daftar disimpan.");
    await load();
  });

  document.getElementById("wa-list-delete").addEventListener("click", async () => {
    const current = waLists.find((l) => l.id === currentWaListId);
    if (!current) return;
    if (!confirm(`Hapus daftar "${current.name}" beserta ${contacts.length} kontak di dalamnya?\n\nTidak bisa dibatalkan.`)) return;
    const { error } = await window.AdminAPI.query(
      sb.from("wa_lists").delete().eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", current.id),
      "Penghapusan daftar"
    );
    if (error) { toast("Gagal menghapus: " + error.message, true); return; }
    localStorage.removeItem(waListIdKey);
    toast("Daftar dihapus.");
    await load();
  });

  /* ---------- Pengaturan (link undangan + template default) ---------- */

  function renderSettings() {
    document.getElementById("wa-link").value = settings.invitation_link || "";
    // Kosong di DB = belum pernah diedit admin → tampilkan teks bawaan yang
    // SOPAN (bukan kotak kosong), admin tinggal edit kalau mau.
    document.getElementById("wa-default-template").value =
      settings.default_template || DEFAULT_TEMPLATE_BODY;
  }

  async function saveSettings() {
    const link = document.getElementById("wa-link").value.trim();
    const tmpl = document.getElementById("wa-default-template").value;
    const { error } = await window.AdminAPI.query(
      sb.from("wa_settings").update({ invitation_link: link, default_template: tmpl }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1),
      "Penyimpanan pengaturan"
    );
    if (error) {
      toast("Gagal menyimpan pengaturan: " + error.message, true);
      return;
    }
    settings = { invitation_link: link, default_template: tmpl };
    toast("Pengaturan disimpan.");
  }
  document.getElementById("wa-settings-save").addEventListener("click", saveSettings);

  /* ---------- Template kustom ---------- */

  function renderTemplates() {
    const root = document.getElementById("wa-templates");
    const rows = templates
      .map(
        (t, i) => `
      <div class="wa-template-row">
        <div class="wa-template-head">
          <input type="text" class="input wa-template-name" data-t-i="${i}"
                 value="${esc(t.name)}" placeholder="Nama template">
          <button type="button" class="btn btn--tiny btn--danger" data-t-del="${i}"
                  aria-label="Hapus template">Hapus</button>
        </div>
        <textarea class="input wa-template-body" data-t-i="${i}" rows="2"
                  placeholder="Isi pesan. Token: \${tamu} \${CPP} \${CPW}">${esc(t.body)}</textarea>
      </div>`
      )
      .join("");

    root.innerHTML =
      `<p class="wa-templates-title">Template pesan</p>` +
      (templates.length
        ? ""
        : `<p class="muted" style="font-size:.8rem">Belum ada template kustom — semua kontak memakai template Default (bisa diubah lewat template kustom di bawah).</p>`) +
      rows +
      `<button type="button" class="btn btn--ghost" id="wa-template-add">+ tambah template</button>`;

    // Edit field: simpan ke DB saat field ditinggalkan (blur → change).
    root.querySelectorAll(".wa-template-name, .wa-template-body").forEach((input) => {
      input.addEventListener("change", () => saveTemplateField(input));
    });
    root.querySelectorAll("[data-t-del]").forEach((btn) => {
      btn.addEventListener("click", () => removeTemplate(templates[Number(btn.dataset.tDel)]));
    });
    document.getElementById("wa-template-add").addEventListener("click", addTemplate);
  }

  async function saveTemplateField(input) {
    const row = input.closest(".wa-template-row");
    const name = row.querySelector(".wa-template-name").value.trim();
    const body = row.querySelector(".wa-template-body").value;
    const t = templates[Number(input.dataset.tI)];
    if (!name) {
      toast("Nama template tidak boleh kosong.", true);
      renderTemplates(); // kembalikan nilai dari DB
      return;
    }
    const { error } = await window.AdminAPI.query(
      sb.from("wa_templates").update({ name, body }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", t.id),
      "Penyimpanan template"
    );
    if (error) {
      toast("Gagal menyimpan template: " + error.message, true);
      return;
    }
    t.name = name;
    t.body = body;
    // Label dropdown kontak mengikuti nama template — update option text di
    // semua dropdown yang menunjuk template ini TANPA re-render daftar.
    if (input.classList.contains("wa-template-name")) {
      document.querySelectorAll(".wa-contact-template").forEach((sel) => {
        const opt = sel.querySelector(`option[value="${t.id}"]`);
        if (opt) opt.textContent = name;
      });
    }
  }

  async function addTemplate() {
    const { data, error } = await window.AdminAPI.query(
      sb.from("wa_templates").insert({ invitation_id: window.AdminAPI.tenant.invitationId, name: "Template baru", body: "" }).select().single(),
      "Pembuatan template"
    );
    if (error) {
      toast("Gagal membuat template: " + error.message, true);
      return;
    }
    templates.push(data);
    renderTemplates();
    renderContacts(); // dropdown kontak dapat pilihan baru
  }

  async function removeTemplate(t) {
    if (!t) return;
    if (!confirm(`Hapus template "${t.name}"?\n\nKontak yang memakainya akan kembali ke template Default.`)) return;
    const { error, count } = await window.AdminAPI.query(
      sb.from("wa_templates").delete({ count: "exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", t.id),
      "Penghapusan template"
    );
    if (error) {
      toast("Gagal menghapus template: " + error.message, true);
      return;
    }
    if (!count) {
      toast("Tidak ada yang terhapus — pastikan migration 0006 sudah dijalankan.", true);
      return;
    }
    templates = templates.filter((x) => x.id !== t.id);
    // FK on delete set null di DB — sinkronkan state lokal supaya dropdown
    // kontak kembali ke "Default" tanpa fetch ulang.
    contacts.forEach((c) => {
      if (c.template_id === t.id) c.template_id = null;
    });
    renderTemplates();
    renderContacts();
  }

  /* ---------- Daftar kontak (compact, batch render) ---------- */

  function renderContacts() {
    const root = document.getElementById("wa-contacts");
    if (!contacts.length) { root.innerHTML = `<p class="muted">Belum ada kontak — import CSV/Excel atau tambah manual.</p>`; return; }
    const filtered = contacts.map((contact, index) => ({ contact, index })).filter(({ contact }) => {
      const matchesStatus = contactFilter === "all" || (contactFilter === "sent" ? !!contact.sent : !contact.sent);
      const keyword = contactSearch.trim().toLowerCase();
      const matchesSearch = !keyword || contact.name.toLowerCase().includes(keyword) || (contact.phone || "").includes(keyword);
      return matchesStatus && matchesSearch;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / contactPageSize));
    contactPage = Math.min(contactPage, pageCount);
    const visible = filtered.slice((contactPage - 1) * contactPageSize, contactPage * contactPageSize);
    const totalSent = contacts.filter(c => c.sent).length;
    const empty = !contacts.length;
    root.innerHTML = `
      <section class="wa-contact-shell">
        <div class="wa-contact-toolbar">
          <div class="wa-contact-search"><input class="input" id="wa-contact-search" type="search" value="${esc(contactSearch)}" placeholder="Cari nama atau nomor" aria-label="Cari nama atau nomor"><button type="button" id="wa-contact-search-button" aria-label="Fokus pencarian" title="Cari"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg></button></div>
          <div class="wa-status-filters" role="group" aria-label="Filter status">
            ${[["all", `Semua ${contacts.length}`], ["pending", `Belum ${contacts.length-totalSent}`], ["sent", `Terkirim ${totalSent}`]].map(([value, label]) => `<button type="button" class="wa-status-filter${contactFilter===value ? " is-active" : ""}" data-filter="${value}" aria-pressed="${contactFilter===value}">${label}</button>`).join("")}
          </div>
        </div>
        <div class="wa-contact-list">${empty ? `<p class="wa-contact-empty">Belum ada kontak — impor CSV/Excel atau tambah manual.</p>` : visible.map(({contact:c,index:i}) => `
          <article class="wa-contact-row wa-contact-row--${c.sent ? "sent" : "pending"}" data-i="${i}">
            <div class="wa-contact-name"><input type="text" class="wa-contact-name-input" data-i="${i}" value="${esc(c.name)}" aria-label="Nama kontak"></div>
            <div class="wa-contact-row__meta">
              <button type="button" class="wa-contact-sent wa-contact-status" data-i="${i}" data-sent="${!c.sent}" aria-pressed="${c.sent}" title="${c.sent ? "Tandai belum dikirim" : "Tandai terkirim"}">${c.sent ? "Terkirim" : "Belum"}</button>
              <div class="wa-contact-phone"><input type="text" class="wa-contact-phone-input" data-i="${i}" value="${esc(c.phone || "")}" placeholder="Tanpa nomor (opsional)" aria-label="Nomor WhatsApp"></div>
              ${!hasPhone(c) ? `<button type="button" class="wa-contact-pick-phone" data-i="${i}" aria-label="Isi nomor dari daftar kontak untuk ${esc(c.name)}" title="Isi nomor dari daftar kontak"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 8v6M19 11h6"/></svg></button>` : ""}
              ${hasPhone(c)
                ? `<button type="button" class="wa-contact-send wa-wa-icon" data-i="${i}" aria-label="Kirim WhatsApp ke ${esc(c.name)}" title="Kirim WhatsApp"><img src="assets/img/whatsapp.png" alt="" aria-hidden="true"></button>`
                : `<button type="button" class="wa-contact-copy wa-wa-icon" data-i="${i}" aria-label="Salin pesan untuk ${esc(c.name)}" title="Salin pesan (tanpa nomor)"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>`}
            </div>
            <div class="wa-contact-row__bottom">
              <label class="wa-contact-template-wrap"><span>Template</span><select class="wa-contact-template" data-i="${i}" aria-label="Template pesan untuk ${esc(c.name)}"><option value="">Default</option>${templates.map(t => `<option value="${t.id}" ${c.template_id===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label>
              <button type="button" class="wa-contact-del" data-i="${i}" aria-label="Hapus kontak ${esc(c.name)}" title="Hapus kontak">×</button>
            </div>
          </article>`).join("") || `<p class="wa-contact-empty">Tidak ada kontak untuk pencarian atau filter ini.</p>`}</div>
        <footer class="wa-pagination"><span class="wa-contact-result">${visible.length ? ((contactPage-1)*contactPageSize+1) : 0}–${Math.min(contactPage*contactPageSize, filtered.length)} / ${filtered.length}</span><label><span>Tampil</span><select class="input" id="wa-contact-page-size">${CONTACT_PAGE_SIZES.map(n=>`<option value="${n}" ${n===contactPageSize?"selected":""}>${n}</option>`).join("")}</select></label><button class="btn btn--tiny" id="wa-prev" ${contactPage===1?"disabled":""}>Prev</button><span>${contactPage}/${pageCount}</span><button class="btn btn--tiny" id="wa-next" ${contactPage===pageCount?"disabled":""}>Next</button></footer>
      </section>`;
    root.querySelectorAll("[data-filter]").forEach((button) => {
      button.onclick = () => { contactFilter = button.dataset.filter; contactPage = 1; renderContacts(); };
    });
    const searchInput = root.querySelector("#wa-contact-search");
    searchInput.oninput=e=>{
      let nextSearch = e.target.value;
      // Nomor Indonesia yang diawali 0 langsung diseragamkan ke 62 supaya
      // pencarian cocok dengan format nomor kontak yang tersimpan.
      if (/^0\d*$/.test(nextSearch)) nextSearch = normalizePhone(nextSearch);
      const selectionStart = nextSearch.length;
      const selectionEnd = selectionStart;
      contactSearch = nextSearch;
      contactPage = 1;
      renderContacts();
      const restoredInput = root.querySelector("#wa-contact-search");
      restoredInput.focus();
      restoredInput.setSelectionRange(selectionStart, selectionEnd);
    };
    root.querySelector("#wa-contact-search-button").onclick=()=>root.querySelector("#wa-contact-search").focus();
    root.querySelector("#wa-contact-page-size").onchange=e=>{contactPageSize=Number(e.target.value);localStorage.setItem(pageSizeKey,String(contactPageSize));contactPage=1;renderContacts();};
    root.querySelector("#wa-prev").onclick=()=>{contactPage--;renderContacts();}; root.querySelector("#wa-next").onclick=()=>{contactPage++;renderContacts();};
  }

  // Delegasi: SATU listener per jenis aksi untuk seluruh daftar — tidak
  // menempel listener per baris (ribuan baris), dan tidak re-render penuh.
  const contactsEl = document.getElementById("wa-contacts");

  contactsEl.addEventListener("click", (e) => {
    const el = e.target.closest("[data-i]");
    if (!el) return;
    const c = contacts[Number(el.dataset.i)];
    if (!c) return;
    if (el.classList.contains("wa-contact-send")) sendTo(c, el);
    else if (el.classList.contains("wa-contact-copy")) copyMessage(c, el);
    else if (el.classList.contains("wa-contact-pick-phone")) openPickPhone(c);
    else if (el.classList.contains("wa-contact-del")) removeContact(c, el);
    else if (el.classList.contains("wa-contact-sent")) toggleSent(c, el, el.dataset.sent === "true");
  });

  contactsEl.addEventListener("change", (e) => {
    const el = e.target.closest("[data-i]");
    if (!el) return;
    const c = contacts[Number(el.dataset.i)];
    if (!c) return;
    if (el.classList.contains("wa-contact-template")) changeTemplate(c, el);
    else if (el.classList.contains("wa-contact-name-input")) saveContactName(c, el);
    else if (el.classList.contains("wa-contact-phone-input")) saveContactPhone(c, el);
  });

  async function toggleSent(c, control, nextSent) {
    const sent = typeof nextSent === "boolean" ? nextSent : !c.sent;
    const patch = { sent, sent_at: sent ? new Date().toISOString() : null };
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update(patch).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan status"
    );
    if (error) {
      toast("Gagal menyimpan status: " + error.message, true);
      return;
    }
    c.sent = sent;
    c.sent_at = patch.sent_at;
    // Status dapat memindahkan kontak keluar/masuk filter aktif dan mengganti
    // warna badge, jadi render ulang halaman kecil saat ini.
    renderContacts();
    updateSummary();
  }

  /** Edit nama langsung di baris (blur/change pada input) — simpan ke DB,
   * lalu urutkan ulang & render ulang karena posisi baris bisa berubah
   * (daftar selalu urut A-Z, lihat sortContactsByName()). */
  async function saveContactName(c, input) {
    const name = input.value.trim();
    if (!name) {
      toast("Nama tidak boleh kosong.", true);
      input.value = c.name;
      return;
    }
    if (name === c.name) return;
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update({ name }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan nama kontak"
    );
    if (error) {
      toast("Gagal menyimpan nama: " + error.message, true);
      input.value = c.name;
      return;
    }
    c.name = name;
    sortContactsByName();
    renderContacts();
  }

  /** Edit nomor langsung di baris — dinormalisasi & divalidasi dengan fungsi
   * yang SAMA dengan jalur import/tambah manual (normalizePhone/isValidPhone),
   * supaya format tersimpan selalu konsisten (62xxxxxxxxxx). Boleh dikosongkan
   * (kontak jadi "tanpa nomor", tombol kirimnya berubah jadi "Salin pesan") —
   * cuma nomor yang DIISI tapi salah format yang ditolak. */
  async function saveContactPhone(c, input) {
    const raw = input.value.trim();
    const phone = raw ? normalizePhone(raw) : "";
    if (raw && !isValidPhone(phone)) {
      toast("Nomor tidak valid — contoh: 08123456789, +62 812-3456-789, 628123456789.", true);
      input.value = c.phone || "";
      return;
    }
    if (phone === (c.phone || "")) { input.value = phone; return; }
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update({ phone: phone || null }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan nomor kontak"
    );
    if (error) {
      toast("Gagal menyimpan nomor: " + error.message, true);
      input.value = c.phone || "";
      return;
    }
    c.phone = phone || null;
    renderContacts();
  }

  async function changeTemplate(c, sel) {
    const templateId = sel.value === "" ? null : Number(sel.value);
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update({ template_id: templateId }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan template"
    );
    if (error) {
      sel.value = c.template_id ?? "";
      toast("Gagal menyimpan template: " + error.message, true);
      return;
    }
    c.template_id = templateId;
  }

  /** Tombol per-baris: buka wa.me dengan pesan jadi, lalu tandai otomatis
   * "sudah dikirim" (admin masih bisa uncheck manual kalau batal/salah kirim).
   * SENGGA tidak ada loop/aksi massal — satu kontak satu klik manusia. */
  function sendTo(c, btn) {
    if (!isValidPhone(c.phone)) {
      toast("Nomor tidak valid: " + c.phone, true);
      return;
    }
    const msg = buildMessage(bodyFor(c), c);
    window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    if (!c.sent) toggleSent(c, btn, true);
  }

  /** Kontak tanpa nomor (grup/nama saja) tidak punya wa.me — tombolnya jadi
   * "Salin pesan" alih-alih ikon WhatsApp: admin tempel manual ke chat/grup
   * WA pilihannya sendiri. Tetap menandai "sudah dikirim" otomatis, sama
   * seperti sendTo(), supaya rekap status konsisten untuk kedua jenis kontak. */
  async function copyMessage(c, btn) {
    const msg = buildMessage(bodyFor(c), c);
    try {
      await navigator.clipboard.writeText(msg);
    } catch (err) {
      toast("Gagal menyalin pesan: " + err.message, true);
      return;
    }
    toast("Pesan disalin — tempel manual ke WhatsApp/grup.");
    if (!c.sent) toggleSent(c, btn, true);
  }

  async function removeContact(c, btn) {
    if (!c) return;
    if (!confirm(`Hapus kontak "${c.name}"${hasPhone(c) ? ` (${c.phone})` : " (tanpa nomor)"}?\n\nTidak bisa dibatalkan.`)) return;
    btn.disabled = true;
    const { error, count } = await window.AdminAPI.query(
      sb.from("wa_contacts").delete({ count: "exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penghapusan kontak"
    );
    if (error) {
      btn.disabled = false;
      toast("Gagal menghapus: " + error.message, true);
      return;
    }
    if (!count) {
      btn.disabled = false;
      toast("Tidak ada yang terhapus — pastikan migration 0006 sudah dijalankan.", true);
      return;
    }
    contacts = contacts.filter((x) => x.id !== c.id);
    renderContacts();
    updateSummary();
  }

  function updateSummary() {
    const el = document.getElementById("wa-summary");
    if (!currentWaListId) { el.textContent = ""; return; }
    const current = waLists.find((l) => l.id === currentWaListId);
    const done = contacts.reduce((n, c) => n + (c.sent ? 1 : 0), 0);
    el.textContent = `Daftar: ${current ? current.name : "-"} · Total: ${contacts.length} · Sudah dikirim: ${done} · Belum: ${contacts.length - done}`;
  }

  /* ---------- Import CSV / Excel ---------- */

  const fileInput = document.getElementById("wa-import");
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ""; // file yang sama boleh dipilih ulang
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    let result;
    try {
      result = ext === "csv" ? parseCsv(await file.text()) : parseExcel(await file.arrayBuffer());
    } catch (err) {
      toast("Gagal membaca file: " + err.message, true);
      return;
    }
    await previewImport(file.name, result);
  });

  function isHeaderCell(v) {
    return /^(nama|name|nomor|no\.?\s*hp|no\s*hp|phone|no|kontak)$/i.test(String(v ?? "").trim());
  }

  /** CSV sederhana: 2 kolom (nama, nomor), tidak ada koma di dalam kolom nama
   * (skenario umum — tidak perlu parser RFC lengkap). Baris pertama di-skip
   * kalau kedua kolomnya cocok pola header ("nama,nomor/no.hp/phone"). Kolom
   * nomor boleh KOSONG (baris jadi kontak grup/nama saja) — yang dilewati
   * cuma baris tanpa nama, atau nomor yang DIISI tapi format-nya salah. */
  function parseCsv(text) {
    const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    let skipped = 0;
    lines.forEach((line, idx) => {
      const parts = line.split(",").map((s) => s.trim());
      if (idx === 0 && isHeaderCell(parts[0]) && isHeaderCell(parts[1])) return; // header
      const rawPhone = (parts[1] || "").trim();
      const phone = rawPhone ? normalizePhone(rawPhone) : "";
      if (!parts[0] || (rawPhone && !isValidPhone(phone))) {
        skipped++;
        return;
      }
      rows.push({ name: parts[0], phone: phone || null });
    });
    return { rows, skipped };
  }

  /** Excel (.xlsx/.xls) via SheetJS CDN — baca sheet pertama, 2 kolom pertama
   * tiap baris, header di-skip dengan pola yang sama seperti CSV. Kolom nomor
   * boleh kosong, sama seperti parseCsv() di atas. */
  function parseExcel(buf) {
    if (!window.XLSX) throw new Error("Library XLSX belum termuat — periksa koneksi internet.");
    const wb = window.XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
    const rows = [];
    let skipped = 0;
    grid.forEach((rowArr, idx) => {
      const name = String(rowArr[0] ?? "").trim();
      if (idx === 0 && isHeaderCell(name) && isHeaderCell(rowArr[1])) return; // header
      const rawPhone = String(rowArr[1] ?? "").trim();
      const phone = rawPhone ? normalizePhone(rawPhone) : "";
      if (!name || (rawPhone && !isValidPhone(phone))) {
        skipped++;
        return;
      }
      rows.push({ name, phone: phone || null });
    });
    return { rows, skipped };
  }

  /** Preview dulu (jumlah baris + contoh) sebelum benar-benar disimpan —
   * insert berkelompok (chunk 200) supaya permintaan tidak membengkak. */
  async function previewImport(fileName, { rows, skipped }) {
    if (!rows.length) {
      toast(
        `Tidak ada baris valid di "${fileName}" (${skipped} dilewati). Cek format: kolom 1 = nama, kolom 2 = nomor.`,
        true
      );
      return;
    }
    const preview = rows.slice(0, 3).map((r) => `${r.name} — ${r.phone || "(tanpa nomor)"}`).join("\n");
    const ok = confirm(
      `"${fileName}": ${rows.length} kontak terbaca` +
        (skipped ? ` (${skipped} baris dilewati: nama kosong / nomor tidak valid)` : "") +
        `.\n\nContoh:\n${preview}\n\nSimpan semua?`
    );
    if (!ok) return;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await window.AdminAPI.query(
        sb.from("wa_contacts").insert(rows.slice(i, i + 200).map((row) => ({ ...row, invitation_id: window.AdminAPI.tenant.invitationId, list_id: currentWaListId }))),
        "Penyimpanan kontak"
      );
      if (error) {
        toast("Gagal menyimpan: " + error.message, true);
        return;
      }
    }
    toast(`${rows.length} kontak disimpan.`);
    await load(); // muat ulang — state DB adalah sumber kebenaran
  }

  /* ---------- Tambah kontak manual (modal) ---------- */

  const addBtn = document.getElementById("wa-add");
  const addModal = document.getElementById("wa-add-modal");
  const addName = document.getElementById("wa-add-name");
  const addPhone = document.getElementById("wa-add-phone");
  const addSave = document.getElementById("wa-add-save");
  const addClose = document.getElementById("wa-add-close");

  function openAdd() {
    addName.value = "";
    addPhone.value = "";
    addModal.hidden = false;
    addName.focus();
  }
  addBtn.addEventListener("click", openAdd);
  addClose.addEventListener("click", () => { addModal.hidden = true; });
  addModal.addEventListener("click", (e) => {
    if (e.target === addModal) addModal.hidden = true;
  });
  addSave.addEventListener("click", async () => {
    const name = addName.value.trim();
    const rawPhone = addPhone.value.trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : "";
    if (!name) {
      toast("Nama wajib diisi.", true);
      return;
    }
    // Nomor OPSIONAL — kosongkan untuk kontak grup/nama saja (tombol kirimnya
    // jadi "Salin pesan"). Nomor yang DIISI tapi salah format tetap ditolak.
    if (rawPhone && !isValidPhone(phone)) {
      toast("Nomor tidak valid — contoh: 08123456789, +62 812-3456-789, 628123456789.", true);
      return;
    }
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").insert({ invitation_id: window.AdminAPI.tenant.invitationId, list_id: currentWaListId, name, phone: phone || null }),
      "Penyimpanan kontak"
    );
    if (error) {
      toast("Gagal menyimpan: " + error.message, true);
      return;
    }
    addModal.hidden = true;
    toast("Kontak disimpan.");
    await load();
  });

  /* ---------- Tambah dari kontak (buku alamat panel/kontak.js) ---------- */
  // Sumber terpisah dari wa_contacts: contact_lists/contact_list_entries
  // (migration 0022) diisi lewat halaman admin "Kontak" (#/kontak). Modal ini
  // cuma MEMBACA daftar+entrinya untuk dipilih beberapa lalu disalin ke
  // wa_contacts — tidak pernah menulis balik ke contact_list_entries.
  const fcModal = document.getElementById("wa-from-contacts-modal");
  const fcClose = document.getElementById("wa-from-contacts-close");
  const fcListSelect = document.getElementById("wa-from-contacts-list");
  const fcSearch = document.getElementById("wa-from-contacts-search");
  const fcBody = document.getElementById("wa-from-contacts-body");
  const fcSave = document.getElementById("wa-from-contacts-save");
  let fcEntries = [];
  // Set ID (bukan cuma checkbox DOM) supaya pilihan tidak hilang saat hasil
  // pencarian berganti — checkbox yang tersaring keluar dari daftar tampilan
  // TETAP terhitung terpilih ketika muncul lagi (atau saat "Tambahkan" ditekan).
  let fcSelected = new Set();

  document.getElementById("wa-add-from-contacts").addEventListener("click", openFromContacts);
  fcClose.addEventListener("click", () => { fcModal.hidden = true; });

  /* ---------- Bottom navbar (≤800px, markup di wa.html) ----------
   * Semua aksi kontak hidup di bar bawah saat dibuka di HP. Tiap item
   * memicu tombol toolbar pasangannya — SATU sumber logika & disabled:
   * elemen yang disabled tidak menjalankan handler walau di-klik
   * programatik. "Kelola" navigasi lewat klik #wa-manage-contacts
   * (href panel #/kontak diset wa.js). Guard: nav hanya ada di wa.html. */
  [["wa-nav-add", "wa-add"],
   ["wa-nav-from", "wa-add-from-contacts"],
   ["wa-nav-import", "wa-import"],
   ["wa-nav-manage", "wa-manage-contacts"]].forEach(([navId, srcId]) => {
    const nav = document.getElementById(navId);
    const src = document.getElementById(srcId);
    if (!nav || !src) return;
    nav.addEventListener("click", (e) => {
      e.preventDefault();
      if (src.disabled) return;
      src.click();
    });
  });
  fcModal.addEventListener("click", (e) => { if (e.target === fcModal) fcModal.hidden = true; });

  async function openFromContacts() {
    fcListSelect.innerHTML = `<option value="">Memuat daftar…</option>`;
    fcSearch.hidden = true;
    fcSearch.value = "";
    fcBody.innerHTML = "";
    fcSave.hidden = true;
    fcSelected = new Set();
    fcModal.hidden = false;
    const { data, error } = await window.AdminAPI.query(
      sb.from("contact_lists").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("name", { ascending: true }),
      "Permintaan daftar kontak"
    );
    if (error) {
      fcListSelect.innerHTML = `<option value="">Gagal memuat daftar</option>`;
      toast("Gagal memuat daftar kontak: " + error.message, true);
      return;
    }
    const lists = data || [];
    if (!lists.length) {
      fcListSelect.innerHTML = `<option value="">Belum ada daftar kontak</option>`;
      const kontakHref = window.AdminAPI.tenant.path("admin") + "#/kontak";
      fcBody.innerHTML = `<p class="wa-fc-empty">Belum ada daftar kontak — <a href="${kontakHref}" target="_blank" rel="noopener">buat dan isi dulu lewat halaman Kontak</a>.</p>`;
      return;
    }
    fcListSelect.innerHTML = `<option value="">Pilih daftar…</option>` + lists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
  }

  fcListSelect.addEventListener("change", async () => {
    const listId = fcListSelect.value;
    fcSearch.hidden = true;
    fcSearch.value = "";
    fcBody.innerHTML = "";
    fcSave.hidden = true;
    fcSelected = new Set();
    if (!listId) return;
    fcBody.innerHTML = `<p class="wa-fc-empty">Memuat kontak…</p>`;
    const { data, error } = await window.AdminAPI.query(
      sb.from("contact_list_entries").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("list_id", Number(listId)).order("name", { ascending: true }),
      "Permintaan kontak"
    );
    if (error) {
      fcBody.innerHTML = `<p class="wa-fc-empty">Gagal memuat: ${esc(error.message)}</p>`;
      return;
    }
    fcEntries = data || [];
    fcSearch.hidden = !fcEntries.length;
    renderFcEntries();
  });

  fcSearch.addEventListener("input", renderFcEntries);

  function renderFcEntries() {
    fcBody.className = "wa-fc-body";
    if (!fcEntries.length) {
      fcBody.innerHTML = `<p class="wa-fc-empty">Daftar ini belum punya kontak.</p>`;
      fcSave.hidden = true;
      return;
    }
    const keyword = fcSearch.value.trim().toLowerCase();
    const visible = keyword
      ? fcEntries.filter((e) => e.name.toLowerCase().includes(keyword) || e.phone.includes(keyword))
      : fcEntries;
    if (!visible.length) {
      fcBody.innerHTML = `<p class="wa-fc-empty">Tidak ada kontak untuk pencarian ini.</p>`;
      fcSave.hidden = fcSelected.size === 0;
      return;
    }
    const existingPhones = new Set(contacts.map((c) => c.phone));
    fcBody.innerHTML =
      `<div class="wa-fc-toolbar"><span id="wa-fc-count"></span><button type="button" id="wa-fc-toggle-all">Pilih semua</button></div>` +
      `<div>${visible.map((e) => {
        const already = existingPhones.has(e.phone);
        return `<label class="wa-fc-row"><input type="checkbox" data-fc-id="${e.id}" ${already ? "disabled" : ""} ${fcSelected.has(e.id) ? "checked" : ""}><span>${esc(e.name)}${already ? " (sudah ada)" : ""}</span><span class="wa-fc-phone">${esc(e.phone)}</span></label>`;
      }).join("")}</div>`;
    const checkboxes = () => [...fcBody.querySelectorAll("input[data-fc-id]:not(:disabled)")];
    function updateCount() {
      fcBody.querySelector("#wa-fc-count").textContent = fcSelected.size ? `${fcSelected.size} dipilih` : "";
      fcSave.hidden = fcSelected.size === 0;
    }
    checkboxes().forEach((cb) => cb.addEventListener("change", () => {
      const id = Number(cb.dataset.fcId);
      if (cb.checked) fcSelected.add(id); else fcSelected.delete(id);
      updateCount();
    }));
    fcBody.querySelector("#wa-fc-toggle-all").addEventListener("click", () => {
      const boxes = checkboxes();
      const allChecked = boxes.every((c) => c.checked);
      boxes.forEach((c) => {
        c.checked = !allChecked;
        const id = Number(c.dataset.fcId);
        if (c.checked) fcSelected.add(id); else fcSelected.delete(id);
      });
      updateCount();
    });
    updateCount();
  }

  fcSave.addEventListener("click", async () => {
    const rows = fcEntries.filter((e) => fcSelected.has(e.id)).map((e) => ({ invitation_id: window.AdminAPI.tenant.invitationId, list_id: currentWaListId, name: e.name, phone: e.phone }));
    if (!rows.length) return;
    fcSave.disabled = true;
    const { error } = await window.AdminAPI.query(sb.from("wa_contacts").insert(rows), "Penyimpanan kontak");
    fcSave.disabled = false;
    if (error) {
      toast("Gagal menambahkan: " + error.message, true);
      return;
    }
    fcModal.hidden = true;
    toast(`${rows.length} kontak ditambahkan.`);
    await load();
  });

  /* ---------- Isi nomor dari kontak (untuk baris yang belum ada nomor) ---------- */
  // Beda dari "Tambah dari kontak" di atas: modal ini TIDAK membuat baris
  // baru — cuma menempelkan nomor telepon entri buku alamat yang dipilih ke
  // SATU baris wa_contacts yang sudah ada. Nama baris itu TIDAK ikut berubah,
  // cuma phone-nya. Dipicu lewat ikon di baris kontak yang belum punya nomor
  // (lihat renderContacts()). Klik satu baris langsung menerapkan & menutup
  // modal — tidak ada tombol "Simpan" terpisah, beda dari fcSave (checkbox
  // multi-pilih) karena di sini cuma ada SATU target yang diisi.
  const ppModal = document.getElementById("wa-pick-phone-modal");
  const ppClose = document.getElementById("wa-pick-phone-close");
  const ppTargetLabel = document.getElementById("wa-pick-phone-target");
  const ppListSelect = document.getElementById("wa-pick-phone-list");
  const ppSearch = document.getElementById("wa-pick-phone-search");
  const ppBody = document.getElementById("wa-pick-phone-body");
  let ppEntries = [];
  let ppTargetContact = null;

  ppClose.addEventListener("click", () => { ppModal.hidden = true; });
  ppModal.addEventListener("click", (e) => { if (e.target === ppModal) ppModal.hidden = true; });

  async function openPickPhone(c) {
    ppTargetContact = c;
    ppTargetLabel.innerHTML = `Nomor akan diisi untuk <strong>${esc(c.name)}</strong> — nama tidak ikut berubah.`;
    ppListSelect.innerHTML = `<option value="">Memuat daftar…</option>`;
    ppSearch.hidden = true;
    ppSearch.value = "";
    ppBody.innerHTML = "";
    ppModal.hidden = false;
    const { data, error } = await window.AdminAPI.query(
      sb.from("contact_lists").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("name", { ascending: true }),
      "Permintaan daftar kontak"
    );
    if (error) {
      ppListSelect.innerHTML = `<option value="">Gagal memuat daftar</option>`;
      toast("Gagal memuat daftar kontak: " + error.message, true);
      return;
    }
    const lists = data || [];
    if (!lists.length) {
      ppListSelect.innerHTML = `<option value="">Belum ada daftar kontak</option>`;
      const kontakHref = window.AdminAPI.tenant.path("admin") + "#/kontak";
      ppBody.innerHTML = `<p class="wa-fc-empty">Belum ada daftar kontak — <a href="${kontakHref}" target="_blank" rel="noopener">buat dan isi dulu lewat halaman Kontak</a>.</p>`;
      return;
    }
    ppListSelect.innerHTML = `<option value="">Pilih daftar…</option>` + lists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("");
  }

  ppListSelect.addEventListener("change", async () => {
    const listId = ppListSelect.value;
    ppSearch.hidden = true;
    ppSearch.value = "";
    ppBody.innerHTML = "";
    if (!listId) return;
    ppBody.innerHTML = `<p class="wa-fc-empty">Memuat kontak…</p>`;
    const { data, error } = await window.AdminAPI.query(
      sb.from("contact_list_entries").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("list_id", Number(listId)).order("name", { ascending: true }),
      "Permintaan kontak"
    );
    if (error) {
      ppBody.innerHTML = `<p class="wa-fc-empty">Gagal memuat: ${esc(error.message)}</p>`;
      return;
    }
    ppEntries = (data || []).filter((e) => e.phone); // tanpa nomor tidak berguna di sini
    ppSearch.hidden = !ppEntries.length;
    renderPpEntries();
  });

  ppSearch.addEventListener("input", renderPpEntries);

  function renderPpEntries() {
    ppBody.className = "wa-fc-body";
    if (!ppEntries.length) {
      ppBody.innerHTML = `<p class="wa-fc-empty">Daftar ini belum punya kontak bernomor.</p>`;
      return;
    }
    const keyword = ppSearch.value.trim().toLowerCase();
    const visible = keyword
      ? ppEntries.filter((e) => e.name.toLowerCase().includes(keyword) || e.phone.includes(keyword))
      : ppEntries;
    if (!visible.length) {
      ppBody.innerHTML = `<p class="wa-fc-empty">Tidak ada kontak untuk pencarian ini.</p>`;
      return;
    }
    ppBody.innerHTML = visible.map((e) => `<button type="button" class="wa-pp-row" data-pp-id="${e.id}"><span>${esc(e.name)}</span><span class="wa-fc-phone">${esc(e.phone)}</span></button>`).join("");
    ppBody.querySelectorAll("[data-pp-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = ppEntries.find((e) => e.id === Number(btn.dataset.ppId));
        if (entry) applyPickedPhone(entry);
      });
    });
  }

  async function applyPickedPhone(entry) {
    const c = ppTargetContact;
    if (!c) return;
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update({ phone: entry.phone }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan nomor kontak"
    );
    if (error) {
      toast("Gagal mengisi nomor: " + error.message, true);
      return;
    }
    c.phone = entry.phone;
    ppModal.hidden = true;
    toast(`Nomor diisi dari "${entry.name}".`);
    renderContacts();
  }
})();
