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
  // Token ${link}/${CPP}/${CPW} tetap literal string biasa di sini — diganti
  // nanti oleh buildMessage() saat tombol Kirim ditekan (pola sama dengan
  // template kustom). ${CPP}/${CPW} = nama panggilan (couple.groom/bride.
  // nickname), jadi baris nama render sebagai "Mita & Andi" — bukan nama
  // lengkap. Teks & tanggal/venue lain di sini disengaja HARDCODE (bukan
  // dibaca dari config.event) — persis permintaan user, jangan diotak-atik.
  const DEFAULT_TEMPLATE_BODY =
    "Assalamu'alaikum warahmatullahi wabarakatuh.\n\n" +
    "Dengan memohon rahmat dan ridho Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada pernikahan kami:\n\n" +
    "*${CPW} & ${CPP}*\n\n" +
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

  /** Bangun pesan akhir dari body template + kontak baris ini. Token sama
   * PERSIS dengan konvensi yang sudah dipakai di gift.js (${tamu}/${CPP}/
   * ${CPW}) + ${link} — replace STRING biasa, aman dari karakter spesial. */
  function buildMessage(body, contact) {
    const couple = window.WEDDING_CONFIG.couple;
    const values = {
      "${tamu}": contact.name,
      "${CPP}": couple.groom.nickname,
      "${CPW}": couple.bride.nickname,
      "${link}": buildInviteLink(contact)
    };
    return Object.keys(values).reduce((s, token) => s.split(token).join(values[token]), body);
  }

  /** Link undangan personal per kontak: base URL dari pengaturan + parameter
   * tamu. Parameter WAJIB dari WEDDING_CONFIG.guestParam (BUKAN hardcode "to")
   * — konsisten dengan cara situs membaca tamu (main.js/rsvp.js/gift.js pakai
   * params.get(cfg.guestParam)), jadi kalau config diganti link WA ikut
   * sinkron. Nama tamu di-encode supaya aman sebagai query string. */
  function buildInviteLink(contact) {
    const base =
      (settings.invitation_link || "").trim() || "https://undangan.andipramana.com/";
    const param = window.WEDDING_CONFIG.guestParam || "to";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${param}=${encodeURIComponent(contact.name)}`;
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

  /* ---------- Load ---------- */

  async function load() {
    const [tplRes, conRes, setRes] = await Promise.all([
      window.AdminAPI.query(
        sb.from("wa_templates").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("created_at", { ascending: true }),
        "Permintaan template"
      ),
      window.AdminAPI.query(
        sb.from("wa_contacts").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("created_at", { ascending: true }),
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
    // maybeSingle() mengembalikan null kalau baris belum ada (belum di-seed
    // migrasi) — biarkan fallback awal; kalau ada, pakai isi DB.
    if (setRes.data) settings = setRes.data;
    renderSettings();
    renderTemplates();
    renderContacts();
    updateSummary();
  }

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
      const matchesSearch = !keyword || contact.name.toLowerCase().includes(keyword) || contact.phone.includes(keyword);
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
            <div class="wa-contact-name"><strong>${esc(c.name)}</strong></div>
            <button type="button" class="wa-contact-sent wa-contact-status" data-i="${i}" data-sent="${!c.sent}" aria-pressed="${c.sent}" title="${c.sent ? "Tandai belum dikirim" : "Tandai terkirim"}">${c.sent ? "Terkirim" : "Belum"}</button>
            <button type="button" class="wa-contact-send wa-wa-icon" data-i="${i}" aria-label="Kirim WhatsApp ke ${esc(c.name)}" title="Kirim WhatsApp"><img src="assets/img/whatsapp.png" alt="" aria-hidden="true"></button>
            <div class="wa-contact-phone">${esc(c.phone)}</div>
            <label class="wa-contact-template-wrap"><span>Template</span><select class="wa-contact-template" data-i="${i}" aria-label="Template pesan untuk ${esc(c.name)}"><option value="">Default</option>${templates.map(t => `<option value="${t.id}" ${c.template_id===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label>
            <button type="button" class="wa-contact-del" data-i="${i}" aria-label="Hapus kontak ${esc(c.name)}" title="Hapus kontak">×</button>
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
    else if (el.classList.contains("wa-contact-del")) removeContact(c, el);
    else if (el.classList.contains("wa-contact-sent")) toggleSent(c, el, el.dataset.sent === "true");
  });

  contactsEl.addEventListener("change", (e) => {
    const el = e.target.closest("[data-i]");
    if (!el) return;
    const c = contacts[Number(el.dataset.i)];
    if (!c) return;
    if (el.classList.contains("wa-contact-template")) changeTemplate(c, el);
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

  async function removeContact(c, btn) {
    if (!c) return;
    if (!confirm(`Hapus kontak "${c.name}" (${c.phone})?\n\nTidak bisa dibatalkan.`)) return;
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
    const done = contacts.reduce((n, c) => n + (c.sent ? 1 : 0), 0);
    el.textContent = `Total: ${contacts.length} · Sudah dikirim: ${done} · Belum: ${contacts.length - done}`;
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
   * kalau kedua kolomnya cocok pola header ("nama,nomor/no.hp/phone"). */
  function parseCsv(text) {
    const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows = [];
    let skipped = 0;
    lines.forEach((line, idx) => {
      const parts = line.split(",").map((s) => s.trim());
      if (idx === 0 && isHeaderCell(parts[0]) && isHeaderCell(parts[1])) return; // header
      const phone = normalizePhone(parts[1]);
      if (!parts[0] || !isValidPhone(phone)) {
        skipped++;
        return;
      }
      rows.push({ name: parts[0], phone });
    });
    return { rows, skipped };
  }

  /** Excel (.xlsx/.xls) via SheetJS CDN — baca sheet pertama, 2 kolom pertama
   * tiap baris, header di-skip dengan pola yang sama seperti CSV. */
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
      const phone = normalizePhone(rowArr[1]);
      if (!name || !isValidPhone(phone)) {
        skipped++;
        return;
      }
      rows.push({ name, phone });
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
    const preview = rows.slice(0, 3).map((r) => `${r.name} — ${r.phone}`).join("\n");
    const ok = confirm(
      `"${fileName}": ${rows.length} kontak terbaca` +
        (skipped ? ` (${skipped} baris dilewati: kosong / nomor tidak valid)` : "") +
        `.\n\nContoh:\n${preview}\n\nSimpan semua?`
    );
    if (!ok) return;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await window.AdminAPI.query(
        sb.from("wa_contacts").insert(rows.slice(i, i + 200).map((row) => ({ ...row, invitation_id: window.AdminAPI.tenant.invitationId }))),
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
    const phone = normalizePhone(addPhone.value);
    if (!name) {
      toast("Nama wajib diisi.", true);
      return;
    }
    if (!isValidPhone(phone)) {
      toast("Nomor tidak valid — contoh: 08123456789, +62 812-3456-789, 628123456789.", true);
      return;
    }
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").insert({ invitation_id: window.AdminAPI.tenant.invitationId, name, phone }),
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
})();
