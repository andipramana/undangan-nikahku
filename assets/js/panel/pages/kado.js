/**
 * Kado & Amplop — pencatat kado/amplop yang diterima, konsep persis halaman
 * Kontak: tabel `gift_lists` + `gift_list_entries` (migration 0025), beberapa
 * daftar bernama bebas (mis. "Amplop Pengantin Pria"), tiap entri satu
 * pemberi: nama, barang (default 'Amplop Uang' — inputnya clearable: tombol
 * × kecil DI DALAM field untuk mengosongkan default sekali klik), jumlah
 * nominal & kuantiti (boleh kosong), keterangan H-/H/H+. Export Excel via
 * SheetJS XLSX (CDN sudah dimuat admin.html).
 *
 * Murni fitur internal admin — TIDAK serumpun wa-family, tema kobalt panel.
 * Semua perubahan langsung ke DB per aksi — TIDAK lewat store.js/
 * dirty-tracking, sama seperti pola kontak.js (tabel sendiri, bukan
 * bagian site_content).
 */
window.PanelPages = window.PanelPages || {};
window.PanelPages["kado"] = {
  title: "Kado & Amplop",
  group: "Tamu",
  icon: window.PanelUI.icon("gift"),
  async mount(outlet) {
    const { esc, escAttr, card } = window.PanelUI;
    const { sb, toast, tenant, query } = window.AdminAPI;

    const st = { lists: [], entries: [], selectedListId: null };

    // Dropdown keterangan: PERSIS 3 opsi — diterima sebelum (H-), pas (H),
    // sesudah (H+) hari-H. Null/'' = belum ditandai (opsi kosong).
    const TIMING_OPTIONS = [
      { v: "h-", l: "H-" },
      { v: "h", l: "H" },
      { v: "h+", l: "H+" }
    ];
    const timingLabel = (v) => (TIMING_OPTIONS.find((o) => o.v === v) || { l: "" }).l;

    outlet.innerHTML = `
      <div id="kd-body"></div>
      <div class="p-modal" id="kd-list-modal" hidden>
        <div class="p-modal__panel">
          <div class="p-modal__header"><h3 id="kd-list-modal-title">Daftar baru</h3><button type="button" class="p-modal__close" id="kd-list-modal-close" aria-label="Tutup">&times;</button></div>
          <label class="p-field"><span>Nama daftar</span><input class="p-input" id="kd-list-name" placeholder="mis. Amplop Pengantin Pria"></label>
          <button type="button" class="p-btn p-btn--primary" id="kd-list-save">Simpan</button>
        </div>
      </div>
      <div class="p-modal" id="kd-entry-modal" hidden>
        <div class="p-modal__panel">
          <div class="p-modal__header"><h3>Tambah kado</h3><button type="button" class="p-modal__close" id="kd-entry-modal-close" aria-label="Tutup">&times;</button></div>
          <label class="p-field"><span>Nama pemberi</span><input class="p-input" id="kd-entry-name" autocomplete="name"></label>
          <label class="p-field"><span>Barang</span><input class="p-input" id="kd-entry-item" value="Amplop Uang"></label>
          <div class="p-grid-2">
            <label class="p-field"><span>Jumlah</span><input class="p-input" id="kd-entry-amount" type="number" min="0" step="any" inputmode="numeric" placeholder="boleh kosong"></label>
            <label class="p-field"><span>Kuantiti</span><input class="p-input" id="kd-entry-quantity" type="number" min="0" step="1" inputmode="numeric" placeholder="boleh kosong"></label>
          </div>
          <label class="p-field"><span>Keterangan</span><select class="p-input" id="kd-entry-timing"><option value="">—</option>${TIMING_OPTIONS.map((o) => `<option value="${o.v}">${o.l}</option>`).join("")}</select></label>
          <button type="button" class="p-btn p-btn--primary" id="kd-entry-save">Simpan</button>
        </div>
      </div>
    `;

    /* ---------- Helper ---------- */

    /** Jumlah/kuantiti boleh kosong (null). Angka divalidasi — NaN ditolak,
     * kuantiti wajib bilangan bulat (kolom DB integer). Return { value, error }. */
    function parseNumber(raw, { integer = false } = {}) {
      const s = String(raw ?? "").trim();
      if (!s) return { value: null };
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: "Angka tidak valid." };
      if (integer && !Number.isInteger(n)) return { error: "Kuantiti harus bilangan bulat." };
      return { value: n };
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
        query(sb.from("gift_lists").select("*").eq("invitation_id", tenant.invitationId).order("created_at", { ascending: true }), "Permintaan daftar kado"),
        query(sb.from("gift_list_entries").select("*").eq("invitation_id", tenant.invitationId).order("created_at", { ascending: false }), "Permintaan kado")
      ]);
      if (listRes.error || entryRes.error) {
        outlet.querySelector("#kd-body").innerHTML =
          `<p class="p-warning p-warning--danger">Gagal memuat Kado &amp; Amplop: ${esc((listRes.error || entryRes.error).message)} — pastikan migration <code>0025_gift_lists.sql</code> sudah dijalankan.</p>` +
          `<button type="button" class="p-btn p-btn--primary" id="kd-retry">Coba lagi</button>`;
        outlet.querySelector("#kd-retry").addEventListener("click", load);
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
      const body = outlet.querySelector("#kd-body");
      body.innerHTML = card("Daftar kado & amplop", "Buat beberapa daftar (mis. per pengantin, per keluarga, atau per acara), lalu catat setiap kado/amplop yang masuk satu-satu.", `
        <div class="p-toolbar"><button type="button" class="p-btn p-btn--primary" id="kd-new-list">+ Buat daftar baru</button></div>
        <div id="kd-lists" style="display:grid;gap:.6rem;margin-top:.8rem">
          ${st.lists.length ? st.lists.map((l) => `
            <div class="p-list-row" data-list-id="${l.id}">
              <div class="p-list-row__fields">
                <strong>${esc(l.name)}</strong>
                <span class="kd-count-chip">${entriesFor(l.id).length} catatan</span>
              </div>
              <div class="p-list-row__controls">
                <button type="button" class="p-btn p-btn--tiny p-btn--primary" data-open="${l.id}">Buka</button>
                <button type="button" class="p-btn p-btn--tiny" data-rename="${l.id}">Ganti nama</button>
                <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del-list="${l.id}">Hapus</button>
              </div>
            </div>`).join("") : `<p class="p-empty">Belum ada daftar kado — buat satu untuk mulai mencatat.</p>`}
        </div>
      `);
      body.querySelector("#kd-new-list").addEventListener("click", () => openListModal());
      body.querySelectorAll("[data-open]").forEach((btn) => btn.addEventListener("click", () => { st.selectedListId = Number(btn.dataset.open); render(); }));
      body.querySelectorAll("[data-rename]").forEach((btn) => btn.addEventListener("click", () => openListModal(st.lists.find((l) => l.id === Number(btn.dataset.rename)))));
      body.querySelectorAll("[data-del-list]").forEach((btn) => btn.addEventListener("click", () => removeList(Number(btn.dataset.delList))));
    }

    function renderDetail() {
      const list = st.lists.find((l) => l.id === st.selectedListId);
      const rows = entriesFor(list.id);
      const body = outlet.querySelector("#kd-body");
      body.innerHTML = card(list.name, `${rows.length} catatan dalam daftar ini.`, `
        <div class="p-toolbar">
          <button type="button" class="p-btn p-btn--ghost" id="kd-back">&larr; Semua daftar</button>
        </div>
        <!-- Grid sel sama lebar (sama dengan .kt-actions Kontak) supaya
             barisnya tidak tampak acak di HP. -->
        <div class="kd-actions">
          <button type="button" class="p-btn p-btn--primary" id="kd-add-entry">+ Tambah kado</button>
          <button type="button" class="p-btn p-btn--ghost" id="kd-export-excel" ${rows.length ? "" : "disabled"}>Export Excel</button>
        </div>
        <button type="button" class="p-btn p-btn--danger kd-danger-row" id="kd-delete-all" ${rows.length ? "" : "disabled"}>Hapus semua kado di daftar ini</button>
        <div style="overflow-x:auto">
          <table class="p-table">
            <thead><tr><th>Nama pemberi</th><th>Barang</th><th>Jumlah</th><th>Kuantiti</th><th>Ket.</th><th></th></tr></thead>
            <tbody>
              ${rows.length ? rows.map((e) => `
                <tr data-entry-id="${e.id}">
                  <td><input type="text" class="p-input kd-name-input" data-id="${e.id}" value="${escAttr(e.name)}" aria-label="Nama pemberi"></td>
                  <td><span class="kd-itemwrap">
                    <input type="text" class="p-input kd-item-input" data-id="${e.id}" value="${escAttr(e.item)}" placeholder="mis. Seserahan" aria-label="Barang">
                    <!-- × clearable DI DALAM input Barang: mengosongkan default
                         'Amplop Uang' sekali klik supaya langsung ketik nama
                         lain — BEDA dari tombol hapus baris di kolom terakhir. -->
                    <button type="button" class="kd-clear" data-clear="${e.id}" title="Kosongkan nama barang" aria-label="Kosongkan nama barang">&times;</button>
                  </span></td>
                  <td><input type="number" min="0" step="any" inputmode="numeric" class="p-input kd-amount-input" data-id="${e.id}" value="${escAttr(e.amount ?? "")}" aria-label="Jumlah"></td>
                  <td><input type="number" min="0" step="1" inputmode="numeric" class="p-input kd-quantity-input" data-id="${e.id}" value="${escAttr(e.quantity ?? "")}" aria-label="Kuantiti"></td>
                  <td><select class="p-input kd-timing-select" data-id="${e.id}" aria-label="Keterangan waktu terima">
                    <option value=""${!e.timing ? " selected" : ""}>—</option>
                    ${TIMING_OPTIONS.map((o) => `<option value="${o.v}"${e.timing === o.v ? " selected" : ""}>${o.l}</option>`).join("")}
                  </select></td>
                  <td><button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del-entry="${e.id}" aria-label="Hapus kado dari ${escAttr(e.name)}">&times;</button></td>
                </tr>`).join("") : `<tr><td colspan="6" class="p-empty">Belum ada kado di daftar ini — tambah satu-satu lewat tombol di atas.</td></tr>`}
            </tbody>
          </table>
        </div>
      `);
      body.querySelector("#kd-back").addEventListener("click", () => { st.selectedListId = null; render(); });
      body.querySelector("#kd-add-entry").addEventListener("click", () => openEntryModal());
      if (rows.length) {
        body.querySelector("#kd-export-excel").addEventListener("click", () => exportExcel(list, rows));
        body.querySelector("#kd-delete-all").addEventListener("click", () => removeAllEntries(list));
      }
      body.querySelectorAll(".kd-name-input").forEach((input) => input.addEventListener("change", () => saveEntryField(Number(input.dataset.id), { name: input.value.trim() }, input)));
      body.querySelectorAll(".kd-item-input").forEach((input) => input.addEventListener("change", () => saveEntryField(Number(input.dataset.id), { item: input.value.trim() }, input)));
      body.querySelectorAll(".kd-amount-input").forEach((input) => input.addEventListener("change", () => {
        const { value, error } = parseNumber(input.value);
        if (error) { toast(error, true); input.value = ""; return; }
        saveEntryField(Number(input.dataset.id), { amount: value }, input);
      }));
      body.querySelectorAll(".kd-quantity-input").forEach((input) => input.addEventListener("change", () => {
        const { value, error } = parseNumber(input.value, { integer: true });
        if (error) { toast(error, true); input.value = ""; return; }
        saveEntryField(Number(input.dataset.id), { quantity: value }, input);
      }));
      body.querySelectorAll(".kd-timing-select").forEach((sel) => sel.addEventListener("change", () =>
        saveEntryField(Number(sel.dataset.id), { timing: sel.value || null }, sel)));
      body.querySelectorAll("[data-clear]").forEach((btn) => btn.addEventListener("click", () => clearItem(Number(btn.dataset.clear))));
      body.querySelectorAll("[data-del-entry]").forEach((btn) => btn.addEventListener("click", () => removeEntry(Number(btn.dataset.delEntry))));
    }

    /* ---------- Daftar: buat/ganti nama/hapus ---------- */

    const listModal = outlet.querySelector("#kd-list-modal");
    const listNameInput = outlet.querySelector("#kd-list-name");
    let editingListId = null;

    function openListModal(existing) {
      editingListId = existing ? existing.id : null;
      outlet.querySelector("#kd-list-modal-title").textContent = existing ? "Ganti nama daftar" : "Daftar baru";
      listNameInput.value = existing ? existing.name : "";
      window.PanelUI.openModal(listModal);
      listNameInput.focus();
    }
    outlet.querySelector("#kd-list-modal-close").addEventListener("click", () => window.PanelUI.closeModal(listModal));
    outlet.querySelector("#kd-list-save").addEventListener("click", async () => {
      const name = listNameInput.value.trim();
      if (!name) { toast("Nama daftar wajib diisi.", true); return; }
      if (editingListId) {
        const { error } = await query(sb.from("gift_lists").update({ name }).eq("invitation_id", tenant.invitationId).eq("id", editingListId), "Penyimpanan nama daftar");
        if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
        st.lists.find((l) => l.id === editingListId).name = name;
      } else {
        const { data, error } = await query(sb.from("gift_lists").insert({ invitation_id: tenant.invitationId, name }).select().single(), "Pembuatan daftar");
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
      if (!confirm(`Hapus daftar "${list.name}" beserta ${count} catatan kado di dalamnya?\n\nTidak bisa dibatalkan.`)) return;
      const { error } = await query(sb.from("gift_lists").delete().eq("invitation_id", tenant.invitationId).eq("id", listId), "Penghapusan daftar");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.lists = st.lists.filter((l) => l.id !== listId);
      st.entries = st.entries.filter((e) => e.list_id !== listId);
      toast("Daftar dihapus.");
      render();
    }

    /* ---------- Entri: tambah/edit/hapus ---------- */

    const entryModal = outlet.querySelector("#kd-entry-modal");

    function openEntryModal() {
      outlet.querySelector("#kd-entry-name").value = "";
      outlet.querySelector("#kd-entry-item").value = "Amplop Uang";
      outlet.querySelector("#kd-entry-amount").value = "";
      outlet.querySelector("#kd-entry-quantity").value = "";
      outlet.querySelector("#kd-entry-timing").value = "";
      window.PanelUI.openModal(entryModal);
      outlet.querySelector("#kd-entry-name").focus();
    }
    outlet.querySelector("#kd-entry-modal-close").addEventListener("click", () => window.PanelUI.closeModal(entryModal));
    outlet.querySelector("#kd-entry-save").addEventListener("click", async () => {
      const name = outlet.querySelector("#kd-entry-name").value.trim();
      const item = outlet.querySelector("#kd-entry-item").value.trim();
      const amount = parseNumber(outlet.querySelector("#kd-entry-amount").value);
      const quantity = parseNumber(outlet.querySelector("#kd-entry-quantity").value, { integer: true });
      const timing = outlet.querySelector("#kd-entry-timing").value || null;
      if (!name) { toast("Nama pemberi wajib diisi.", true); return; }
      if (amount.error || quantity.error) { toast(amount.error || quantity.error, true); return; }
      const { data, error } = await query(
        sb.from("gift_list_entries").insert({
          invitation_id: tenant.invitationId, list_id: st.selectedListId,
          name, item, amount: amount.value, quantity: quantity.value, timing
        }).select().single(),
        "Penyimpanan kado"
      );
      if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
      st.entries.unshift(data);
      window.PanelUI.closeModal(entryModal);
      toast("Kado disimpan.");
      render();
    });

    /** Simpan satu kolom entri (inline edit di tabel). Kosong = null untuk
     * amount/quantity/timing; name wajib terisi; item BOLEH kosong (itu
     * justru tujuan tombol × clear). */
    async function saveEntryField(id, patch, input) {
      const e = st.entries.find((x) => x.id === id);
      if (!e) return;
      if ("name" in patch && !patch.name) {
        toast("Nama pemberi tidak boleh kosong.", true);
        input.value = e.name;
        return;
      }
      const { error } = await query(sb.from("gift_list_entries").update(patch).eq("invitation_id", tenant.invitationId).eq("id", id), "Penyimpanan catatan kado");
      if (error) {
        toast("Gagal menyimpan: " + error.message, true);
        if ("timing" in patch) input.value = e.timing || "";
        else if (patch.name !== undefined) input.value = e.name;
        else if (patch.item !== undefined) input.value = e.item;
        else input.value = e[patch.amount !== undefined ? "amount" : "quantity"] ?? "";
        return;
      }
      Object.assign(e, patch);
      if (patch.timing !== undefined) input.value = patch.timing || "";
    }

    /** Tombol × DI DALAM input "Barang": kosongkan teks (default 'Amplop
     * Uang') SEKALIGUS simpan item='' — sekali klik, langsung fokus ketik
     * nama barang lain. Ini bukan hapus baris (tombol itu terpisah di kolom
     * terakhir tabel). */
    async function clearItem(id) {
      const input = outlet.querySelector(`.kd-item-input[data-id="${id}"]`);
      await saveEntryField(id, { item: "" }, input);
      if (input && document.activeElement !== input) input.focus();
    }

    async function removeEntry(id) {
      const e = st.entries.find((x) => x.id === id);
      if (!e || !confirm(`Hapus catatan kado dari "${e.name}"?`)) return;
      const { error } = await query(sb.from("gift_list_entries").delete().eq("invitation_id", tenant.invitationId).eq("id", id), "Penghapusan kado");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.entries = st.entries.filter((x) => x.id !== id);
      render();
    }

    /** Hapus semua kado di daftar yang SEDANG DIBUKA — daftarnya sendiri
     * tetap ada. Dua konfirmasi (pola "Hapus semua kontak" kontak.js). */
    async function removeAllEntries(list) {
      const rows = entriesFor(list.id);
      if (!rows.length) return;
      if (!confirm(`Hapus SEMUA ${rows.length} catatan kado di daftar "${list.name}"?\n\nTidak bisa dibatalkan.`)) return;
      if (!confirm("Konfirmasi terakhir: hapus semua catatan di daftar ini sekarang?")) return;
      const { error } = await query(sb.from("gift_list_entries").delete().eq("invitation_id", tenant.invitationId).eq("list_id", list.id), "Penghapusan semua kado");
      if (error) { toast("Gagal menghapus: " + error.message, true); return; }
      st.entries = st.entries.filter((e) => e.list_id !== list.id);
      toast("Semua catatan di daftar ini dihapus.");
      render();
    }

    /* ---------- Export Excel ---------- */

    function exportExcel(list, rows) {
      if (!window.XLSX) { toast("Library XLSX belum termuat — periksa koneksi internet.", true); return; }
      const ws = window.XLSX.utils.aoa_to_sheet([
        ["Nama Pemberi", "Barang", "Jumlah", "Kuantiti", "Keterangan"],
        ...rows.map((r) => [r.name, r.item, r.amount ?? "", r.quantity ?? "", timingLabel(r.timing)])
      ]);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Kado");
      window.XLSX.writeFile(wb, `${list.name}.xlsx`);
    }

    await load();
  },
  destroy() {
    // Tanpa class pasangan-mount — tidak ada yang perlu dilepas.
  }
};
