/* Editor Visual: frame memakai halaman undangan asli (iframe same-origin), lalu
 * lapisan editor hanya ditambahkan di Admin. Tidak ada markup mockup/screenshot. */
(function () {
  const { sb, toast } = window.AdminAPI;
  const R = () => window.VisualEditorRegistry;
  let content = {}, state = { elements: {} }, section = "all", selected = null;
  let frameReadyTimer = null, frameStableTimer = null;
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const clone = (v) => JSON.parse(JSON.stringify(v || {}));
  const PHOTO_FOLDERS = { "cover.background":"cover", "opening.background":"opening", "closing.background":"closing", "event.akad":"event", "event.resepsi":"event", "story.items":"story", "gallery.items":"gallery" };
  // Sama dengan pilihan tab Font—admin memilih, bukan harus mengingat nama font.
  const FONT_OPTIONS = ["Beau Rivage", "Great Vibes", "Allura", "Parisienne", "Sacramento", "Dancing Script", "Cormorant Garamond", "Playfair Display", "DM Serif Display", "Lora", "Libre Baskerville", "Poppins", "Montserrat", "Open Sans", "Alegreya Sans"];
  function loadFont(name) {
    const family=String(name||"").trim(); if (!family) return;
    const id=`visual-editor-font-${encodeURIComponent(family).replace(/%/g, "")}`;
    if (document.getElementById(id)) return;
    const link=document.createElement("link"); link.id=id; link.rel="stylesheet";
    link.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,"+")}:wght@300;400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  const styleKeys = {
    typography: ["fontFamily", "fontSize", "fontWeight", "color", "lineHeight", "textAlign"],
    button: ["background", "color", "borderColor", "borderWidth", "borderStyle", "borderRadius", "padding", "boxShadow"],
    position: ["transform", "position", "zIndex"], overlay: ["color", "opacity"], text: ["value"]
  };
  function load() {
    const root = document.getElementById("visual-editor-root"); if (!root || !R()) return;
    root.innerHTML = `<div class="ve-toolbar"><strong>Semua halaman — scroll</strong><button class="btn btn--ghost" id="ve-reset-global">Reset global…</button></div><p class="ve-help">Preview statis seluruh undangan. Scroll bebas dan klik pensil pada tulisan yang ingin diedit. Tombol/form/modal undangan hanya ditampilkan sebagai konten editor, tidak menjalankan aksi tamu.</p><div class="ve-layout"><div class="ve-phone"><iframe id="ve-frame" title="Preview undangan statis"></iframe></div></div><div id="ve-edit-modal" class="modal" hidden><div class="modal__panel ve-modal__panel" role="dialog" aria-modal="true" aria-labelledby="ve-modal-title"><div class="modal__header"><h3 id="ve-modal-title">Edit elemen</h3><button type="button" class="modal__close" id="ve-modal-close" aria-label="Tutup">&times;</button></div><div id="ve-inspector" class="ve-inspector"><p class="muted">Pilih elemen melalui ikon pensil pada tampilan.</p></div></div></div>`;
    document.getElementById("ve-reset-global").addEventListener("click",()=>resetScope("global"));
    const closeModal=()=>{ document.getElementById("ve-edit-modal").hidden=true; };
    document.getElementById("ve-modal-close").addEventListener("click",closeModal);
    document.getElementById("ve-edit-modal").addEventListener("click",e=>{ if(e.target===e.currentTarget) closeModal(); });
    fetchContent().then(renderFrame);
  }
  async function fetchContent() {
    const {data,error}=await window.AdminAPI.query(sb.from("site_content").select("content").eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("id",1).maybeSingle(),"Memuat editor visual");
    if(error && error.code!=="PGRST116") { toast("Gagal memuat editor: "+error.message,true); return; }
    content=clone((data&&data.content)||window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG));
    state=clone((content.visualEditor)||{elements:{}}); state.elements=state.elements||{};
  }
  function frameUrl() {
    // Pretty tenant route tidak menerima query tambahan pada host static tertentu
    // (mis. fallback 404 GitHub Pages). Iframe cukup memakai route undangan asli;
    // lifecycle editor sudah ditangani dari parent tanpa parameter khusus.
    // Fragment hanya sisi browser (tidak dikirim ke server), sehingga memaksa
    // iframe reload saat ganti section tanpa mengulang masalah query-route 404.
    return `${window.AdminAPI.tenant.path()}#ve-frame=${Date.now()}`;
  }
  function renderFrame() {
    const frame=document.getElementById("ve-frame"); if(!frame) return;
    clearTimeout(frameReadyTimer); clearTimeout(frameStableTimer);
    frame.hidden=false;
    const selectedSection = section;
    // Satu preview scrollable selalu memakai seluruh halaman. Guard tetap
    // diperlukan agar navigation/timer lama tidak menghias frame baru.
    const decorateSelected = () => { if (section === selectedSection) decorateFrame(frame, selectedSection); };
    frame.addEventListener("load", decorateSelected, { once: true });
    frame.src=frameUrl();
    frameReadyTimer=setTimeout(() => { if (section === selectedSection && frame.contentDocument?.readyState === "complete") decorateFrame(frame, selectedSection); }, 250);
    // main.js dapat menulis ulang nama/sapaan; pasang ulang pensil setelah stabil.
    frameStableTimer=setTimeout(() => { if (section === selectedSection) decorateFrame(frame, selectedSection); }, 1200);
  }
  function installStaticPreview(doc) {
    if (doc.documentElement.dataset.veStaticPreview === "1") return;
    doc.documentElement.dataset.veStaticPreview = "1";
    // Preview tidak boleh meneruskan aksi tamu (open invitation, RSVP, link,
    // kalender, audio, swipe). Pensil editor diberi pengecualian.
    const blockGuestAction = event => {
      if (event.target.closest?.(".ve-pencil")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    ["click", "submit", "change", "keydown", "pointerdown", "pointerup", "touchstart", "touchend"].forEach(type => doc.addEventListener(type, blockGuestAction, true));
    // Lepaskan seluruh state reveal statis; hasilnya konsisten tanpa menunggu
    // intersection observer maupun animasi AOS/transition runtime.
    doc.documentElement.classList.remove("reveal-ready");
    doc.querySelectorAll("[data-reveal], [data-reveal-group]").forEach(el => el.classList.add("is-revealed"));
    doc.querySelectorAll("[data-aos]").forEach(el => { el.classList.add("aos-animate"); el.style.removeProperty("opacity"); el.style.removeProperty("transform"); });
    doc.querySelectorAll(".text-enter").forEach(el => el.classList.add("text-revealed"));
    // Opening normalnya baru terlihat sesudah Buka Undangan. Editor harus
    // memperlakukannya sebagai section statis lengkap—foto, teks, tombol dan countdown.
    const opening = doc.getElementById("opening");
    if (opening) {
      opening.classList.add("section-revealed", "text-revealed");
      opening.style.setProperty("opacity", "1", "important");
      opening.style.setProperty("transform", "none", "important");
      opening.style.setProperty("visibility", "visible", "important");
    }
    // Save The Date 2: sama seperti #opening (section statis di preview editor).
    // Tidak butuh fallback foto karena fotonya statis via inline background-image
    // dari hero-slideshow.js, bukan <picture>/<img> seperti slideshow biasa.
    const std2 = doc.getElementById("save-the-date-2");
    if (std2) {
      std2.classList.add("section-revealed", "text-revealed");
      std2.style.setProperty("opacity", "1", "important");
      std2.style.setProperty("transform", "none", "important");
      std2.style.setProperty("visibility", "visible", "important");
    }
    // Bekukan slider/hero pada slide pertama yang sedang aktif. Runtime boleh
    // tetap selesai memuat, namun tidak ada perubahan visual pada canvas.
    doc.querySelectorAll(".hero-slide").forEach((el, index) => {
      el.classList.toggle("active", index === 0);
      el.classList.remove("exiting");
    });
    // `opening-media` diisi asynchronous oleh hero-slideshow.js. Bila folder
    // opening belum punya foto / request belum selesai, canvas statis tidak
    // boleh terlihat kosong: gunakan frame Cover aktif hanya sebagai fallback
    // preview (tidak pernah disimpan atau mengubah asset tamu).
    const openingMedia = doc.getElementById("opening-media");
    if (openingMedia && !openingMedia.querySelector(".hero-slide, img")) {
      const coverPicture = doc.querySelector("#cover-media .hero-slide.active")?.cloneNode(true) || doc.querySelector("#cover-media picture")?.cloneNode(true);
      const fallback = coverPicture || doc.createElement("picture");
      if (!coverPicture) {
        const img = doc.createElement("img");
        // Asset lokal hanya fallback canvas saat data opening belum tersedia;
        // tidak pernah menyentuh storage/data undangan tenant.
        img.src = new URL("assets/img/foto_opening/01.webp", doc.baseURI).href;
        img.alt = "Preview Save the Date";
        fallback.appendChild(img);
      }
      fallback.classList?.add("hero-slide", "active");
      openingMedia.insertBefore(fallback, openingMedia.querySelector(".hero-overlay"));
      openingMedia.dataset.veOpeningMediaFallback = coverPicture ? "cover" : "local";
    }
    // UI yang normally tersembunyi di balik aksi tamu ditampilkan sebagai
    // contoh statis agar teks/formnya punya pensil dan bisa diedit.
    doc.querySelectorAll("#gift-panel, #gift-confirm-modal, #gift-recs-modal").forEach(el => {
      el.hidden = false;
      el.dataset.veStaticSurface = "1";
    });
  }
  function ensureEditorStaticSurfaces(doc) {
    // Jangan tampilkan ucapan tamu asli di workspace admin. Satu kartu dummy
    // mewakili tampilan semua kartu; stylingnya diterapkan ke seluruh .wish-card
    // saat disimpan, tanpa mengubah isi ucapan orang.
    const list = doc.getElementById("wishes-list");
    if (list && !list.querySelector("[data-ve-wish-dummy=\"1\"]")) {
      list.innerHTML = `<div class="wish-card" data-ve-wish-dummy="1"><span class="wish-card__name">Nama Tamu</span><span class="wish-card__status wish-card__status--hadir">Hadir</span><p class="wish-card__message">Semoga menjadi keluarga yang bahagia, penuh cinta, dan diberkahi selalu.</p></div>`;
    }
  }
  function decorateFrame(frame, activeSection = section) {
    const doc=frame.contentDocument; if(!doc || activeSection !== section) return;
    // Editor visual baru selalu menampilkan satu halaman panjang; jangan auto
    // lompat ke section tertentu agar admin bebas scroll ke teks mana pun.
    // Iframe memuat halaman tamu lengkap. Lepas lock/cover agar section yang
    // dipilih langsung dapat diperiksa tanpa klik Buka Undangan.
    doc.documentElement.classList.remove("no-scroll");
    doc.getElementById("invitation")?.classList.remove("is-locked");
    // Preview semua halaman: cover bukan fixed overlay, melainkan section awal
    // normal sehingga foto/teks Cover dan Save the Date sama-sama dapat discroll.
    const cover = doc.getElementById("cover");
    cover?.classList.remove("is-exiting");
    if (cover) { cover.style.setProperty("transition", "none", "important"); cover.style.setProperty("transform", "none", "important"); }
    doc.documentElement.classList.add("visual-editor-preview");
    // State belum disimpan tetap harus terlihat langsung pada canvas. Iframe
    // selalu dimuat dari data tersimpan, lalu override draft ditempelkan di sini.
    if (doc.defaultView.applyVisualEditorOverrides) doc.defaultView.applyVisualEditorOverrides({ visualEditor: state });
    installStaticPreview(doc);
    ensureEditorStaticSurfaces(doc);
    // Iframe bisa tetap memakai dokumen yang sama saat fragment berubah. Karena
    // itu CSS preview harus selalu diperbarui saat dropdown section berubah.
    const css=doc.getElementById("ve-editor-style") || doc.createElement("style"); css.id="ve-editor-style";
    css.textContent=`#cover{position:relative!important;inset:auto!important;z-index:auto!important;display:block!important;transform:none!important;opacity:1!important;pointer-events:auto!important;transition:none!important}[data-ve-static-surface="1"]{position:relative!important;inset:auto!important;display:block!important;background:var(--color-dark,#15120e)!important;opacity:1!important;pointer-events:auto!important;z-index:auto!important;padding:1.25rem!important;margin:1rem 0!important}.visual-editor-preview *, .visual-editor-preview *:before, .visual-editor-preview *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}.visual-editor-preview [data-reveal],.visual-editor-preview [data-aos],.visual-editor-preview .text-enter{opacity:1!important;transform:none!important;visibility:visible!important}.visual-editor-preview .hero-slide:not(.active){display:none!important}.ve-target-host{position:relative!important;outline:1px dashed transparent}.ve-target-host:hover{outline-color:#c9a668}.ve-pencil{position:absolute!important;right:6px!important;top:6px!important;z-index:9999!important;width:30px!important;height:30px!important;border-radius:50%!important;border:1px solid #c9a668!important;background:#14120f!important;color:#e6d7b3!important;font:700 18px/1 sans-serif!important;display:grid!important;place-items:center!important;cursor:pointer!important;padding:0!important;transform:none!important}.visual-overlay-custom{position:relative!important}.visual-overlay-custom:after{content:"";position:absolute;inset:0;background:var(--visual-overlay-color);opacity:var(--visual-overlay-opacity);pointer-events:none}`;
    if (!css.isConnected) doc.head.appendChild(css);
    doc.querySelectorAll(".ve-pencil").forEach(x=>x.remove());
    R().markAutoTargets(doc);
    // Konten dinamis (nama, rekening, rekomendasi) dapat ditulis ulang setelah
    // load dan menghapus child pensil. Observer hanya memasang ulang bila ada
    // target yang benar-benar kehilangan pensil, sehingga tidak loop sendiri.
    if (!doc.documentElement.dataset.vePencilWatch) {
      doc.documentElement.dataset.vePencilWatch = "1";
      let queued = false;
      new doc.defaultView.MutationObserver(() => {
        const needsPencil = [...doc.querySelectorAll("[data-ve-auto]")].some(el => !el.querySelector(":scope > .ve-pencil"));
        // rsvp.js boleh selesai belakangan lalu mengganti wishes-list. Pasang
        // kembali tepat satu kartu contoh (dan pensilnya), bukan daftar tamu asli.
        const needsWishDummy = !!doc.getElementById("wishes-list") && !doc.querySelector("[data-ve-wish-dummy=\"1\"]");
        if ((!needsPencil && !needsWishDummy) || queued) return;
        queued = true;
        doc.defaultView.setTimeout(() => { queued = false; decorateFrame(frame, section); }, 0);
      }).observe(doc.body, { childList: true, subtree: true });
    }
    R().forSection(section, doc).forEach(target=>doc.querySelectorAll(target.selector).forEach((el,index)=>{
      // Pensil harus melekat pada elemen target sendiri, bukan pada container
      // bersama. Jika memakai .hero-content__top/.bottom, enam target Cover
      // menumpuk pada dua titik dan terlihat seolah hanya dua pensil.
      const host=el; host.classList.add("ve-target-host");
      const b=doc.createElement("button"); b.type="button"; b.className="ve-pencil"; b.textContent="✎"; b.title="Edit: "+target.label; b.setAttribute("aria-label",b.title);
      b.addEventListener("click",ev=>{ev.preventDefault();ev.stopPropagation();selected={...target,baseId:target.id,id:target.id,index}; renderInspector(); document.getElementById("ve-edit-modal").hidden=false;});
      // Setelah sebuah elemen dipilih lewat pensilnya, seret elemen nyata ini
      // untuk memindahkan offset relatif. Tidak memakai absolute page coords.
      host.addEventListener("pointerdown", ev => {
        if (ev.target === b || !selected || selected.baseId !== target.id || selected.index !== index || host.dataset.veDragging) return;
        host.dataset.veDragging = "1";
        const startX=ev.clientX, startY=ev.clientY;
        const prior=(state.elements[selected.id]?.position)||{};
        const move = e => { const x=Math.round((prior.x||0)+(e.clientX-startX)); const y=Math.round((prior.y||0)+(e.clientY-startY)); host.style.transform=`translate(${x}px, ${y}px)`; };
        const end = e => { host.dataset.veDragging = ""; doc.removeEventListener("pointermove",move); doc.removeEventListener("pointerup",end); const x=Math.round((prior.x||0)+(e.clientX-startX)); const y=Math.round((prior.y||0)+(e.clientY-startY)); state.elements[selected.id] ||= {}; state.elements[selected.id].position={...prior,x,y,transform:`translate(${x}px, ${y}px)`}; renderInspector(); };
        doc.addEventListener("pointermove",move); doc.addEventListener("pointerup",end,{once:true});
      });
      host.appendChild(b);
    }));
  }
  function renderGlobal() {
    const frame=document.getElementById("ve-frame"); if(frame) frame.hidden=true;
    const box=document.getElementById("ve-inspector");
    box.innerHTML=`<h3>Global settings</h3><p class="muted">Kontrol global sama dengan tab Tampilan dan memakai data tema yang sama.</p><details open><summary>Warna & overlay global</summary><p>Gunakan panel Tampilan untuk mengatur seluruh warna, background, serta overlay tanpa membuat sumber data kedua.</p><button class="btn btn--primary" id="ve-open-theme">Buka Tampilan</button></details>`;
    document.getElementById("ve-open-theme").onclick=()=>document.querySelector('[data-tab="tampilan"]').click();
  }
  function item() { return selected && (state.elements[selected.id] ||= {}); }
  function currentTargetElement() { const f=document.getElementById("ve-frame"); return f&&f.contentDocument&&selected ? f.contentDocument.querySelector(selected.selector) : null; }
  function renderInspector() {
    FONT_OPTIONS.forEach(loadFont);
    const box=document.getElementById("ve-inspector"); if(!box || section === "global") return; if(!selected){box.innerHTML='<p class="muted">Pilih elemen melalui ikon pensil pada tampilan.</p>';return;}
    const v=item(), el=currentTargetElement(), cs=el?el.ownerDocument.defaultView.getComputedStyle(el):null;
    // Pensil adalah affordance editor yang disisipkan sebagai child target;
    // jangan pernah memasukkannya ke input teks atau menyimpannya ke konten.
    const text=el ? (() => { const copy=el.cloneNode(true); copy.querySelectorAll(".ve-pencil").forEach(p=>p.remove()); return copy.textContent.trim(); })() : "";
    const typ=v.typography||{}; const btn=v.button||{}; const pos=v.position||{}; const over=v.overlay||{};
    box.innerHTML=`<h3>${esc(selected.label)}</h3><p class="ve-path"><code>${esc(selected.selector)}</code></p>${selected.kind!=="image"&&selected.kind!=="wish-card"?`<label>Teks<input class="input" id="ve-text" value="${esc(v.text?.value??text)}"></label>`:""}${selected.kind==="wish-card"?`<p class="muted">Ini satu kartu dummy. Style berikut otomatis diterapkan ke semua kartu ucapan tanpa mengubah nama atau isi ucapan tamu.</p>`:""}<details open><summary>Font & teks</summary><label>Font<select class="input" id="ve-family">${FONT_OPTIONS.map(font=>`<option value="${esc(font)}" style="font-family:'${esc(font)}',sans-serif" ${font===typ.fontFamily?"selected":""}>${esc(font)}</option>`).join("")}</select></label><div class="ve-grid"><label>Ukuran<input class="input" id="ve-size" type="number" value="${esc((typ.fontSize||cs?.fontSize||"16px").replace("px",""))}"></label><label>Weight<select class="input" id="ve-weight">${[300,400,500,600,700].map(x=>`<option ${String(typ.fontWeight||cs?.fontWeight)===String(x)?"selected":""}>${x}</option>`).join("")}</select></label><label>Warna<input id="ve-color" type="color" value="${color(typ.color||cs?.color)}"></label></div></details>${selected.kind==="button"?`<details><summary>Style tombol</summary><label>Background<input id="ve-bg" type="color" value="${color(btn.background||cs?.backgroundColor)}"></label><label>Border radius<input class="input" id="ve-radius" type="number" value="${esc((btn.borderRadius||cs?.borderRadius||"0px").replace("px",""))}"></label><label>Border width<input class="input" id="ve-border" type="number" value="${esc((btn.borderWidth||cs?.borderWidth||"0px").replace("px",""))}"></label></details>`:""}${selected.kind==="image"?`<details open><summary>Foto & overlay</summary><p class="muted">Replace, zoom, dan geser foto dibuka langsung untuk foto yang dipilih; pengaturan tetap tenant-scoped.</p><label class="btn btn--ghost ${PHOTO_FOLDERS[selected.baseId||selected.id]?"":"is-disabled"}">Replace foto ini<input id="ve-replace-photo" type="file" accept="image/*" hidden ${PHOTO_FOLDERS[selected.baseId||selected.id]?"":"disabled"}></label><button class="btn btn--ghost" id="ve-edit-photo" ${PHOTO_FOLDERS[selected.baseId||selected.id]?"":"disabled"}>Zoom / geser foto ini</button><label>Warna overlay<input id="ve-overlay-color" type="color" value="${color(over.color||"#000000")}"></label><label>Opacity <input id="ve-overlay-opacity" type="range" min="0" max="1" step=".01" value="${esc(over.opacity??.22)}"></label><label>Scope<select class="input" id="ve-overlay-scope"><option value="item">Terapkan hanya foto ini</option><option value="section">Terapkan ke semua foto di section ini</option></select></label></details>`:""}<details><summary>Posisi bebas</summary><p class="muted">Gunakan drag langsung pada canvas; posisi disimpan sebagai offset relatif agar tetap responsif.</p><label>X <input class="input" id="ve-x" type="number" value="${esc(pos.x||0)}"></label><label>Y <input class="input" id="ve-y" type="number" value="${esc(pos.y||0)}"></label></details><div class="ve-actions"><button class="btn btn--ghost" id="ve-reset-item">Reset item…</button></div>`;
    bindInspector();
  }
  function color(value) { const m=String(value||"").match(/#([0-9a-f]{6})/i)||String(value||"").match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/); return m ? (m[1].startsWith?.("#")?m[1]:"#"+[m[1],m[2],m[3]].map(n=>Number(n).toString(16).padStart(2,"0")).join("")) : "#c9a668"; }
  function bindInspector() { const q=id=>document.getElementById(id); const on=(id,fn)=>q(id)&&q(id).addEventListener("input",fn); const v=item();
    on("ve-text",e=>set("text",{value:e.target.value})); on("ve-family",e=>set("typography",{fontFamily:e.target.value}));on("ve-size",e=>set("typography",{fontSize:Math.max(8,Number(e.target.value||16))+"px"}));on("ve-weight",e=>set("typography",{fontWeight:e.target.value}));on("ve-color",e=>set("typography",{color:e.target.value}));on("ve-bg",e=>set("button",{background:e.target.value}));on("ve-radius",e=>set("button",{borderRadius:Math.max(0,Number(e.target.value||0))+"px"}));on("ve-border",e=>set("button",{borderWidth:Math.max(0,Number(e.target.value||0))+"px",borderStyle:"solid"}));on("ve-x",e=>set("position",{x:Number(e.target.value||0)}));on("ve-y",e=>set("position",{y:Number(e.target.value||0)}));
    on("ve-overlay-color",e=>setOverlay({color:e.target.value}));on("ve-overlay-opacity",e=>setOverlay({opacity:Number(e.target.value)}));q("ve-replace-photo")?.addEventListener("change",e=>replaceSelectedPhoto(e.target.files?.[0]));q("ve-edit-photo")?.addEventListener("click",()=>openSelectedPhoto());q("ve-reset-item")?.addEventListener("click",()=>resetScope("item"));
  }
  async function replaceSelectedPhoto(file){
    const folder=PHOTO_FOLDERS[selected?.baseId || selected?.id]; if(!folder || !file) return;
    const {data,error}=await window.AdminAPI.query(sb.from("photos").select("*").eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("folder",folder).order("sort_order",{ascending:true}),"Memuat foto untuk replace");
    const photo=(data||[])[selected.index||0]; if(error||!photo){toast(error?"Gagal memuat foto: "+error.message:"Foto target belum tersedia.",true);return;}
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():`f${Date.now()}${Math.random().toString(16).slice(2)}`;
    const path=`${window.AdminAPI.tenant.slug}/${folder}/${id}.${ext}`;
    const {error:uploadError}=await sb.storage.from("photos").upload(path,file,{contentType:file.type||"image/jpeg",upsert:false});
    if(uploadError){toast("Gagal replace foto: "+uploadError.message,true);return;}
    const {error:updateError}=await sb.from("photos").update({storage_path:path}).eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("id",photo.id);
    if(updateError){toast("Foto terunggah namun gagal diperbarui: "+updateError.message,true);return;}
    toast("Foto berhasil diganti."); renderFrame();
  }
  async function openSelectedPhoto(){
    const folder=PHOTO_FOLDERS[selected?.id]; if(!folder || !window.PhotoEditor) return;
    const {data,error}=await window.AdminAPI.query(sb.from("photos").select("*").eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("folder",folder).order("sort_order",{ascending:true}),"Memuat foto editor visual");
    if(error){toast("Gagal memuat foto: "+error.message,true);return;}
    const photo=(data||[])[selected.index||0];
    if(!photo){toast("Belum ada foto pada bagian ini.",true);return;}
    window.PhotoEditor.open(photo,folder,selected.index||0);
  }
  function set(category, patch){const v=item();v[category]={...(v[category]||{}),...patch}; if(category==="position"){const p=v.position;p.transform=`translate(${p.x||0}px, ${p.y||0}px)`;} applyLive();}
  function setOverlay(patch){const scope=document.getElementById("ve-overlay-scope")?.value||"item";const ids=scope==="section"?R().forSection(section).filter(t=>t.kind==="image").map(t=>t.id):[selected.id]; ids.forEach(id=>{const v=state.elements[id]||={};v.overlay={...(v.overlay||{}),...patch};});applyLive();}
  function applyLive(){const f=document.getElementById("ve-frame");if(!f?.contentWindow)return; f.contentWindow.WEDDING_CONFIG=f.contentWindow.WEDDING_CONFIG||{};f.contentWindow.WEDDING_CONFIG.visualEditor=state; const doc=f.contentDocument; const props=["font-family","font-size","font-weight","color","line-height","text-align","background","border-color","border-width","border-style","border-radius","padding","box-shadow","transform","position","z-index","--visual-overlay-color","--visual-overlay-opacity"]; R().targets.forEach(t=>doc.querySelectorAll(t.selector).forEach(el=>{props.forEach(p=>el.style.removeProperty(p));el.classList.remove("visual-overlay-custom");})); if(f.contentWindow.applyVisualEditorOverrides) f.contentWindow.applyVisualEditorOverrides({visualEditor:state}); decorateFrame(f);}
  function resetScope(scope){const category=prompt("Reset kategori: all, text, typography, button, image, overlay, position", "all");if(!category||!R().categories.includes(category))return;let ids=[];if(scope==="item"&&selected)ids=[selected.id];else if(scope==="section")ids=R().forSection(section).map(t=>t.id);else ids=Object.keys(state.elements);ids.forEach(id=>{if(category==="all")delete state.elements[id];else if(state.elements[id])delete state.elements[id][category];if(state.elements[id]&&!Object.keys(state.elements[id]).length)delete state.elements[id];});applyLive();renderInspector();toast(`Reset ${category} untuk ${ids.length} elemen.`);}
  async function save(){content.visualEditor=state;const btn=document.getElementById("btn-save-visual-editor");if(btn)btn.disabled=true;const {error}=await window.AdminAPI.query(sb.from("site_content").upsert({invitation_id:window.AdminAPI.tenant.invitationId,id:1,content,updated_at:new Date().toISOString()},{onConflict:"invitation_id,id"}),"Simpan editor visual");if(btn)btn.disabled=false;if(error)toast("Gagal menyimpan: "+error.message,true);else toast("Perubahan visual disimpan.");}
  document.getElementById("btn-save-visual-editor")?.addEventListener("click",save);window.VisualEditorPanel={load};
})();
