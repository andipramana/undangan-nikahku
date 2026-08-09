/** Tab Ucapan: pagination tenant-scoped + moderasi perangkat/kata. */
(function () {
  const { sb, toast } = window.AdminAPI;
  const LABEL = { hadir: "Hadir", tidak_hadir: "Tidak Hadir", ragu: "Ragu-ragu" };
  const PAGE_SIZES = [10, 20, 50, 100];
  const PAGE_SIZE_KEY = "admin-wishes-page-size";
  let pageSize = Number(localStorage.getItem(PAGE_SIZE_KEY)) || 20;
  if (!PAGE_SIZES.includes(pageSize)) pageSize = 20;
  let wishes = [], total = 0, page = 1, moderation = { banned_words: "" }, blockedDevices = [], exportWishes = [];
  const exportModal = document.getElementById("wish-export-modal");
  window.WishesPanel = { load };

  async function load(nextPage = page) {
    page = Math.max(1, nextPage);
    const root = document.getElementById("wishes-root");
    root.innerHTML = "<p class='muted'>Memuat ucapan…</p>";
    const table = (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes";
    const from = (page - 1) * pageSize;
    const [wishRes, modRes, blockRes] = await Promise.all([
      window.AdminAPI.query(sb.from(table).select("*", { count:"exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).order("created_at", { ascending:false }).range(from, from + pageSize - 1), "Permintaan ucapan"),
      window.AdminAPI.query(sb.from("wish_moderation").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).maybeSingle(), "Permintaan moderasi"),
      window.AdminAPI.query(sb.from("wish_blocks").select("device_token,blocked_at,blocked_wish_id").eq("invitation_id", window.AdminAPI.tenant.invitationId).order("blocked_at", { ascending:false }), "Permintaan perangkat diblokir")
    ]);
    if (wishRes.error || modRes.error || blockRes.error) { root.innerHTML=`<p class="warning">Gagal memuat ucapan: ${esc((wishRes.error || modRes.error || blockRes.error).message)}</p><button class="btn btn--primary" id="wishes-retry">Coba lagi</button>`; root.querySelector("#wishes-retry").onclick=()=>load(page); return; }
    wishes = wishRes.data || []; total = wishRes.count || 0; moderation = modRes.data || { banned_words:"" }; blockedDevices = blockRes.data || []; paint();
  }

  function paint() {
    const root = document.getElementById("wishes-root"); const pages = Math.max(1, Math.ceil(total / pageSize));
    const tally = { hadir:0, tidak_hadir:0, ragu:0 }; let guests=0;
    wishes.forEach(w=>{ if (tally[w.attendance] !== undefined) tally[w.attendance]++; if(w.attendance === "hadir") guests += Number(w.guest_count)||0; });
    root.innerHTML=`
      <details class="wish-moderation" open><summary>Moderasi ucapan</summary>
        <p class="muted">Pisahkan kata/frasa terlarang dengan koma. Pesan atau nama yang memuatnya tidak diposting.</p>
        <label class="form-field"><span>Kata/frasa terlarang</span><input class="input" id="wish-banned-words" value="${esc(moderation.banned_words||"")}" placeholder="contoh: kasar1, kasar2"></label>
        <button class="btn btn--primary" id="wish-moderation-save">Simpan filter</button>
      </details>
      <details class="wish-block-list"><summary>Perangkat diblokir <span class="wish-block-list__count">${blockedDevices.length}</span></summary>
        <p class="muted">Pemblokiran memakai token acak browser, bukan alamat IP. Unblock membuat perangkat tersebut dapat mengirim ucapan kembali.</p>
        <div class="wish-block-list__rows">${blockedDevices.length ? blockedDevices.map((block,i)=>`<div class="wish-block-row"><div><strong>Perangkat #${i+1}</strong><small>Diblokir ${fmtDate(block.blocked_at)}</small></div><button type="button" class="btn btn--tiny btn--ghost" data-unblock="${esc(block.device_token)}">Unblock</button></div>`).join("") : `<p class="muted">Belum ada perangkat yang diblokir.</p>`}</div>
      </details>
      <div class="wish-summary"><span><strong>${total}</strong> ucapan</span><span class="wish-chip wish-chip--hadir">Hadir ${tally.hadir}</span><span class="wish-chip wish-chip--ragu">Ragu ${tally.ragu}</span><span class="wish-chip wish-chip--tidak">Tidak hadir ${tally.tidak_hadir}</span><span class="muted">${guests} orang hadir di halaman ini</span></div>
      <div class="wish-toolbar"><div class="wish-toolbar__primary"><button type="button" class="btn btn--ghost" id="wishes-refresh">↻ Refresh</button><button type="button" class="btn btn--ghost" id="wishes-export">Export semua</button></div><button type="button" class="btn btn--danger wish-toolbar__delete" id="wishes-delete-all" ${total ? "" : "disabled"}>Hapus semua ucapan</button></div>
      <div class="wish-list">${wishes.length ? wishes.map((w,i)=>`<article class="wish-row"><div class="wish-row__head"><strong>${esc(w.name)}</strong><span class="wish-chip wish-chip--${chipClass(w.attendance)}">${esc(LABEL[w.attendance]||w.attendance||"-")}</span><span class="muted">${Number(w.guest_count)||1} orang</span><time class="muted">${fmtDate(w.created_at)}</time><button class="btn btn--tiny btn--danger" data-del="${i}">Hapus</button>${w.device_token ? `<button class="btn btn--tiny btn--danger" data-block="${i}">Hapus & blokir perangkat</button>` : ""}</div><p class="wish-row__msg">${esc(w.message)}</p></article>`).join("") : "<p class='muted'>Belum ada ucapan pada halaman ini.</p>"}</div>
      <nav class="wish-pagination" aria-label="Halaman ucapan"><label class="wish-page-size">Tampil <select class="input" id="wish-page-size" aria-label="Jumlah ucapan per halaman">${PAGE_SIZES.map(size=>`<option value="${size}" ${size===pageSize?"selected":""}>${size}</option>`).join("")}</select> per halaman</label><button class="btn btn--tiny" id="wish-prev" ${page===1?"disabled":""}>← Sebelumnya</button><span>Halaman ${page} dari ${pages}</span><button class="btn btn--tiny" id="wish-next" ${page===pages?"disabled":""}>Berikutnya →</button></nav>`;
    root.querySelector("#wish-prev").onclick=()=>load(page-1); root.querySelector("#wish-next").onclick=()=>load(page+1);
    root.querySelector("#wish-page-size").onchange=(event)=>{ pageSize=Number(event.target.value); localStorage.setItem(PAGE_SIZE_KEY,String(pageSize)); load(1); };
    root.querySelector("#wish-moderation-save").onclick=saveModeration;
    root.querySelector("#wishes-refresh").onclick=()=>load(page);
    root.querySelector("#wishes-export").onclick=openExport;
    root.querySelector("#wishes-delete-all").onclick=removeAll;
    root.querySelectorAll("[data-unblock]").forEach(b=>b.onclick=()=>unblock(b.dataset.unblock));
    root.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>remove(wishes[Number(b.dataset.del)], false));
    root.querySelectorAll("[data-block]").forEach(b=>b.onclick=()=>remove(wishes[Number(b.dataset.block)], true));
  }
  async function unblock(deviceToken) {
    if (!deviceToken || !confirm("Unblock perangkat ini? Perangkat akan dapat mengirim ucapan kembali.")) return;
    const { error, count } = await sb.from("wish_blocks").delete({ count:"exact" }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("device_token", deviceToken);
    if (error) return toast("Gagal unblock perangkat: " + error.message, true);
    if (!count) return toast("Perangkat sudah tidak ada dalam daftar blokir.", true);
    toast("Perangkat berhasil di-unblock."); load(page);
  }

  async function fetchAllWishes() {
    const table=(window.WEDDING_CONFIG.supabase&&window.WEDDING_CONFIG.supabase.wishesTable)||"wishes";
    const all=[]; const chunk=1000;
    // Ambil berulang agar export tidak diam-diam terpotong oleh batas max_rows API.
    for(let from=0;;from+=chunk){
      const {data,error}=await window.AdminAPI.query(sb.from(table).select("name,attendance,guest_count,message,created_at").eq("invitation_id",window.AdminAPI.tenant.invitationId).order("created_at",{ascending:false}).range(from,from+chunk-1),"Export ucapan");
      if(error) throw error; all.push(...(data||[])); if(!data||data.length<chunk) return all;
    }
  }
  function exportMarkup(items) { return `<section class="wish-export-sheet"><h2>Ucapan Pernikahan</h2><p>${items.length} ucapan · Diexport ${fmtDate(new Date().toISOString())}</p>${items.map(w=>`<article><strong>${esc(w.name)}</strong><small>${esc(LABEL[w.attendance]||w.attendance||"-")} · ${Number(w.guest_count)||1} orang · ${fmtDate(w.created_at)}</small><p>${esc(w.message)}</p></article>`).join("")}</section>`; }
  async function openExport() {
    const status=document.getElementById("wish-export-status"); exportModal.hidden=false; status.textContent="Memuat seluruh ucapan…";
    try { exportWishes=await fetchAllWishes(); document.getElementById("wish-export-count").textContent=`${exportWishes.length} ucapan akan diexport.`; document.getElementById("wish-export-preview").innerHTML=exportMarkup(exportWishes); status.textContent="Pilih CSV atau PNG."; }
    catch(err){status.textContent="Gagal memuat export: "+err.message;}
  }
  function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function exportCsv(){const rows=[["Nama","Kehadiran","Jumlah tamu","Ucapan","Tanggal"],...exportWishes.map(w=>[w.name,LABEL[w.attendance]||w.attendance||"",w.guest_count||1,w.message,w.created_at])];download(new Blob(["\ufeff"+rows.map(r=>r.map(v=>`\"${String(v??"").replaceAll("\"","\"\"")}\"`).join(",")).join("\n")],{type:"text/csv;charset=utf-8"}),"ucapan-pernikahan.csv");}
  async function exportPng(){const status=document.getElementById("wish-export-status"),sheet=document.querySelector("#wish-export-preview .wish-export-sheet");if(!window.html2canvas)return status.textContent="Library export gambar belum termuat. Coba refresh.";status.textContent="Membuat PNG…";const canvas=await window.html2canvas(sheet,{scale:2,backgroundColor:"#1f1c16"});canvas.toBlob(blob=>{download(blob,"ucapan-pernikahan.png");status.textContent="PNG berhasil diunduh.";},"image/png");}
  async function removeAll(){if(!total||!confirm(`Hapus SEMUA ${total} ucapan untuk undangan ini?\n\nTindakan ini tidak bisa dibatalkan.`)||!confirm("Konfirmasi terakhir: hapus seluruh ucapan sekarang?"))return;const table=(window.WEDDING_CONFIG.supabase&&window.WEDDING_CONFIG.supabase.wishesTable)||"wishes";const {error}=await sb.from(table).delete().eq("invitation_id",window.AdminAPI.tenant.invitationId);if(error)return toast("Gagal menghapus semua: "+error.message,true);toast("Semua ucapan dihapus.");load(1);}
  document.getElementById("wish-export-close").onclick=()=>exportModal.hidden=true;
  document.getElementById("wish-export-csv").onclick=exportCsv;
  document.getElementById("wish-export-png").onclick=()=>exportPng().catch(e=>document.getElementById("wish-export-status").textContent="Gagal membuat PNG: "+e.message);
  exportModal.addEventListener("click",e=>{if(e.target===exportModal)exportModal.hidden=true;});

  async function saveModeration() {
    const banned_words=document.getElementById("wish-banned-words").value.trim();
    const { error }=await sb.from("wish_moderation").upsert({ invitation_id:window.AdminAPI.tenant.invitationId,banned_words,updated_at:new Date().toISOString() },{onConflict:"invitation_id"});
    if(error) return toast("Gagal menyimpan filter: "+error.message,true); moderation.banned_words=banned_words; toast("Filter kata tersimpan ✓");
  }
  async function remove(item, block) {
    if(!item) return; const action=block?"Hapus ucapan dan blokir perangkat ini? Perangkat tidak dapat mengirim ucapan lagi.":"Hapus ucapan ini?";
    if(!confirm(action)) return;
    if(block && item.device_token) { const {error}=await sb.from("wish_blocks").upsert({invitation_id:window.AdminAPI.tenant.invitationId,device_token:item.device_token,blocked_wish_id:item.id},{onConflict:"invitation_id,device_token"}); if(error) return toast("Gagal memblokir: "+error.message,true); }
    const table=(window.WEDDING_CONFIG.supabase&&window.WEDDING_CONFIG.supabase.wishesTable)||"wishes"; const {error}=await sb.from(table).delete().eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("id",item.id);
    if(error) return toast("Gagal menghapus: "+error.message,true); toast(block?"Ucapan dihapus dan perangkat diblokir.":"Ucapan dihapus."); load(page);
  }
  function chipClass(a){return a==="hadir"?"hadir":a==="ragu"?"ragu":"tidak";} function fmtDate(iso){return iso?new Date(iso).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"}):"";} function esc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
})();
