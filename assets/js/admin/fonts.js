/* Tab Font: kontrol tipografi PER ELEMEN, disimpan di site_content.typography.elements. */
(function () {
  const { sb, toast } = window.AdminAPI;
  const FONTS = ["Beau Rivage", "Great Vibes", "Allura", "Parisienne", "Sacramento", "Dancing Script", "Cormorant Garamond", "Playfair Display", "DM Serif Display", "Lora", "Libre Baskerville", "Poppins", "Montserrat", "Open Sans", "Alegreya Sans"];
  // Defaults meniru stylesheet awal website: tidak ada override tersimpan =
  // persis seperti desain sebelum fitur Font dibuat.
  const SECTIONS = [
    { id: "cover", label: "Cover", elements: [
      ["cover-eyebrow", "Tulisan ‘The Wedding Of’", ".cover-eyebrow", "THE WEDDING OF", { family:"Alegreya Sans", size:13, weight:500 }],
      ["cover-names", "Nama mempelai", ".cover-names, #couple-names-cover", "Mita & Andi", { family:"Beau Rivage", size:50, weight:400 }],
      ["cover-guest", "Sapaan & nama tamu", ".guest-label, .guest-name", "Kepada Yth. Nadia Pratama", { family:"Poppins", size:16, weight:500 }],
      ["cover-button", "Tombol buka undangan", ".btn-open", "BUKA UNDANGAN", { family:"Poppins", size:14, weight:500 }]
    ]},
    { id: "opening", label: "Save the Date & Pembuka", elements: [
      ["opening-eyebrow", "Eyebrow Save the Date", "#opening .eyebrow", "SAVE THE DATE", { family:"Alegreya Sans", size:13, weight:500 }],
      ["opening-names", "Nama mempelai", "#couple-names-opening", "Mita & Andi", { family:"Beau Rivage", size:50, weight:400 }],
      ["opening-date", "Tanggal acara", ".save-date, .cover-countdown__date", "MINGGU, 25 AGUSTUS 2026", { family:"Poppins", size:16, weight:500 }],
      ["opening-quote", "Quote pembuka", ".opening-quote", "Dan di antara tanda-tanda-Nya...", { family:"Poppins", size:20, weight:400 }]
    ]},
    { id: "couple", label: "Mempelai", elements: [
      ["couple-eyebrow", "Eyebrow section", "#couple .section-eyebrow", "THE COUPLE", { family:"Alegreya Sans", size:13, weight:500 }],
      ["couple-title", "Judul section", "#couple .section-title--script", "Mempelai", { family:"Beau Rivage", size:40, weight:400 }],
      ["couple-name", "Nama mempelai di kartu", ".couple-info__name", "Mita Pratama", { family:"Beau Rivage", size:42, weight:400 }],
      ["couple-label", "Label & keterangan keluarga", ".couple-info__label, .couple-info__parents", "PUTRI DARI BPK. & IBU", { family:"Alegreya Sans", size:13, weight:500 }]
    ]},
    { id: "event", label: "Acara & Dresscode", elements: [
      ["event-eyebrow", "Eyebrow section", "#event .section-eyebrow", "WEDDING EVENT", { family:"Alegreya Sans", size:13, weight:500 }],
      ["event-title", "Judul section", "#event .section-title", "Rangkaian Acara", { family:"Poppins", size:30, weight:500 }],
      ["event-label", "Label Akad / Resepsi", ".event-label", "AKAD NIKAH", { family:"Alegreya Sans", size:20, weight:500 }],
      ["event-date", "Angka & detail tanggal", ".event-num, .event-day, .event-month, .event-year, .event-time", "25 AGUSTUS 2026", { family:"Beau Rivage", size:38, weight:400 }],
      ["event-venue", "Nama & alamat venue", ".event-place h3, .event-place p", "Gedung Bahagia", { family:"Poppins", size:16, weight:500 }],
      ["dresscode", "Dresscode", ".dresscode-label, .dresscode-text", "DRESSCODE · KREM", { family:"Alegreya Sans", size:16, weight:500 }]
    ]},
    { id: "story", label: "Cerita, Galeri & Quote", elements: [
      ["story-title", "Judul Our Story", "#love-story .section-title--script", "Perjalanan Kami", { family:"Beau Rivage", size:40, weight:400 }],
      ["story-content", "Judul & isi cerita", ".timeline-item h4, .timeline-item p", "Awal perjalanan kami", { family:"Poppins", size:16, weight:400 }],
      ["gallery-title", "Judul Galeri", "#gallery .section-title--script", "Galeri Foto", { family:"Beau Rivage", size:40, weight:400 }],
      ["quote", "Quote foto", ".quote-text", "Cinta adalah perjalanan yang indah.", { family:"Poppins", size:20, weight:400 }]
    ]},
    { id: "gift", label: "Gift & RSVP", elements: [
      ["gift-title", "Judul Gift", "#gift .section-title", "Tanda Kasih", { family:"Poppins", size:30, weight:500 }],
      ["gift-content", "Rekening & rekomendasi kado", ".gift-account__bank, .gift-account__number, .gift-rec-card__name, .gift-rec-card__price", "Wedding Gift", { family:"Poppins", size:16, weight:500 }],
      ["gift-button", "Tombol Gift", "#gift .btn-primary, #gift .btn-outline, #gift .btn-text", "KIRIM HADIAH", { family:"Poppins", size:14, weight:500 }],
      ["rsvp-title", "Judul RSVP", "#rsvp .section-title", "Konfirmasi Kehadiran", { family:"Poppins", size:30, weight:500 }],
      ["rsvp-form", "Label, input & tombol RSVP", ".rsvp-form label, .rsvp-form input, .rsvp-form select, .rsvp-form textarea, .rsvp-pill, #rsvp-submit", "Kirim Konfirmasi", { family:"Poppins", size:14, weight:500 }],
      ["wishes", "Daftar ucapan", ".wishes-heading p, .wishes-intro, .wish-card__name, .wish-card__status, .wish-card__message", "Nadia Pratama · Semoga bahagia", { family:"Poppins", size:14, weight:400 }]
    ]},
    { id: "closing", label: "Closing & Footer", elements: [
      ["closing-text", "Teks penutup", ".closing-text, footer", "Terima kasih atas doa dan kehadirannya.", { family:"Poppins", size:16, weight:400 }],
      ["closing-names", "Nama mempelai", "#couple-names-closing", "Mita & Andi", { family:"Beau Rivage", size:40, weight:400 }]
    ]}
  ];
  let elements = {};
  // Konten yang sedang dipakai undangan. Preview selalu mengambil teks dari
  // payload tenant ini (bukan contoh statis), lalu fallback ke config lokal.
  let liveContent = {};
  const esc = (v) => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  const get = (path, fallback = "") => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), liveContent) ?? fallback;
  function previewText(id, fallback) {
    const bride = get("couple.bride.nickname", get("couple.bride.name", "Mita"));
    const groom = get("couple.groom.nickname", get("couple.groom.name", "Andi"));
    const map = {
      "cover-names": `${bride} & ${groom}`, "opening-names": `${bride} & ${groom}`, "closing-names": `${bride} & ${groom}`,
      "cover-guest": `Kepada Yth. ${get("defaultGuestName", "Bapak/Ibu/Saudara/i")}`,
      "opening-date": get("event.dateLabel"), "opening-quote": get("opening.quote"),
      "couple-name": get("couple.bride.name"), "couple-label": `Putri dari Bpk. ${get("couple.bride.father", "")} & Ibu ${get("couple.bride.mother", "")}`,
      "event-label": get("event.akad.label"), "event-date": `${get("event.dayLabel", "")} · ${get("event.dateLabel", "")}`,
      "event-venue": get("event.akad.venue.name"), "dresscode": get("dresscode.text"),
      "story-content": get("loveStory.0.title", ""), "quote": get("quotePhoto.quote"),
      "gift-content": get("gifts.0.bank", get("gifts.0.accountName", fallback)),
      "wishes": get("wishesPreview", fallback), "closing-text": get("closing.text", fallback)
    };
    return String(map[id] || fallback || "").trim();
  }
  const find = (id) => SECTIONS.flatMap(s => s.elements).find(e => e[0] === id);
  const config = (id) => ({ ...(find(id)?.[4] || {}), ...(elements[id] || {}) });
  const fontOptions = (value) => `<option value="">— pilih font —</option>${FONTS.map(f => `<option value="${esc(f)}" ${f===value?"selected":""}>${esc(f)}</option>`).join("")}`;
  const style = (v) => `font-family:'${esc(v.family)}',sans-serif;font-size:${Number(v.size)||16}px;font-weight:${Number(v.weight)||400};${v.color?`color:${esc(v.color)}`:""}`;
  function loadFont(name) { const n=String(name||"").trim(); if(!n)return; const id="admin-font-"+encodeURIComponent(n).replace(/%/g,""); if(document.getElementById(id))return; const link=document.createElement("link");link.id=id;link.rel="stylesheet";link.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(n).replace(/%20/g,"+")+":wght@300;400;500;600;700&display=swap";document.head.appendChild(link); }
  async function load() { const {data,error}=await window.AdminAPI.query(sb.from("site_content").select("content").eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("id",1).maybeSingle(),"Permintaan font");if(error&&error.code!=="PGRST116"){toast("Gagal memuat font: "+error.message,true);return;} liveContent=(data&&data.content)||window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);elements=(liveContent.typography&&liveContent.typography.elements)||{};render(); }
  function render() { Object.keys(elements).forEach(id=>loadFont(config(id).family)); const root=document.getElementById("fonts-root");if(!root)return; const active=root.dataset.section||SECTIONS[0].id; const section=SECTIONS.find(s=>s.id===active)||SECTIONS[0]; root.dataset.section=section.id; root.innerHTML=`<p class="theme-title">Font per elemen</p><p class="muted theme-hint">Default di bawah adalah gaya asli website sebelum fitur Font. Pilih section lalu atur setiap tulisan secara terpisah. Reset elemen mengembalikan elemen itu ke CSS awal.</p><div class="font-toolbar"><label class="form-field"><span>Section</span><select class="input" id="font-section">${SECTIONS.map(s=>`<option value="${s.id}" ${s.id===section.id?"selected":""}>${esc(s.label)}</option>`).join("")}</select></label><button class="btn btn--ghost" type="button" id="fonts-reset-all">Reset semua ke default awal</button></div><div class="font-list">${section.elements.map(([id,label,,sample])=>{const v=config(id);return `<section class="font-card"><div class="font-card__head"><h3>${esc(label)}</h3><button class="btn btn--tiny" type="button" data-font-reset="${id}">Reset elemen</button></div><p class="font-preview__path">Target: <code>${esc(find(id)[2])}</code></p><div class="font-preview" data-font-preview="${id}" style="${style(v)}">${esc(previewText(id, sample))}</div><label class="form-field"><span>Font pilihan</span><select class="input" data-font-select="${id}">${fontOptions(v.family)}</select></label><label class="form-field"><span>Nama font custom</span><input class="input font-custom" data-font-family="${id}" value="${esc(v.family)}" placeholder="Contoh: Cormorant Garamond"></label><div class="form-grid"><label class="form-field"><span>Ukuran (px)</span><input class="input" type="number" min="8" max="120" data-font-size="${id}" value="${v.size}"></label><label class="form-field"><span>Ketebalan</span><select class="input" data-font-weight="${id}">${[300,400,500,600,700].map(w=>`<option value="${w}" ${Number(v.weight)===w?"selected":""}>${w}</option>`).join("")}</select></label><label class="form-field"><span>Warna (opsional)</span><input class="input" data-font-color="${id}" value="${esc(v.color||"")}" placeholder="Warna awal CSS"></label></div></section>`;}).join("")}</div>`;
    root.querySelector("#font-section").addEventListener("change",e=>{root.dataset.section=e.target.value;render();}); root.querySelector("#fonts-reset-all").addEventListener("click",()=>{elements={};render();});
    root.querySelectorAll("[data-font-reset]").forEach(b=>b.addEventListener("click",()=>{delete elements[b.dataset.fontReset];render();}));
    root.querySelectorAll("[data-font-select],[data-font-family],[data-font-size],[data-font-weight],[data-font-color]").forEach(el=>el.addEventListener("input",()=>{const id=el.dataset.fontSelect||el.dataset.fontFamily||el.dataset.fontSize||el.dataset.fontWeight||el.dataset.fontColor;const prop=el.dataset.fontSelect||el.dataset.fontFamily?"family":el.dataset.fontSize?"size":el.dataset.fontWeight?"weight":"color";elements[id]={...config(id),[prop]:el.value};if(prop==="family")loadFont(el.value);const p=root.querySelector(`[data-font-preview="${id}"]`);if(p)p.style.cssText=style(config(id));})); }
  async function save(){const {data,error}=await window.AdminAPI.query(sb.from("site_content").select("content").eq("invitation_id",window.AdminAPI.tenant.invitationId).eq("id",1).maybeSingle(),"Permintaan font");if(error&&error.code!=="PGRST116"){toast("Gagal membaca konten: "+error.message,true);return;}const content=data&&data.content?JSON.parse(JSON.stringify(data.content)):window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);content.typography={elements};const r=await window.AdminAPI.query(sb.from("site_content").upsert({invitation_id:window.AdminAPI.tenant.invitationId,id:1,content,updated_at:new Date().toISOString()},{onConflict:"invitation_id,id"}),"Penyimpanan font");toast(r.error?"Gagal menyimpan font: "+r.error.message:"Font disimpan.",!!r.error);}
  const floating=document.getElementById("btn-save-fonts");if(floating)floating.addEventListener("click",save);window.FontsPanel={load};
})();
