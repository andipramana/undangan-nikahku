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
 * Butuh policy dari supabase/migrations/0006_wa_blast.sql. Tanpa itu, daftar
 * tampil KOSONG tanpa pesan error — RLS menolak diam-diam (pola yang sama
 * dengan tab Ucapan & migration 0003).
 *
 * Performa untuk ratusan-ribuan baris: render daftar kontak dalam SATU batch
 * innerHTML, dan aksi per baris (centang sent, ganti template, hapus) mengubah
 * BARIS ITU SAJA lewat event delegation — TIDAK re-render seluruh daftar.
 */
(function () {
  const { sb, toast } = window.AdminAPI;

  // Fallback kalau wa_contacts.template_id NULL ("Default") — konseptual, tidak
  // perlu baris DB terpisah. Admin boleh mengubahnya lewat template kustom,
  // tapi selalu ada teks ini kalau kontak tidak menunjuk template apa pun.
  const DEFAULT_TEMPLATE_BODY =
    "Halo ${tamu}! Kami mengundang kamu ke pernikahan ${CPP} & ${CPW}. Info lengkap & RSVP di link ini ya 🙏";

  let contacts = [];
  let templates = [];

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
   * ${CPW}) — replace STRING biasa, aman dari karakter spesial di nama. */
  function buildMessage(body, contact) {
    const couple = window.WEDDING_CONFIG.couple;
    const values = {
      "${tamu}": contact.name,
      "${CPP}": couple.groom.nickname,
      "${CPW}": couple.bride.nickname
    };
    return Object.keys(values).reduce((s, token) => s.split(token).join(values[token]), body);
  }

  /** Body template untuk kontak: template_id yang masih ada, atau default. */
  function bodyFor(contact) {
    if (contact.template_id != null) {
      const t = templates.find((tpl) => tpl.id === contact.template_id);
      if (t) return t.body;
    }
    return DEFAULT_TEMPLATE_BODY;
  }

  /* ---------- Load ---------- */

  async function load() {
    const [tplRes, conRes] = await Promise.all([
      window.AdminAPI.query(
        sb.from("wa_templates").select("*").order("created_at", { ascending: true }),
        "Permintaan template"
      ),
      window.AdminAPI.query(
        sb.from("wa_contacts").select("*").order("created_at", { ascending: true }),
        "Permintaan kontak"
      )
    ]);

    if (tplRes.error || conRes.error) {
      const msg = (tplRes.error || conRes.error).message;
      const root = document.getElementById("wa-contacts");
      root.innerHTML =
        `<p class="warning">Gagal memuat tab Kirim WA: ${esc(msg)} — pastikan ` +
        `migration <code>0006_wa_blast.sql</code> sudah dijalankan (RLS menolak ` +
        `diam-diam kalau tabel/policy belum ada).</p>` +
        `<button type="button" class="btn btn--primary" id="wa-retry">Coba lagi</button>`;
      document.getElementById("wa-retry").addEventListener("click", load);
      return;
    }

    templates = tplRes.data || [];
    contacts = conRes.data || [];
    renderTemplates();
    renderContacts();
    updateSummary();
  }

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
      sb.from("wa_templates").update({ name, body }).eq("id", t.id),
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
      sb.from("wa_templates").insert({ name: "Template baru", body: "" }).select().single(),
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
      sb.from("wa_templates").delete({ count: "exact" }).eq("id", t.id),
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
    if (!contacts.length) {
      root.innerHTML = `<p class="muted">Belum ada kontak — import CSV/Excel atau tambah manual.</p>`;
      return;
    }
    root.innerHTML = contacts
      .map(
        (c, i) => `
      <div class="wa-contact-row" data-i="${i}">
        <input type="checkbox" class="wa-contact-sent" data-i="${i}" ${c.sent ? "checked" : ""}
               aria-label="Tandai sudah dikirim">
        <div class="wa-contact-name">
          <strong>${esc(c.name)}</strong>
          <small>${esc(c.phone)}</small>
        </div>
        <select class="wa-contact-template" data-i="${i}" title="Template pesan">
          <option value="">Default</option>
          ${templates.map((t) => `<option value="${t.id}" ${c.template_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
        </select>
        <button type="button" class="btn btn--tiny wa-contact-send" data-i="${i}"
                title="Buka WhatsApp dengan pesan siap kirim">Kirim</button>
        <button type="button" class="btn btn--tiny btn--danger wa-contact-del" data-i="${i}"
                aria-label="Hapus kontak">&times;</button>
      </div>`
      )
      .join("");
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
      sb.from("wa_contacts").update(patch).eq("id", c.id),
      "Penyimpanan status"
    );
    if (error) {
      box.checked = !sent; // rollback UI — DB tidak berubah
      toast("Gagal menyimpan status: " + error.message, true);
      return;
    }
    c.sent = sent;
    c.sent_at = patch.sent_at;
    updateSummary();
  }

  async function changeTemplate(c, sel) {
    const templateId = sel.value === "" ? null : Number(sel.value);
    const { error } = await window.AdminAPI.query(
      sb.from("wa_contacts").update({ template_id: templateId }).eq("id", c.id),
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
      sb.from("wa_contacts").delete({ count: "exact" }).eq("id", c.id),
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
        sb.from("wa_contacts").insert(rows.slice(i, i + 200)),
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
      sb.from("wa_contacts").insert({ name, phone }),
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
