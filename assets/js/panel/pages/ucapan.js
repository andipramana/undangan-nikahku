/** Ucapan & RSVP — moderasi ucapan tamu, blokir perangkat, dan export.
 * Tabel `wishes` bukan bagian site_content (tabelnya sendiri) — halaman ini
 * TIDAK lewat store.js, sama seperti perilaku lama (wishes.js). */
window.PanelPages = window.PanelPages || {};
window.PanelPages["ucapan"] = {
  title: "Ucapan & RSVP",
  group: "Tamu",
  icon: window.PanelUI.icon("message"),
  state: null,
  async mount(outlet) {
    const { esc, escAttr, card } = window.PanelUI;
    const { sb, toast, tenant, query } = window.AdminAPI;
    const LABEL = { hadir: "Hadir", tidak_hadir: "Tidak Hadir", ragu: "Ragu-ragu" };
    const PAGE_SIZES = [10, 20, 50, 100];
    const PAGE_SIZE_KEY = "panel-wishes-page-size";
    let pageSize = Number(localStorage.getItem(PAGE_SIZE_KEY)) || 20;
    if (!PAGE_SIZES.includes(pageSize)) pageSize = 20;
    const st = { wishes: [], total: 0, page: 1, moderation: { banned_words: "" }, blocked: [], exportWishes: [] };
    this.state = st;

    outlet.innerHTML = `
      ${card("Moderasi", "Pisahkan kata/frasa terlarang dengan koma. Pesan atau nama yang memuatnya tidak diposting.", `
        <label class="p-field"><span>Kata/frasa terlarang</span><input class="p-input" id="wi-banned" placeholder="contoh: kasar1, kasar2"></label>
        <button type="button" class="p-btn p-btn--primary" id="wi-banned-save">Simpan filter</button>
      `)}
      ${card("Perangkat diblokir", "Pemblokiran memakai token acak browser, bukan alamat IP.", `<div id="wi-blocked"></div>`)}
      <div id="wi-summary"></div>
      <div style="display:grid;gap:.6rem">
        <div style="display:flex;gap:.5rem">
          <button type="button" class="p-btn p-btn--ghost" id="wi-refresh">↻ Refresh</button>
          <button type="button" class="p-btn p-btn--ghost" id="wi-export">Export semua</button>
        </div>
        <button type="button" class="p-btn p-btn--danger" id="wi-delete-all" style="width:100%">Hapus semua ucapan</button>
      </div>
      <div id="wi-list"></div>
      <nav class="p-toolbar" id="wi-pagination" aria-label="Halaman ucapan"></nav>
      <div class="p-modal" id="wi-export-modal" hidden>
        <div class="p-modal__panel">
          <div class="p-modal__header"><h3>Export semua ucapan</h3><button type="button" class="p-modal__close" id="wi-export-close" aria-label="Tutup">&times;</button></div>
          <p class="p-muted" id="wi-export-count"></p>
          <div class="p-toolbar"><button type="button" class="p-btn p-btn--primary" id="wi-export-csv">Unduh CSV</button><button type="button" class="p-btn p-btn--ghost" id="wi-export-png">Unduh PNG</button></div>
          <p class="p-muted" id="wi-export-status"></p>
          <div id="wi-export-preview"></div>
        </div>
      </div>
    `;

    function fmtDate(iso) { return iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : ""; }
    function chipVariant(a) { return a === "hadir" ? "ok" : a === "ragu" ? "warn" : "danger"; }
    function wishesTable() { return (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes"; }

    async function load(nextPage = st.page) {
      st.page = Math.max(1, nextPage);
      const from = (st.page - 1) * pageSize;
      const [wishRes, modRes, blockRes] = await Promise.all([
        query(sb.from(wishesTable()).select("*", { count: "exact" }).eq("invitation_id", tenant.invitationId).order("created_at", { ascending: false }).range(from, from + pageSize - 1), "Permintaan ucapan"),
        query(sb.from("wish_moderation").select("*").eq("invitation_id", tenant.invitationId).maybeSingle(), "Permintaan moderasi"),
        query(sb.from("wish_blocks").select("device_token,blocked_at,blocked_wish_id").eq("invitation_id", tenant.invitationId).order("blocked_at", { ascending: false }), "Permintaan perangkat diblokir")
      ]);
      if (wishRes.error || modRes.error || blockRes.error) {
        outlet.querySelector("#wi-list").innerHTML = `<p class="p-warning p-warning--danger">Gagal memuat ucapan: ${esc((wishRes.error || modRes.error || blockRes.error).message)}</p><button type="button" class="p-btn p-btn--primary" id="wi-retry">Coba lagi</button>`;
        outlet.querySelector("#wi-retry").addEventListener("click", () => load(st.page));
        return;
      }
      st.wishes = wishRes.data || [];
      st.total = wishRes.count || 0;
      st.moderation = modRes.data || { banned_words: "" };
      st.blocked = blockRes.data || [];
      paint();
    }

    function paint() {
      outlet.querySelector("#wi-banned").value = st.moderation.banned_words || "";
      const blockedBox = outlet.querySelector("#wi-blocked");
      blockedBox.innerHTML = st.blocked.length
        ? st.blocked.map((b, i) => `<div class="p-list-row" style="margin-bottom:.4rem"><div class="p-list-row__fields"><strong>Perangkat #${i + 1}</strong><span class="p-muted" style="font-size:.72rem">Diblokir ${fmtDate(b.blocked_at)}</span></div><div class="p-list-row__controls"><button type="button" class="p-btn p-btn--tiny p-btn--ghost" data-unblock="${escAttr(b.device_token)}">Unblock</button></div></div>`).join("")
        : `<p class="p-empty">Belum ada perangkat yang diblokir.</p>`;
      blockedBox.querySelectorAll("[data-unblock]").forEach((b) => b.addEventListener("click", () => unblock(b.dataset.unblock)));

      const tally = { hadir: 0, tidak_hadir: 0, ragu: 0 };
      let guests = 0;
      st.wishes.forEach((w) => { if (tally[w.attendance] !== undefined) tally[w.attendance]++; if (w.attendance === "hadir") guests += Number(w.guest_count) || 0; });
      outlet.querySelector("#wi-summary").innerHTML = `<p class="p-hint"><strong>${st.total}</strong> ucapan · Hadir ${tally.hadir} · Ragu ${tally.ragu} · Tidak hadir ${tally.tidak_hadir} · ${guests} orang hadir di halaman ini</p>`;

      const list = outlet.querySelector("#wi-list");
      list.innerHTML = st.wishes.length
        ? st.wishes.map((w, i) => `
          <div class="p-list-row" style="margin-bottom:.5rem">
            <div class="p-list-row__fields">
              <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
                <strong>${esc(w.name)}</strong>
                ${window.PanelUI.badge(LABEL[w.attendance] || w.attendance || "-", chipVariant(w.attendance))}
                <span class="p-muted" style="font-size:.76rem">${Number(w.guest_count) || 1} orang · ${fmtDate(w.created_at)}</span>
              </div>
              <p style="margin:.3rem 0 0">${esc(w.message)}</p>
            </div>
            <div class="p-list-row__controls">
              <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}">Hapus</button>
              ${w.device_token ? `<button type="button" class="p-btn p-btn--tiny p-btn--danger" data-block="${i}">Hapus &amp; blokir</button>` : ""}
            </div>
          </div>`).join("")
        : `<p class="p-empty">Belum ada ucapan pada halaman ini.</p>`;
      list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => remove(st.wishes[Number(b.dataset.del)], false)));
      list.querySelectorAll("[data-block]").forEach((b) => b.addEventListener("click", () => remove(st.wishes[Number(b.dataset.block)], true)));

      const pages = Math.max(1, Math.ceil(st.total / pageSize));
      outlet.querySelector("#wi-pagination").innerHTML = `
        <label class="p-field" style="flex-direction:row;align-items:center;gap:.4rem"><span>Tampil</span><select class="p-select" id="wi-page-size" style="width:auto">${PAGE_SIZES.map((s) => `<option value="${s}" ${s === pageSize ? "selected" : ""}>${s}</option>`).join("")}</select><span>per halaman</span></label>
        <div style="display:flex;gap:.4rem;align-items:center">
          <button type="button" class="p-btn p-btn--tiny" id="wi-prev" ${st.page === 1 ? "disabled" : ""}>← Sebelumnya</button>
          <span class="p-muted" style="font-size:.8rem">Halaman ${st.page} dari ${pages}</span>
          <button type="button" class="p-btn p-btn--tiny" id="wi-next" ${st.page === pages ? "disabled" : ""}>Berikutnya →</button>
        </div>`;
      outlet.querySelector("#wi-prev").addEventListener("click", () => load(st.page - 1));
      outlet.querySelector("#wi-next").addEventListener("click", () => load(st.page + 1));
      outlet.querySelector("#wi-page-size").addEventListener("change", (e) => { pageSize = Number(e.target.value); localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); load(1); });
      outlet.querySelector("#wi-delete-all").disabled = !st.total;
    }

    async function unblock(deviceToken) {
      if (!deviceToken || !confirm("Unblock perangkat ini? Perangkat akan dapat mengirim ucapan kembali.")) return;
      const { error, count } = await sb.from("wish_blocks").delete({ count: "exact" }).eq("invitation_id", tenant.invitationId).eq("device_token", deviceToken);
      if (error) return toast("Gagal unblock perangkat: " + error.message, true);
      if (!count) return toast("Perangkat sudah tidak ada dalam daftar blokir.", true);
      toast("Perangkat berhasil di-unblock.");
      load(st.page);
    }

    async function remove(item, block) {
      if (!item) return;
      const action = block ? "Hapus ucapan dan blokir perangkat ini? Perangkat tidak dapat mengirim ucapan lagi." : "Hapus ucapan ini?";
      if (!confirm(action)) return;
      if (block && item.device_token) {
        const { error } = await sb.from("wish_blocks").upsert({ invitation_id: tenant.invitationId, device_token: item.device_token, blocked_wish_id: item.id }, { onConflict: "invitation_id,device_token" });
        if (error) return toast("Gagal memblokir: " + error.message, true);
      }
      const { error } = await sb.from(wishesTable()).delete().eq("invitation_id", tenant.invitationId).eq("id", item.id);
      if (error) return toast("Gagal menghapus: " + error.message, true);
      toast(block ? "Ucapan dihapus dan perangkat diblokir." : "Ucapan dihapus.");
      load(st.page);
    }

    async function removeAll() {
      if (!st.total || !confirm(`Hapus SEMUA ${st.total} ucapan untuk undangan ini?\n\nTindakan ini tidak bisa dibatalkan.`) || !confirm("Konfirmasi terakhir: hapus seluruh ucapan sekarang?")) return;
      const { error } = await sb.from(wishesTable()).delete().eq("invitation_id", tenant.invitationId);
      if (error) return toast("Gagal menghapus semua: " + error.message, true);
      toast("Semua ucapan dihapus.");
      load(1);
    }

    async function saveModeration() {
      const banned_words = outlet.querySelector("#wi-banned").value.trim();
      const { error } = await sb.from("wish_moderation").upsert({ invitation_id: tenant.invitationId, banned_words, updated_at: new Date().toISOString() }, { onConflict: "invitation_id" });
      if (error) return toast("Gagal menyimpan filter: " + error.message, true);
      st.moderation.banned_words = banned_words;
      toast("Filter kata tersimpan ✓");
    }

    async function fetchAllWishes() {
      const all = [], chunk = 1000;
      for (let from = 0; ; from += chunk) {
        const { data, error } = await query(sb.from(wishesTable()).select("name,attendance,guest_count,message,created_at").eq("invitation_id", tenant.invitationId).order("created_at", { ascending: false }).range(from, from + chunk - 1), "Export ucapan");
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < chunk) return all;
      }
    }
    function exportMarkup(items) {
      return `<section><h2>Ucapan Pernikahan</h2><p>${items.length} ucapan · Diexport ${fmtDate(new Date().toISOString())}</p>${items.map((w) => `<article style="margin-top:.75rem"><strong>${esc(w.name)}</strong><br><small>${esc(LABEL[w.attendance] || w.attendance || "-")} · ${Number(w.guest_count) || 1} orang · ${fmtDate(w.created_at)}</small><p>${esc(w.message)}</p></article>`).join("")}</section>`;
    }
    function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
    function exportCsv() {
      const rows = [["Nama", "Kehadiran", "Jumlah tamu", "Ucapan", "Tanggal"], ...st.exportWishes.map((w) => [w.name, LABEL[w.attendance] || w.attendance || "", w.guest_count || 1, w.message, w.created_at])];
      download(new Blob(["﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }), "ucapan-pernikahan.csv");
    }
    async function exportPng() {
      const status = outlet.querySelector("#wi-export-status");
      const sheet = outlet.querySelector("#wi-export-preview section");
      if (!window.html2canvas) return (status.textContent = "Library export gambar belum termuat. Coba refresh.");
      status.textContent = "Membuat PNG…";
      const canvas = await window.html2canvas(sheet, { scale: 2, backgroundColor: "#fffdf9" });
      canvas.toBlob((blob) => { download(blob, "ucapan-pernikahan.png"); status.textContent = "PNG berhasil diunduh."; }, "image/png");
    }
    async function openExport() {
      const modal = outlet.querySelector("#wi-export-modal");
      const status = outlet.querySelector("#wi-export-status");
      window.PanelUI.openModal(modal);
      status.textContent = "Memuat seluruh ucapan…";
      try {
        st.exportWishes = await fetchAllWishes();
        outlet.querySelector("#wi-export-count").textContent = `${st.exportWishes.length} ucapan akan diexport.`;
        outlet.querySelector("#wi-export-preview").innerHTML = exportMarkup(st.exportWishes);
        status.textContent = "Pilih CSV atau PNG.";
      } catch (err) { status.textContent = "Gagal memuat export: " + err.message; }
    }

    outlet.querySelector("#wi-banned-save").addEventListener("click", saveModeration);
    outlet.querySelector("#wi-refresh").addEventListener("click", () => load(st.page));
    outlet.querySelector("#wi-export").addEventListener("click", openExport);
    outlet.querySelector("#wi-delete-all").addEventListener("click", removeAll);
    outlet.querySelector("#wi-export-close").addEventListener("click", () => { window.PanelUI.closeModal(outlet.querySelector("#wi-export-modal")); });
    outlet.querySelector("#wi-export-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) window.PanelUI.closeModal(e.currentTarget); });
    outlet.querySelector("#wi-export-csv").addEventListener("click", exportCsv);
    outlet.querySelector("#wi-export-png").addEventListener("click", () => exportPng().catch((e) => { outlet.querySelector("#wi-export-status").textContent = "Gagal membuat PNG: " + e.message; }));

    await load(1);
  },
  destroy() { this.state = null; }
};
