/**
 * Kontak — buku alamat admin, terpisah dari wa_contacts (tabel `contact_lists`
 * + `contact_list_entries`, migration 0022). Admin bisa bikin beberapa daftar
 * bernama bebas (mis. "Kontak Mita"), isi tiap daftar manual atau import
 * CSV/Excel/vCard (.vcf, hasil export kontak HP). Daftar ini murni SUMBER —
 * dipakai lewat tombol "Tambah dari kontak" di halaman Kirim WhatsApp
 * (wa.html/wa-blast.js) untuk memilih beberapa kontak lalu disalin ke
 * wa_contacts, tidak menggantikannya.
 *
 * Semua perubahan (tambah/edit/hapus daftar & entri) langsung ke DB per aksi
 * — TIDAK lewat store.js/dirty-tracking, sama seperti pola ucapan.js/
 * wa-blast.js (tabel sendiri, bukan bagian site_content).
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["kontak"] = {
  title: "Kontak",
  group: "Tamu",
  icon: window.PanelUI.icon("contacts"),
  async mount(outlet) {
    // Serumpun Kirim WhatsApp (wa.html): satu alur kerja, satu rasa visual.
    // CSS-nya di panel.css seksi "Halaman Kontak" — halaman lain tak tersentuh.
    outlet.classList.add("wa-family");
    const { esc, escAttr, card } = window.PanelUI;
    const { sb, toast, tenant, query } = window.AdminAPI;

    const st = { lists: [], entries: [], selectedListId: null };

    outlet.innerHTML = `
      <div id="kt-body"></div>
      <div class="p-modal" id="kt-list-modal" hidden>
        <div class="p-modal__panel">
          <div class="p-modal__header"><h3 id="kt-list-modal-title">Daftar baru</h3><button type="button" class="p-modal__close" id="kt-list-modal-close" aria-label="Tutup">&times;</button></div>
          <label class="p-field"><span>Nama daftar</span><input class="p-input" id="kt-list-name" placeholder="mis. Kontak Mita"></label>
          <!-- PIN opsional per daftar — modul bersama PanelListPin
               (list-pin.js): kosong = tidak memakai/mengubah PIN. -->
          ${window.PanelListPin.fieldHtml("kt-list-pin")}
          <button type="button" class="p-btn p-btn--primary" id="kt-list-save">Simpan</button>
        </div>
      </div>
      <div class="p-modal" id="kt-entry-modal" hidden>
        <div class="p-modal__panel">
          <div class="p-modal__header"><h3>Tambah kontak</h3><button type="button" class="p-modal__close" id="kt-entry-modal-close" aria-label="Tutup">&times;</button></div>
          <label class="p-field"><span>Nama</span><input class="p-input" id="kt-entry-name" autocomplete="name"></label>
          <label class="p-field"><span>Nomor telepon</span><input class="p-input" id="kt-entry-phone" inputmode="tel" placeholder="08123456789"></label>
          <button type="button" class="p-btn p-btn--primary" id="kt-entry-save">Simpan kontak</button>
        </div>
      </div>
    `;

    /* ---------- Helper (sama persis dengan wa-blast.js) ---------- */

    function normalizePhone(raw) {
      let d = String(raw ?? "").replace(/[\s-]/g, "");
      d = d.replace(/^\+/, "");
      d = d.replace(/\D/g, "");
      if (d.startsWith("0")) return "62" + d.slice(1);
      if (d.startsWith("62")) return d;
      if (d.startsWith("8")) return "62" + d;
      return d;
    }
    function isValidPhone(p) { return /^62\d{8,13}$/.test(p); }
    function isHeaderCell(v) { return /^(nama|name|nomor|no\.?\s*hp|no\s*hp|phone|no|kontak)$/i.test(String(v ?? "").trim()); }

    function parseCsv(text) {
      const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const rows = [];
      let skipped = 0;
      lines.forEach((line, idx) => {
        const parts = line.split(",").map((s) => s.trim());
        if (idx === 0 && isHeaderCell(parts[0]) && isHeaderCell(parts[1])) return;
        const phone = normalizePhone(parts[1]);
        if (!parts[0] || !isValidPhone(phone)) { skipped++; return; }
        rows.push({ name: parts[0], phone });
      });
      return { rows, skipped };
    }

    function parseExcel(buf) {
      if (!window.XLSX) throw new Error("Library XLSX belum termuat — periksa koneksi internet.");
      const wb = window.XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const grid = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
      const rows = [];
      let skipped = 0;
      grid.forEach((rowArr, idx) => {
        const name = String(rowArr[0] ?? "").trim();
        if (idx === 0 && isHeaderCell(name) && isHeaderCell(rowArr[1])) return;
        const phone = normalizePhone(rowArr[1]);
        if (!name || !isValidPhone(phone)) { skipped++; return; }
        rows.push({ name, phone });
      });
      return { rows, skipped };
    }

    /** vCard (.vcf) — format export kontak HP standar (Google/iPhone/Android),
     * satu file bisa berisi banyak blok BEGIN:VCARD..END:VCARD. Baris lipatan
     * (continuation, diawali spasi/tab) disatukan dulu sebelum diparse. Nama
     * diambil dari FN (nama lengkap format tampilan — paling diandalkan),
     * fallback ke N (Keluarga;Depan;Tengah;Prefix;Suffix) kalau FN kosong.
     * Nomor telepon: baris TEL pertama yang valid per kontak.
     *
     * DUA bug lama yang sering memotong nama jadi cuma "depan + satu kata
     * belakang": (1) FN & N dibaca dengan guard `!name` yang SAMA-SAMA
     * menulis ke variabel `name` sambil jalan — kalau N muncul lebih dulu di
     * file (urutan umum standar vCard: N sebelum FN), FN yang datang
     * belakangan TIDAK PERNAH dipakai walau isinya lebih lengkap. (2) fallback
     * N cuma mengambil parts[1]+parts[0] (Depan+Keluarga), membuang
     * parts[2] (nama TENGAH/tambahan) sama sekali. Sekarang FN & N dibaca
     * terpisah dulu, FN selalu menang kalau ada APAPUN urutannya di file, dan
     * fallback N menggabung SEMUA komponen (prefix, depan, tengah, keluarga,
     * suffix). */
    function parseVcf(text) {
      const unfolded = String(text ?? "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
      const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
      const rows = [];
      let skipped = 0;
      blocks.forEach((block) => {
        const lines = block.split(/END:VCARD/i)[0].split("\n").map((l) => l.trim()).filter(Boolean);
        let fn = "";
        let nParts = null;
        let phone = "";
        lines.forEach((line) => {
          const idx = line.indexOf(":");
          if (idx === -1) return;
          const key = line.slice(0, idx).split(";")[0].toUpperCase();
          const value = line.slice(idx + 1).trim();
          if (key === "FN" && !fn) fn = value;
          if (key === "N" && !nParts) nParts = value.split(";");
          if (key === "TEL" && !phone) {
            const candidate = normalizePhone(value);
            if (isValidPhone(candidate)) phone = candidate;
          }
        });
        const name = fn || (nParts
          ? [nParts[3], nParts[1], nParts[2], nParts[0], nParts[4]].filter(Boolean).join(" ").trim()
          : "");
        if (!name || !isValidPhone(phone)) { skipped++; return; }
        rows.push({ name, phone });
      });
      return { rows, skipped };
    }

    function download(blob, name) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    /* ---------- Load ---------- */

    async function load() {
      const [listRes, entryRes] = await Promise.all([
        query(sb.from("contact_lists").select("*").eq("invitation_id", tenant.invitationId).order("created_at", { ascending: true }), "Permintaan daftar kontak"),
        query(sb.from("contact_list_entries").select("*").eq("invitation_id", tenant.invitationId).order("name", { ascending: true }), "Permintaan kontak")
      ]);
      if (listRes.error || entryRes.error) {
        outlet.querySelector("#kt-body").innerHTML =
          `<p class="p-warning p-warning--danger">Gagal memuat Kontak: ${esc((listRes.error || entryRes.error).message)} — pastikan migration <code>0022_contact_lists.sql</code> sudah dijalankan.</p>` +
          `<button type="button" class="p-btn p-btn--primary" id="kt-retry">Coba lagi</button>`;
        outlet.querySelector("#kt-retry").addEventListener("click", load);
        return;
      }
      st.lists = listRes.data || [];
      st.entries = entryRes.data || [];
      render();
    }

    function entriesFor(listId) {
      return st.entries.filter((e) => e.list_id === listId);
    }

    /* ---------- Render dispatcher ---------- */

    function render() {
      if (st.selectedListId && st.lists.some((l) => l.id === st.selectedListId)) renderDetail();
      else { st.selectedListId = null; renderGrid(); }
    }

    function renderGrid() {
      const body = outlet.querySelector("#kt-body");
      body.innerHTML = card("Daftar kontak", "Buat beberapa daftar (mis. per keluarga/kelompok), lalu pakai tombol \"Tambah dari kontak\" di halaman Kirim WhatsApp untuk memilih kontaknya.", `
        <div class="p-toolbar"><button type="button" class="p-btn p-btn--primary" id="kt-new-list">+ Buat daftar baru</button></div>
        <div id="kt-lists" style="display:grid;gap:.6rem;margin-top:.8rem">
          ${st.lists.length ? st.lists.map((l) => `
            <div class="p-list-row" data-list-id="${l.id}">
              <div class="p-list-row__fields">
                <strong>${esc(l.name)}</strong>
                <span class="p-count-chip">${entriesFor(l.id).length} kontak</span>
              </div>
              <div class="p-list-row__controls">
                <button type="button" class="p-btn p-btn--tiny p-btn--primary" data-open="${l.id}">Buka</button>
                <button type="button" class="p-btn p-btn--tiny" data-rename="${l.id}">Ganti nama</button>
                <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del-list="${l.id}">Hapus</button>
              </div>
            </div>`).join("") : `<p class="p-empty">Belum ada daftar kontak — buat satu untuk mulai import.</p>`}
        </div>
      `);
      body.querySelector("#kt-new-list").addEventListener("click", () => openListModal());
      // Gerbang PIN per daftar (modul bersama PanelListPin) SEBELUM masuk
      // detail — batal/salah → tetap di grid, detail tak dirender.
      body.querySelectorAll("[data-open]").forEach((btn) => btn.addEventListener("click", async () => {
        const list = st.lists.find((l) => l.id === Number(btn.dataset.open));
        if (!list || !(await window.PanelListPin.gate({ kind: "kontak", list }))) return;
        st.selectedListId = list.id;
        render();
      }));
      body.querySelectorAll("[data-rename]").forEach((btn) => btn.addEventListener("click", () => openListModal(st.lists.find((l) => l.id === Number(btn.dataset.rename)))));
      body.querySelectorAll("[data-del-list]").forEach((btn) => btn.addEventListener("click", () => removeList(Number(btn.dataset.delList))));
    }

    function renderDetail() {
      const list = st.lists.find((l) => l.id === st.selectedListId);
      const rows = entriesFor(list.id);
      const body = outlet.querySelector("#kt-body");
      body.innerHTML = card(list.name, `${rows.length} kontak dalam daftar ini.`, `
        <div class="p-toolbar">
          <button type="button" class="p-btn p-btn--ghost" id="kt-back">&larr; Semua daftar</button>
        </div>
        <!-- Aksi daftar dalam GRID sel sama lebar (.kt-actions) — flex-wrap
             berukuran konten membuat barisnya tampak acak di HP (lebar tiap
             tombol beda-beda). Aksi destruktif dipisah baris sendiri. -->
        <div class="kt-actions">
          <button type="button" class="p-btn p-btn--primary" id="kt-add-entry">+ Tambah manual</button>
          <label class="p-btn p-btn--ghost"><span>Impor CSV/Excel</span><input type="file" id="kt-import-file" accept=".csv,.xlsx,.xls" hidden></label>
          <label class="p-btn p-btn--ghost"><span>Impor vCard (.vcf)</span><input type="file" id="kt-import-vcf" accept=".vcf" hidden></label>
          <button type="button" class="p-btn p-btn--ghost" id="kt-export-csv" ${rows.length ? "" : "disabled"}>Export CSV</button>
          <button type="button" class="p-btn p-btn--ghost" id="kt-export-excel" ${rows.length ? "" : "disabled"}>Export Excel</button>
          <!-- Ganti/Pasang PIN dari dalam daftar (PanelListPin) — selalu
               tampil supaya daftar tanpa PIN bisa dipasangi dari sini. -->
          <button type="button" class="p-btn p-btn--ghost" id="kt-change-pin">${list.pin_hash ? "Ganti PIN" : "Pasang PIN"}</button>
        </div>
        <button type="button" class="p-btn p-btn--danger kt-danger-row" id="kt-delete-all" ${rows.length ? "" : "disabled"}>Hapus semua kontak</button>
        <div style="overflow-x:auto">
          <table class="p-table">
            <thead><tr><th>Nama</th><th>Nomor</th><th></th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((e) => `
                <tr data-entry-id="${e.id}">
                  <td><input type="text" class="p-input kt-entry-name-input" data-id="${e.id}" value="${escAttr(e.name)}" aria-label="Nama kontak"></td>
                  <td><input type="text" class="p-input kt-entry-phone-input" data-id="${e.id}" value="${escAttr(e.phone)}" aria-label="Nomor kontak"></td>
                  <td><button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del-entry="${e.id}" aria-label="Hapus kontak ${escAttr(e.name)}">&times;</button></td>
                </tr>`).join("") : `<tr><td colspan="3" class="p-empty">Belum ada kontak di daftar ini — tambah manual atau import.</td></tr>`}
            </tbody>
          </table>
        </div>
      `);
      body.querySelector("#kt-back").addEventListener("click", () => { st.selectedListId = null; render(); });
      body.querySelector("#kt-add-entry").addEventListener("click", () => openEntryModal());
      body.querySelector("#kt-change-pin").addEventListener("click", async () => {
        const berubah = await window.PanelListPin.changeDialog({ kind: "kontak", table: "contact_lists", list, api: window.AdminAPI });
        if (berubah) render();
      });
      body.querySelector("#kt-import-file").addEventListener("change", (e) => handleImportFile(e.target, "std"));
      body.querySelector("#kt-import-vcf").addEventListener("change", (e) => handleImportFile(e.target, "vcf"));
      if (rows.length) {
        body.querySelector("#kt-export-csv").addEventListener("click", () => exportCsv(list, rows));
        body.querySelector("#kt-export-excel").addEventListener("click", () => exportExcel(list, rows));
        body.querySelector("#kt-delete-all").addEventListener("click", () => removeAllEntries(list));
      }
      body.querySelectorAll(".kt-entry-name-input").forEach((input) => input.addEventListener("change", () => saveEntryName(Number(input.dataset.id), input)));
      body.querySelectorAll(".kt-entry-phone-input").forEach((input) => input.addEventListener("change", () => saveEntryPhone(Number(input.dataset.id), input)));
      body.querySelectorAll("[data-del-entry]").forEach((btn) => btn.addEventListener("click", () => removeEntry(Number(btn.dataset.delEntry))));
    }

    /* ---------- Daftar: buat/ganti nama/hapus ---------- */

    const listModal = outlet.querySelector("#kt-list-modal");
    const listNameInput = outlet.querySelector("#kt-list-name");
    let editingListId = null;

    function openListModal(existing) {
      editingListId = existing ? existing.id : null;
      outlet.querySelector("#kt-list-modal-title").textContent = existing ? "Ganti nama daftar" : "Daftar baru";
      listNameInput.value = existing ? existing.name : "";
      outlet.querySelector("#kt-list-pin").value = "";
      window.PanelUI.openModal(listModal);
      listNameInput.focus();
    }
    outlet.querySelector("#kt-list-modal-close").addEventListener("click", () => window.PanelUI.closeModal(listModal));
    outlet.querySelector("#kt-list-save").addEventListener("click", async () => {
      const name = listNameInput.value.trim();
      if (!name) { toast("Nama daftar wajib diisi.", true); return; }
      // PIN opsional (modul PanelListPin): kosong saat edit = JANGAN ubah
      // pin_hash yang sudah ada; diisi = simpan HASH-nya, bukan teksnya.
      const pinRes = await window.PanelListPin.readFieldHash("kt-list-pin");
      if (pinRes.error) { toast(pinRes.error, true); return; }
      if (editingListId) {
        const patch = { name };
        if (pinRes.hash) patch.pin_hash = pinRes.hash;
        const { error } = await query(sb.from("contact_lists").update(patch).eq("invitation_id", tenant.invitationId).eq("id", editingListId), "Penyimpanan nama daftar");
        if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
        st.lists.find((l) => l.id === editingListId).name = name;
      } else {
        const { data, error } = await query(sb.from("contact_lists").insert({ invitation_id: tenant.invitationId, name, pin_hash: pinRes.hash || null }).select().single(), "Pembuatan daftar");
        if (error) { toast("Gagal membuat daftar: " + error.message, true); return; }
        st.lists.push(data);
      }
      window.PanelUI.closeModal(listModal);
      toast("Daftar disimpan.");
      render();
    });

    async function removeList(listId) {
      const list = st.lists.find((l) => l.id === listId);
      if (!list) return;
      const count = entriesFor(listId).length;
      if (!confirm(`Hapus daftar "${list.name}" beserta ${count} kontak di dalamnya?\n\nTidak bisa dibatalkan.`)) return;
      const { error } = await query(sb.from("contact_lists").delete().eq("invitation_id", tenant.invitationId).eq("id", listId), "Penghapusan daftar");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.lists = st.lists.filter((l) => l.id !== listId);
      st.entries = st.entries.filter((e) => e.list_id !== listId);
      toast("Daftar dihapus.");
      render();
    }

    /* ---------- Entri: tambah manual/edit/hapus ---------- */

    const entryModal = outlet.querySelector("#kt-entry-modal");
    const entryName = outlet.querySelector("#kt-entry-name");
    const entryPhone = outlet.querySelector("#kt-entry-phone");

    function openEntryModal() {
      entryName.value = "";
      entryPhone.value = "";
      window.PanelUI.openModal(entryModal);
      entryName.focus();
    }
    outlet.querySelector("#kt-entry-modal-close").addEventListener("click", () => window.PanelUI.closeModal(entryModal));
    outlet.querySelector("#kt-entry-save").addEventListener("click", async () => {
      const name = entryName.value.trim();
      const phone = normalizePhone(entryPhone.value);
      if (!name) { toast("Nama wajib diisi.", true); return; }
      if (!isValidPhone(phone)) { toast("Nomor tidak valid — contoh: 08123456789.", true); return; }
      const { data, error } = await query(sb.from("contact_list_entries").insert({ invitation_id: tenant.invitationId, list_id: st.selectedListId, name, phone }).select().single(), "Penyimpanan kontak");
      if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
      st.entries.push(data);
      window.PanelUI.closeModal(entryModal);
      toast("Kontak disimpan.");
      render();
    });

    async function saveEntryName(id, input) {
      const e = st.entries.find((x) => x.id === id);
      const name = input.value.trim();
      if (!name) { toast("Nama tidak boleh kosong.", true); input.value = e.name; return; }
      const { error } = await query(sb.from("contact_list_entries").update({ name }).eq("invitation_id", tenant.invitationId).eq("id", id), "Penyimpanan nama");
      if (error) { toast("Gagal menyimpan: " + error.message, true); input.value = e.name; return; }
      e.name = name;
    }
    async function saveEntryPhone(id, input) {
      const e = st.entries.find((x) => x.id === id);
      const phone = normalizePhone(input.value);
      if (!isValidPhone(phone)) { toast("Nomor tidak valid — contoh: 08123456789.", true); input.value = e.phone; return; }
      const { error } = await query(sb.from("contact_list_entries").update({ phone }).eq("invitation_id", tenant.invitationId).eq("id", id), "Penyimpanan nomor");
      if (error) { toast("Gagal menyimpan: " + error.message, true); input.value = e.phone; return; }
      e.phone = phone;
      input.value = phone;
    }
    async function removeEntry(id) {
      const e = st.entries.find((x) => x.id === id);
      if (!e || !confirm(`Hapus kontak "${e.name}"?`)) return;
      const { error } = await query(sb.from("contact_list_entries").delete().eq("invitation_id", tenant.invitationId).eq("id", id), "Penghapusan kontak");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.entries = st.entries.filter((x) => x.id !== id);
      render();
    }

    /** Hapus semua kontak di daftar yang SEDANG DIBUKA — daftarnya sendiri
     * (contact_lists) tetap ada, cuma isinya (contact_list_entries) yang
     * dikosongkan. Konfirmasi dua kali (pola sama dengan "Hapus semua
     * ucapan" di ucapan.js) karena tidak bisa dibatalkan. */
    async function removeAllEntries(list) {
      const rows = entriesFor(list.id);
      if (!rows.length) return;
      if (!confirm(`Hapus SEMUA ${rows.length} kontak di daftar "${list.name}"?\n\nTidak bisa dibatalkan.`)) return;
      if (!confirm("Konfirmasi terakhir: hapus semua kontak di daftar ini sekarang?")) return;
      const { error } = await query(sb.from("contact_list_entries").delete().eq("invitation_id", tenant.invitationId).eq("list_id", list.id), "Penghapusan semua kontak");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.entries = st.entries.filter((e) => e.list_id !== list.id);
      toast("Semua kontak di daftar ini dihapus.");
      render();
    }

    /* ---------- Import CSV/Excel/vCard ---------- */

    async function handleImportFile(input, kind) {
      const file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      let result;
      try {
        if (kind === "vcf") {
          result = parseVcf(await file.text());
        } else {
          const ext = file.name.split(".").pop().toLowerCase();
          result = ext === "csv" ? parseCsv(await file.text()) : parseExcel(await file.arrayBuffer());
        }
      } catch (err) {
        toast("Gagal membaca file: " + err.message, true);
        return;
      }
      const { rows, skipped } = result;
      if (!rows.length) {
        toast(`Tidak ada kontak valid di "${file.name}" (${skipped} dilewati).`, true);
        return;
      }
      const preview = rows.slice(0, 3).map((r) => `${r.name} — ${r.phone}`).join("\n");
      const ok = confirm(`"${file.name}": ${rows.length} kontak terbaca` + (skipped ? ` (${skipped} dilewati)` : "") + `.\n\nContoh:\n${preview}\n\nSimpan ke daftar ini?`);
      if (!ok) return;
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await query(
          sb.from("contact_list_entries").insert(rows.slice(i, i + 200).map((r) => ({ ...r, invitation_id: tenant.invitationId, list_id: st.selectedListId }))),
          "Penyimpanan kontak"
        );
        if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
      }
      toast(`${rows.length} kontak disimpan.`);
      await load();
    }

    /* ---------- Export CSV/Excel ---------- */

    function exportCsv(list, rows) {
      const table = [["Nama", "Nomor"], ...rows.map((r) => [r.name, r.phone])];
      download(new Blob(["﻿" + table.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }), `${list.name}.csv`);
    }
    function exportExcel(list, rows) {
      if (!window.XLSX) { toast("Library XLSX belum termuat — periksa koneksi internet.", true); return; }
      const ws = window.XLSX.utils.aoa_to_sheet([["Nama", "Nomor"], ...rows.map((r) => [r.name, r.phone])]);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Kontak");
      window.XLSX.writeFile(wb, `${list.name}.xlsx`);
    }

    await load();
  },
  destroy() {
    // Lepas scope serumpun-WA supaya halaman panel berikutnya kembali kobalt.
    const outlet = document.getElementById("p-outlet-inner");
    if (outlet) outlet.classList.remove("wa-family");
  }
};
