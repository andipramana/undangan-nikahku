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
  // \n\n; baris "…undangan digital kami di:" menyambung LANGSUNG ke baris
  // link (SATU \n, tanpa baris kosong di antaranya). Token ${tamu}/${CPP}/
  // ${CPW}/${link} tetap literal string biasa di sini — diganti nanti oleh
  // buildMessage() saat tombol Kirim ditekan (pola sama dengan template kustom).
  const DEFAULT_TEMPLATE_BODY =
    "Assalamu'alaikum warahmatullahi wabarakatuh,\n\n" +
    "Yth. ${tamu},\n\n" +
    "Dengan penuh sukacita dan rasa syukur, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk menghadiri acara pernikahan kami, ${CPP} & ${CPW}.\n\n" +
    "Informasi lengkap acara dan konfirmasi kehadiran dapat dilihat pada undangan digital kami di:\n${link}\n\n" +
    "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir untuk memberikan doa restu.\n\n" +
    "Atas perhatian dan kehadirannya, kami ucapkan terima kasih.\n\n" +
    "Wassalamu'alaikum warahmatullahi wabarakatuh.";

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
    root.innerHTML = `
      <section class="wa-contact-shell">
        <div class="wa-contact-toolbar">
          <label class="wa-contact-search"><span>Cari kontak</span><input class="input" id="wa-contact-search" type="search" value="${esc(contactSearch)}" placeholder="Nama atau nomor"></label>
          <div class="wa-contact-toolbar__filters">
            <label><span>Status</span><select class="input" id="wa-contact-filter"><option value="all" ${contactFilter==="all"?"selected":""}>Semua (${contacts.length})</option><option value="pending" ${contactFilter==="pending"?"selected":""}>Belum (${contacts.length-totalSent})</option><option value="sent" ${contactFilter==="sent"?"selected":""}>Terkirim (${totalSent})</option></select></label>
            <label><span>Tampil</span><select class="input" id="wa-contact-page-size">${CONTACT_PAGE_SIZES.map(n=>`<option value="${n}" ${n===contactPageSize?"selected":""}>${n} / halaman</option>`).join("")}</select></label>
          </div>
        </div>
        <p class="wa-contact-result muted">Menampilkan ${visible.length ? ((contactPage-1)*contactPageSize+1) : 0}–${Math.min(contactPage*contactPageSize, filtered.length)} dari ${filtered.length} kontak</p>
        <div class="wa-contact-list">${visible.map(({contact:c,index:i}) => `
          <article class="wa-contact-row wa-contact-row--${c.sent ? "sent" : "pending"}" data-i="${i}">
            <input type="checkbox" class="wa-contact-sent" data-i="${i}" ${c.sent ? "checked" : ""} aria-label="Tandai ${esc(c.name)} sudah dikirim">
            <div class="wa-contact-name"><strong>${esc(c.name)}</strong><small>${esc(c.phone)}</small></div>
            <span class="wa-contact-status">${c.sent ? "Terkirim" : "Belum dikirim"}</span>
            <label class="wa-contact-template-wrap"><span>Template</span><select class="wa-contact-template" data-i="${i}" aria-label="Template pesan untuk ${esc(c.name)}"><option value="">Default</option>${templates.map(t => `<option value="${t.id}" ${c.template_id===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label>
            <div class="wa-contact-actions"><button type="button" class="btn btn--tiny wa-contact-send" data-i="${i}" title="Buka WhatsApp dengan pesan siap kirim">Kirim WA</button><button type="button" class="btn btn--tiny btn--danger wa-contact-del" data-i="${i}" aria-label="Hapus kontak ${esc(c.name)}">Hapus</button></div>
          </article>`).join("") || `<p class="muted">Tidak ada kontak untuk filter ini.</p>`}</div>
        <nav class="wa-pagination" aria-label="Halaman kontak"><button class="btn btn--tiny" id="wa-prev" ${contactPage===1?"disabled":""}>← Sebelumnya</button><span>Halaman ${contactPage} dari ${pageCount}</span><button class="btn btn--tiny" id="wa-next" ${contactPage===pageCount?"disabled":""}>Berikutnya →</button></nav>
      </section>`;
    root.querySelector("#wa-contact-search").oninput=e=>{contactSearch=e.target.value;contactPage=1;renderContacts();};
    root.querySelector("#wa-contact-filter").onchange=e=>{contactFilter=e.target.value;contactPage=1;renderContacts();};
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
  });

  contactsEl.addEventListener("change", (e) => {
    const el = e.target.closest("[data-i]");
    if (!el) return;
    const c = contacts[Number(el.dataset.i)];
    if (!c) return;
    if (el.classList.contains("wa-contact-sent")) toggleSent(c, el);
    else if (el.classList.contains("wa-contact-template")) changeTemplate(c, el);
  });

  async function toggleSent(c, box) {
    const sent = box.checked;
    const patch = { sent, sent_at: sent ? new Date().toISOString() : null };
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update(patch).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", c.id),
      "Penyimpanan status"
    );
    if (error) {
      box.checked = !sent; // rollback UI — DB tidak berubah
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
    if (!c.sent) {
      const box = btn.closest(".wa-contact-row").querySelector(".wa-contact-sent");
      if (box) toggleSent(c, box);
    }
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
