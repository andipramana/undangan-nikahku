/**
 * Kado & Amplop — pencatat kado/amplop yang diterima, konsep persis halaman
 * Kontak: tabel `gift_lists` + `gift_list_entries` (migration 0025; timing
 * jadi teks bebas lewat 0026). Beberapa daftar bernama bebas, tiap entri satu
 * pemberi: nama, barang (default 'Amplop Uang' — input clearable: × kecil DI
 * DALAM field mengosongkan default sekali klik), jumlah nominal (ditampilkan
 * dengan pemisah ribuan "1.500.000", boleh kosong), kuantiti (boleh kosong),
 * dan keterangan TEKS BEBAS (mis. "H-, saat akad"). Detail daftar memakai
 * baris compact ala daftar kontak di wa.html — semua field terlihat tanpa
 * scroll horizontal — plus ringkasan total pemberi & total jumlah. Export
 * Excel via SheetJS XLSX (CDN sudah dimuat admin.html).
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

    // Shell halaman + DUA modal (daftar & entri) — wajib statis di sini
    // sebelum handler-handler di bawah memasang listener ke elemennya.
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
            <label class="p-field"><span>Jumlah</span><input class="p-input" id="kd-entry-amount" type="text" inputmode="numeric" placeholder="mis. 500.000 (boleh kosong)"></label>
            <label class="p-field"><span>Kuantiti</span><input class="p-input" id="kd-entry-quantity" type="number" min="0" step="1" inputmode="numeric" placeholder="boleh kosong"></label>
          </div>
          <label class="p-field"><span>Keterangan</span><input class="p-input" id="kd-entry-timing" type="text" placeholder="mis. H-, saat akad (opsional)"></label>
          <button type="button" class="p-btn p-btn--primary" id="kd-entry-save">Simpan</button>
        </div>
      </div>
    `;

    /* ---------- Helper ---------- */

    /** Kuantiti boleh kosong (null), wajib bilangan bulat (kolom integer). */
    function parseNumber(raw) {
      const s = String(raw ?? "").trim();
      if (!s) return { value: null };
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: "Angka tidak valid." };
      if (!Number.isInteger(n)) return { error: "Kuantiti harus bilangan bulat." };
      return { value: n };
    }

    /** Jumlah nominal diketik manusiawi: pemisah ribuan titik ikut diterima
     * ("1.500.000") dan koma sebagai desimal ("250,5") — dibersihkan dulu
     * sebelum divalidasi. Kosong → null (boleh tidak diisi). */
    function parseAmountInput(raw) {
      const s = String(raw ?? "").trim().replaceAll(".", "").replaceAll(" ", "").replace(",", ".");
      if (!s) return { value: null };
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: "Angka tidak valid." };
      if (n < 0) return { error: "Jumlah tidak boleh negatif." };
      return { value: n };
    }

    /** Tampilan Indonesia: 1500000 → "1.500.000", 1500.5 → "1.500,5". */
    function fmtRibuan(n) {
      return new Intl.NumberFormat("id-ID").format(n);
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

    /** Ringkasan atas detail: total pemberi + total jumlah (amount null
     * dilewati; kalau belum ada satupun amount terisi, tampil "—"). */
    function summaryHtml(rows) {
      let sum = 0;
      let adaAmount = false;
      rows.forEach((r) => {
        if (r.amount !== null && r.amount !== undefined) { sum += Number(r.amount); adaAmount = true; }
      });
      return `
        <div class="kd-summary">
          <div class="kd-summary__item"><strong>${rows.length}</strong><span>pemberi</span></div>
          <div class="kd-summary__item"><strong>${adaAmount ? esc(fmtRibuan(sum)) : "&mdash;"}</strong><span>total jumlah</span></div>
        </div>`;
    }

    function renderDetail() {
      const list = st.lists.find((l) => l.id === st.selectedListId);
      const rows = entriesFor(list.id);
      const body = outlet.querySelector("#kd-body");
      body.innerHTML = card(list.name, "", `
        ${summaryHtml(rows)}
        <!-- Grid sel sama lebar (sama dengan .kt-actions Kontak) supaya
             barisnya tidak tampak acak di HP. -->
        <div class="kd-actions">
          <button type="button" class="p-btn p-btn--primary" id="kd-add-entry">+ Tambah kado</button>
          <button type="button" class="p-btn p-btn--ghost" id="kd-export-excel" ${rows.length ? "" : "disabled"}>Export Excel</button>
        </div>
        <button type="button" class="p-btn p-btn--danger kd-danger-row" id="kd-delete-all" ${rows.length ? "" : "disabled"}>Hapus semua kado di daftar ini</button>
        <!-- Baris compact ala daftar kontak wa.html: satu article per
             pemberi, SEMUA field terlihat tanpa scroll horizontal. -->
        <div class="kd-list">
          ${rows.length ? rows.map((e) => `
            <article class="kd-entry" data-entry-id="${e.id}">
              <div class="kd-entry__top">
                <input type="text" class="kd-name-input" data-id="${e.id}" value="${escAttr(e.name)}" placeholder="Nama pemberi" aria-label="Nama pemberi">
                <button type="button" class="kd-del" data-del-entry="${e.id}" aria-label="Hapus kado dari ${escAttr(e.name)}" title="Hapus">&times;</button>
              </div>
              <div class="kd-entry__meta">
                <span class="kd-itemwrap">
                  <input type="text" class="p-input kd-plain kd-item-input" data-id="${e.id}" value="${escAttr(e.item)}" placeholder="Barang (mis. Amplop Uang)" aria-label="Barang">
                  <!-- × clearable DI DALAM input Barang: mengosongkan default
                       'Amplop Uang' sekali klik supaya langsung ketik nama
                       lain — BEDA dari tombol hapus baris (.kd-del) di kanan
                       atas baris. -->
                  <button type="button" class="kd-clear" data-clear="${e.id}" title="Kosongkan nama barang" aria-label="Kosongkan nama barang">&times;</button>
                </span>
                <input type="text" inputmode="numeric" class="p-input kd-plain kd-amount-input" data-id="${e.id}" value="${e.amount !== null && e.amount !== undefined ? escAttr(fmtRibuan(e.amount)) : ""}" placeholder="Jumlah" aria-label="Jumlah (Rp)">
                <input type="number" min="0" step="1" inputmode="numeric" class="p-input kd-plain kd-quantity-input" data-id="${e.id}" value="${escAttr(e.quantity ?? "")}" placeholder="Qty" aria-label="Kuantiti">
              </div>
              <input type="text" class="p-input kd-plain kd-timing-input" data-id="${e.id}" value="${escAttr(e.timing || "")}" placeholder="Keterangan — mis. H-, saat akad (opsional)" aria-label="Keterangan">
            </article>`).join("") : `<p class="p-empty">Belum ada kado di daftar ini — tambah satu-satu lewat tombol di atas.</p>`}
        </div>
      `);
      body.querySelector("#kd-add-entry").addEventListener("click", () => openEntryModal());
      if (rows.length) {
        body.querySelector("#kd-export-excel").addEventListener("click", () => exportExcel(list, rows));
        body.querySelector("#kd-delete-all").addEventListener("click", () => removeAllEntries(list));
      }
      body.querySelectorAll(".kd-name-input").forEach((input) => input.addEventListener("change", () => saveEntryField(Number(input.dataset.id), { name: input.value.trim() }, input)));
      body.querySelectorAll(".kd-item-input").forEach((input) => input.addEventListener("change", () => saveEntryField(Number(input.dataset.id), { item: input.value.trim() }, input)));
      // Jumlah: saat fokus tampil angka mentah (enak diedit), setelah
      // tersimpan kembali terformat pemisah ribuan.
      body.querySelectorAll(".kd-amount-input").forEach((input) => {
        input.addEventListener("focus", () => {
          const e = st.entries.find((x) => x.id === Number(input.dataset.id));
          if (e && e.amount !== null && e.amount !== undefined) input.value = String(e.amount);
        });
        input.addEventListener("change", () =>
          saveEntryField(Number(input.dataset.id), { amount: parseAmountInput(input.value) }, input));
      });
      body.querySelectorAll(".kd-quantity-input").forEach((input) => input.addEventListener("change", () => {
        const { value, error } = parseNumber(input.value);
        if (error) { toast(error, true); input.value = ""; return; }
        saveEntryField(Number(input.dataset.id), { quantity: value }, input);
      }));
      body.querySelectorAll(".kd-timing-input").forEach((input) => input.addEventListener("change", () =>
        saveEntryField(Number(input.dataset.id), { timing: input.value.trim() || null }, input)));
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
    // Preview jumlah di modal juga terformat pemisah ribuan begitu
    // ditinggal (blur) — nilai mentahnya dibersihkan lagi saat simpan.
    const modalAmountInput = outlet.querySelector("#kd-entry-amount");
    modalAmountInput.addEventListener("blur", () => {
      const { value } = parseAmountInput(modalAmountInput.value);
      if (value !== null) modalAmountInput.value = fmtRibuan(value);
    });
    outlet.querySelector("#kd-entry-modal-close").addEventListener("click", () => window.PanelUI.closeModal(entryModal));
    outlet.querySelector("#kd-entry-save").addEventListener("click", async () => {
      const name = outlet.querySelector("#kd-entry-name").value.trim();
      const item = outlet.querySelector("#kd-entry-item").value.trim();
      const amount = parseAmountInput(outlet.querySelector("#kd-entry-amount").value);
      const quantity = parseNumber(outlet.querySelector("#kd-entry-quantity").value);
      const timing = outlet.querySelector("#kd-entry-timing").value.trim() || null;
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

    /** Simpan satu kolom entri (edit inline di daftar). Kosong = null untuk
     * amount/quantity/timing; name wajib terisi; item BOLEH kosong (itu
     * justru tujuan tombol × clear). Return true kalau tersimpan — pemanggil
     * amount bergantung ini untuk memutuskan format ulang tampilan. */
    async function saveEntryField(id, patch, input) {
      const e = st.entries.find((x) => x.id === id);
      if (!e) return false;
      if ("amount" in patch && patch.amount && patch.amount.error) {
        toast(patch.amount.error, true);
        input.value = e.amount !== null && e.amount !== undefined ? String(e.amount) : "";
        return false;
      }
      if ("amount" in patch) patch = { ...patch, amount: patch.amount.value };
      if ("name" in patch && !patch.name) {
        toast("Nama pemberi tidak boleh kosong.", true);
        input.value = e.name;
        return false;
      }
      const { error } = await query(sb.from("gift_list_entries").update(patch).eq("invitation_id", tenant.invitationId).eq("id", id), "Penyimpanan catatan kado");
      if (error) {
        toast("Gagal menyimpan: " + error.message, true);
        if ("timing" in patch) input.value = e.timing || "";
        else if ("item" in patch) input.value = e.item;
        else if ("amount" in patch) input.value = e.amount ?? "";
        else if ("quantity" in patch) input.value = e.quantity ?? "";
        else input.value = e.name;
        return false;
      }
      Object.assign(e, patch);
      // Sinkronkan tampilan field dengan nilai tersimpan.
      if ("timing" in patch) input.value = patch.timing || "";
      else if ("amount" in patch) input.value = patch.amount === null ? "" : fmtRibuan(patch.amount);
      else if ("quantity" in patch) input.value = patch.quantity ?? "";
      return true;
    }

    /** Tombol × DI DALAM input "Barang": kosongkan teks (default 'Amplop
     * Uang') SEKALIGUS simpan item='' — sekali klik, langsung fokus ketik
     * nama barang lain. Ini bukan hapus baris (tombol .kd-del terpisah di
     * kanan atas tiap baris). */
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
        // Angka ditulis MENTAH (tanpa pemisah) supaya Excel membacanya
        // sebagai angka yang bisa di-sum, bukan teks.
        ...rows.map((r) => [r.name, r.item, r.amount ?? "", r.quantity ?? "", r.timing || ""])
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
