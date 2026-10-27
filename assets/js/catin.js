/* Halaman publik /catin — calon pengantin mengirim data undangan sebagai DRAFT.
 *
 * Tanpa login. Satu-satunya jalur tulis adalah RPC submit_client_draft
 * (supabase/migrations/0029_client_drafts.sql): tabelnya tertutup untuk anon,
 * RPC memvalidasi ulang, menolak bot lewat kolom jebakan, dan membatasi laju.
 * Validasi di sini hanya untuk membantu pengguna; bukan penjaga keamanan.
 *
 * Logika murni (validate, buildPayload, slugify) dibuka lewat window.CatinForm
 * supaya bisa diuji tanpa DOM (scripts/test-catin.mjs).
 */
(function () {
  "use strict";

  const SB = (window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase) || {};
  const STORE = "catin_draft_v1";
  const TOKEN_KEY = "catin_device_v1";
  const ORDERS = ["pertama", "kedua", "ketiga", "keempat", "kelima", "keenam", "ketujuh", "kedelapan", "kesembilan", "kesepuluh", "tunggal", "bungsu"];
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const MAX_STORIES = 4;
  const MAX_GIFTS = 4;

  const STEPS = [
    { id: "kenal", e: "👋", t: "Kenalan dulu", d: "Supaya kami bisa menghubungimu." },
    { id: "pengantin", e: "💍", t: "Calon pengantin", d: "Nama dan orang tua." },
    { id: "acara", e: "📍", t: "Acara", d: "Kapan dan di mana." },
    { id: "cerita", e: "📖", t: "Cerita kalian", d: "Boleh dilewati." },
    { id: "kasih", e: "🎁", t: "Tanda kasih", d: "Rekening dan alamat kado." },
    { id: "tampilan", e: "🎨", t: "Tampilan", d: "Warna, foto, dan lagu." },
    { id: "kirim", e: "🚀", t: "Cek & kirim", d: "Sekali lagi, lalu kirim." }
  ];

  /* ── logika murni ─────────────────────────────────────────────────────── */
  const person = () => ({ name: "", nickname: "", father: "", mother: "", childOrder: "pertama", instagram: "" });
  const place = () => ({ start: "", end: "", venueName: "", address: "", mapsUrl: "" });

  function defaultState() {
    return {
      contact: { name: "", wa: "", email: "" },
      slug: "", slugTouched: false,
      groom: person(), bride: person(),
      date: "", akad: place(), resepsi: Object.assign(place(), { same: true }),
      stories: [],
      gifts: [{ bank: "", number: "", holder: "", owner: "cpp" }],
      giftAddress: { recipient: "", phone: "", detail: "" },
      livestream: "", presetId: "", themeRaw: null, photoLink: "", song: "", notes: "",
      agree: false
    };
  }

  function slugify(text) {
    return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function suggestSlug(s) {
    const a = slugify(s.bride.nickname), b = slugify(s.groom.nickname);
    return a && b ? `${a}-dan-${b}` : "";
  }
  const t = (v) => String(v == null ? "" : v).trim();
  const digits = (v) => String(v || "").replace(/[^0-9+]/g, "");

  /** Daftar { path, msg } untuk satu langkah; kosong = lolos. */
  function validate(stepId, s) {
    const e = [];
    const need = (path, val, msg) => { if (!t(val)) e.push({ path, msg }); };
    if (stepId === "kenal") {
      need("contact.name", s.contact.name, "Nama kamu wajib diisi");
      if (digits(s.contact.wa).length < 8) e.push({ path: "contact.wa", msg: "Nomor WhatsApp belum benar" });
      if (!EMAIL.test(t(s.contact.email))) e.push({ path: "contact.email", msg: "Email belum benar" });
    }
    if (stepId === "pengantin") {
      [["groom", "pria"], ["bride", "wanita"]].forEach(([k, label]) => {
        need(`${k}.name`, s[k].name, `Nama lengkap ${label} wajib diisi`);
        need(`${k}.nickname`, s[k].nickname, `Nama panggilan ${label} wajib diisi`);
      });
      if (t(s.slug) && !SLUG.test(t(s.slug))) e.push({ path: "slug", msg: "Hanya huruf kecil, angka, dan tanda hubung (-)" });
    }
    if (stepId === "acara") {
      need("date", s.date, "Tanggal acara wajib diisi");
      need("akad.start", s.akad.start, "Jam akad wajib diisi");
      need("akad.venueName", s.akad.venueName, "Nama tempat akad wajib diisi");
      need("akad.address", s.akad.address, "Alamat akad wajib diisi");
      need("resepsi.start", s.resepsi.start, "Jam resepsi wajib diisi");
      if (!s.resepsi.same) {
        need("resepsi.venueName", s.resepsi.venueName, "Nama tempat resepsi wajib diisi");
        need("resepsi.address", s.resepsi.address, "Alamat resepsi wajib diisi");
      }
    }
    if (stepId === "cerita") {
      s.stories.forEach((st, i) => {
        if ((t(st.date) || t(st.text)) && !t(st.title)) e.push({ path: `stories.${i}.title`, msg: "Judul cerita wajib diisi" });
      });
    }
    if (stepId === "kasih") {
      s.gifts.forEach((g, i) => {
        const started = t(g.bank) || t(g.number) || t(g.holder);
        if (!started) return;
        need(`gifts.${i}.bank`, g.bank, "Nama bank wajib diisi");
        need(`gifts.${i}.number`, g.number, "Nomor rekening wajib diisi");
        need(`gifts.${i}.holder`, g.holder, "Atas nama wajib diisi");
      });
    }
    if (stepId === "kirim" && !s.agree) e.push({ path: "agree", msg: "Centang dulu ya" });
    return e;
  }

  const cap = (v, n) => t(v).slice(0, n);

  /** state → payload yang dikirim (bentuknya dibaca provision-invitation). */
  function buildPayload(s, presets) {
    const preset = (presets || []).find((p) => p.id === s.presetId);
    const venue = (p) => ({ venueName: cap(p.venueName, 120), address: cap(p.address, 300), mapsUrl: cap(p.mapsUrl, 300) });
    const akadV = venue(s.akad);
    const resepsiV = s.resepsi.same ? akadV : venue(s.resepsi);
    const per = (p) => ({
      name: cap(p.name, 80), nickname: cap(p.nickname, 30), father: cap(p.father, 80), mother: cap(p.mother, 80),
      childOrder: cap(p.childOrder, 20), instagram: cap(p.instagram, 40).replace(/^@+/, "")
    });
    return {
      contactName: cap(s.contact.name, 80),
      contactWa: digits(s.contact.wa).slice(0, 20),
      contactEmail: cap(s.contact.email, 120).toLowerCase(),
      preferredSlug: slugify(t(s.slug) || suggestSlug(s)),
      template: "klasik",
      couple: { groom: per(s.groom), bride: per(s.bride) },
      event: {
        date: t(s.date),
        akad: Object.assign({ start: t(s.akad.start), end: t(s.akad.end) }, akadV),
        resepsi: Object.assign({ start: t(s.resepsi.start), end: t(s.resepsi.end), sameVenue: !!s.resepsi.same }, resepsiV)
      },
      loveStory: s.stories.filter((x) => t(x.title)).slice(0, MAX_STORIES)
        .map((x) => ({ date: cap(x.date, 40), title: cap(x.title, 80), text: cap(x.text, 400) })),
      gift: {
        accounts: s.gifts.filter((g) => t(g.bank) && t(g.number) && t(g.holder)).slice(0, MAX_GIFTS)
          .map((g) => ({ bank: cap(g.bank, 40), number: cap(g.number, 40), holder: cap(g.holder, 80), owner: g.owner === "cpw" ? "cpw" : "cpp" })),
        address: { recipient: cap(s.giftAddress.recipient, 80), phone: cap(s.giftAddress.phone, 30), detail: cap(s.giftAddress.detail, 300) }
      },
      livestream: { youtube: cap(s.livestream, 200) },
      theme: preset ? { presetId: preset.id, label: preset.label || "", colors: preset.colors || {} }
        : (s.presetId && s.themeRaw && s.themeRaw.presetId === s.presetId ? s.themeRaw : null),
      extras: { photoLink: cap(s.photoLink, 300), song: cap(s.song, 120), notes: cap(s.notes, 500) },
      consent: !!s.agree,
      source: "catin"
    };
  }

  /* ── payload → state, dan payload → teks yang bisa dibaca ──────────────── */
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const niceDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) return "";
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return `${DAYS[d.getUTCDay()]}, ${m[3]} ${MONTHS[+m[2] - 1] || ""} ${m[1]}`;
  };

  /** Kebalikan buildPayload: untuk mengubah draft yang sudah dikirim. */
  function fromPayload(p) {
    p = p && typeof p === "object" ? p : {};
    const s = defaultState();
    const pick = (o) => (o && typeof o === "object" ? o : {});
    const per = (x) => { x = pick(x); return Object.assign(person(), {
      name: t(x.name), nickname: t(x.nickname), father: t(x.father), mother: t(x.mother),
      childOrder: ORDERS.includes(x.childOrder) ? x.childOrder : "pertama", instagram: t(x.instagram) }); };
    const plc = (x) => { x = pick(x); return { start: t(x.start), end: t(x.end), venueName: t(x.venueName), address: t(x.address), mapsUrl: t(x.mapsUrl) }; };
    s.contact = { name: t(p.contactName), wa: t(p.contactWa), email: t(p.contactEmail) };
    s.slug = t(p.preferredSlug); s.slugTouched = true;
    s.groom = per(pick(p.couple).groom); s.bride = per(pick(p.couple).bride);
    const ev = pick(p.event);
    s.date = t(ev.date);
    s.akad = plc(ev.akad);
    const rs = pick(ev.resepsi);
    s.resepsi = Object.assign(plc(rs), { same: rs.sameVenue !== false });
    if (s.resepsi.same) Object.assign(s.resepsi, { venueName: "", address: "", mapsUrl: "" });
    s.stories = (Array.isArray(p.loveStory) ? p.loveStory : []).slice(0, MAX_STORIES).map((x) => ({ date: t(pick(x).date), title: t(pick(x).title), text: t(pick(x).text) }));
    const accs = (Array.isArray(pick(p.gift).accounts) ? p.gift.accounts : []).slice(0, MAX_GIFTS)
      .map((a) => ({ bank: t(pick(a).bank), number: t(pick(a).number), holder: t(pick(a).holder), owner: pick(a).owner === "cpw" ? "cpw" : "cpp" }));
    s.gifts = accs.length ? accs : [{ bank: "", number: "", holder: "", owner: "cpp" }];
    const ad = pick(pick(p.gift).address);
    s.giftAddress = { recipient: t(ad.recipient), phone: t(ad.phone), detail: t(ad.detail) };
    s.livestream = t(pick(p.livestream).youtube);
    const th = pick(p.theme);
    s.presetId = t(th.presetId); s.themeRaw = th.presetId ? th : null;
    const ex = pick(p.extras);
    s.photoLink = t(ex.photoLink); s.song = t(ex.song); s.notes = t(ex.notes);
    return s;
  }

  /** Payload → kelompok {judul, emoji, baris[[label, nilai]]} untuk dibaca pengirim. */
  function describe(p) {
    p = p && typeof p === "object" ? p : {};
    const c = p.couple || {}, ev = p.event || {}, g = p.gift || {}, ex = p.extras || {};
    const who = (x) => { x = x || {}; return [
      ["Nama", `${x.name || "—"}${x.nickname ? ` (${x.nickname})` : ""}`],
      ["Anak ke-", x.childOrder || "—"], ["Orang tua", [x.father, x.mother].filter(Boolean).join(" & ") || "—"],
      ["Instagram", x.instagram ? "@" + x.instagram : "—"]]; };
    const place = (x) => { x = x || {}; return `${x.start || "—"}${x.end ? " – " + x.end : ""} · ${[x.venueName, x.address].filter(Boolean).join(", ") || "—"}`; };
    const groups = [
      { t: "Kontak", e: "👋", rows: [["Nama", p.contactName || "—"], ["WhatsApp", p.contactWa || "—"], ["Email", p.contactEmail || "—"]] },
      { t: "Calon pengantin pria", e: "🤵", rows: who(c.groom) },
      { t: "Calon pengantin wanita", e: "👰", rows: who(c.bride) },
      { t: "Alamat undangan", e: "🔗", rows: [["Link", "willcome.my.id/" + (p.preferredSlug || "…")]] },
      { t: "Acara", e: "📍", rows: [["Tanggal", niceDate(ev.date) || "—"], ["Akad", place(ev.akad)], ["Resepsi", place(ev.resepsi)]] }
    ];
    const stories = (p.loveStory || []).map((x, i) => [`Cerita ${i + 1}`, [x.date, x.title].filter(Boolean).join(" — ") + (x.text ? `: ${x.text}` : "")]);
    groups.push({ t: "Cerita kalian", e: "📖", rows: stories.length ? stories : [["", "Tidak diisi"]] });
    const accs = (g.accounts || []).map((a, i) => [`Rekening ${i + 1}`, `${a.bank} ${a.number} a.n. ${a.holder} (${a.owner === "cpw" ? "wanita" : "pria"})`]);
    const ad = g.address || {};
    if (ad.recipient || ad.detail || ad.phone) accs.push(["Alamat kado", [ad.recipient, ad.phone, ad.detail].filter(Boolean).join(" · ")]);
    groups.push({ t: "Tanda kasih", e: "🎁", rows: accs.length ? accs : [["", "Tidak diisi"]] });
    groups.push({ t: "Tampilan", e: "🎨", rows: [["Warna", (p.theme && p.theme.label) || "—"], ["Link foto", ex.photoLink || "—"],
      ["Live streaming", (p.livestream && p.livestream.youtube) || "—"], ["Lagu", ex.song || "—"], ["Catatan", ex.notes || "—"]] });
    return groups;
  }

  window.CatinForm = { STEPS, ORDERS, defaultState, validate, buildPayload, slugify, suggestSlug, fromPayload, describe, niceDate };

  /* ── antarmuka ────────────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  if (!$("step")) return;     // dimuat tanpa halaman (mis. dalam test logika)

  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let state = defaultState();
  let step = 0;
  let presets = null;       // dari templates/klasik/template.json
  let submitting = false;
  let mode = "new";         // "new" = kirim baru, "edit" = mengubah draft yang sudah dikirim
  let editToken = "";       // kode rahasia draft yang sedang diubah
  let viewing = null;       // draft yang sedang ditampilkan di layar baca
  const SUB_KEY = "catin_submitted_v1";

  function save() {
    if (mode === "edit") return;   // mengubah draft lama tidak boleh menimpa konsep formulir baru
    try { localStorage.setItem(STORE, JSON.stringify({ step, state })); } catch (_) { /* mode privat */ }
  }
  const getSub = () => { try { return JSON.parse(localStorage.getItem(SUB_KEY) || "null"); } catch (_) { return null; } };
  const setSub = (v) => { try { localStorage.setItem(SUB_KEY, JSON.stringify(v)); } catch (_) { /* mode privat */ } };
  const privateLink = (tok) => `${location.origin}/catin/?edit=${tok}`;
  async function rpc(name, body) {
    const res = await fetch(`${SB.url}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: SB.anonKey, Authorization: `Bearer ${SB.anonKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.message) || "Terjadi gangguan. Coba lagi ya.");
    return data;
  }
  function restore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || "null");
      if (raw && raw.state) {
        state = Object.assign(defaultState(), raw.state);
        step = Math.min(Math.max(Number(raw.step) || 0, 0), STEPS.length - 1);
        state.agree = false;     // persetujuan selalu diminta ulang saat kirim
      }
    } catch (_) { /* abaikan data rusak */ }
  }
  function token() {
    try {
      let v = localStorage.getItem(TOKEN_KEY);
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); localStorage.setItem(TOKEN_KEY, v); }
      return v;
    } catch (_) { return ""; }
  }

  function setPath(path, value) {
    const keys = path.split(".");
    let o = state;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  function getPath(path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), state); }

  /* pembangun kolom — semua bernilai lewat esc() */
  function field(label, path, o = {}) {
    const { type = "text", ph = "", req = false, hint = "", max = 120, attrs = "" } = o;
    return `<label class="field"><span>${label}${req ? "<i>*</i>" : ""}</span>
      <input type="${type}" data-p="${path}" value="${esc(getPath(path))}" placeholder="${esc(ph)}" maxlength="${max}" ${attrs}>
      ${hint ? `<small>${hint}</small>` : ""}</label>`;
  }
  function area(label, path, ph = "", max = 400) {
    return `<label class="field"><span>${label}</span><textarea data-p="${path}" placeholder="${esc(ph)}" maxlength="${max}">${esc(getPath(path))}</textarea></label>`;
  }
  function select(label, path, options) {
    return `<label class="field"><span>${label}</span><select data-p="${path}">${options.map((o) =>
      `<option value="${esc(o)}"${getPath(path) === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  }
  function personBlock(k, title, cls) {
    return `<div class="group ${cls}"><h3>${title}</h3>
      ${field("Nama lengkap", `${k}.name`, { req: true, ph: "Termasuk gelar bila ada", autocomplete: "off" })}
      <div class="grid two">
        ${field("Nama panggilan", `${k}.nickname`, { req: true, max: 30, ph: "Dipakai di cover" })}
        ${select(k === "groom" ? "Putra ke-" : "Putri ke-", `${k}.childOrder`, ORDERS)}
      </div>
      <div class="grid two">
        ${field("Nama ayah", `${k}.father`)}${field("Nama ibu", `${k}.mother`)}
      </div>
      ${field("Instagram (boleh dikosongkan)", `${k}.instagram`, { ph: "tanpa @", max: 40 })}</div>`;
  }
  function placeBlock(k, title, cls, withVenue) {
    return `<div class="group ${cls}"><h3>${title}</h3>
      <div class="grid two">${field("Jam mulai", `${k}.start`, { type: "time", req: true })}${field("Jam selesai", `${k}.end`, { type: "time" })}</div>
      ${withVenue ? `${field("Nama tempat", `${k}.venueName`, { req: true, ph: "Mis. Gedung Serbaguna" })}
        ${area("Alamat lengkap <i style='color:#f27d72;font-style:normal'>*</i>", `${k}.address`, "Jalan, kelurahan, kota", 300)}
        ${field("Link Google Maps (boleh dikosongkan)", `${k}.mapsUrl`, { type: "url", ph: "https://maps.app.goo.gl/…", max: 300 })}` : ""}</div>`;
  }

  function stepHtml(id) {
    if (id === "kenal") return `<div class="grid">
      ${field("Nama kamu", "contact.name", { req: true, ph: "Siapa yang kami hubungi?", max: 80 })}
      ${field("Nomor WhatsApp", "contact.wa", { type: "tel", req: true, ph: "08xx-xxxx-xxxx", max: 20, attrs: 'inputmode="tel"' })}
      ${field("Email", "contact.email", { type: "email", req: true, ph: "nama@email.com", max: 120, hint: "Dipakai untuk masuk ke panel admin undanganmu.", attrs: 'inputmode="email"' })}</div>`;
    if (id === "pengantin") return `${personBlock("groom", "🤵 Calon pengantin pria (CPP)", "mint")}${personBlock("bride", "👰 Calon pengantin wanita (CPW)", "peach")}
      <div class="group lav"><h3>🔗 Alamat undanganmu</h3>
        <label class="field"><span>Nama link</span><input type="text" data-p="slug" id="slug" value="${esc(state.slug)}" placeholder="julia-dan-kevin" maxlength="60" autocapitalize="none" spellcheck="false">
        <small id="slugPreview">${esc("willcome.my.id/" + (state.slug || "…"))}</small></label>
        <small class="small">Terisi otomatis dari nama panggilan. Boleh diganti.</small></div>`;
    if (id === "acara") return `<div class="grid">${field("Tanggal acara", "date", { type: "date", req: true, attrs: `min="${new Date().toISOString().slice(0, 10)}"` })}</div>
      ${placeBlock("akad", "💒 Akad nikah", "mint", true)}
      <div class="group peach"><h3>🎉 Resepsi</h3>
        <div class="grid two">${field("Jam mulai", "resepsi.start", { type: "time", req: true })}${field("Jam selesai", "resepsi.end", { type: "time" })}</div>
        <label class="check"><input type="checkbox" data-p="resepsi.same"${state.resepsi.same ? " checked" : ""}><span>Tempatnya sama dengan akad</span></label>
        ${state.resepsi.same ? "" : `${field("Nama tempat", "resepsi.venueName", { req: true })}${area("Alamat lengkap", "resepsi.address", "", 300)}${field("Link Google Maps (boleh dikosongkan)", "resepsi.mapsUrl", { type: "url", max: 300 })}`}</div>`;
    if (id === "cerita") return `<p class="small" style="margin-bottom:10px">Perjalanan kalian, singkat saja. Boleh dilewati.</p>
      ${state.stories.map((st, i) => `<div class="item"><div class="top"><span>Cerita ${i + 1}</span><button type="button" class="btn del" data-act="del-story" data-i="${i}">Hapus</button></div>
        <div class="grid two">${field("Kapan", `stories.${i}.date`, { ph: "Mis. 2022", max: 40 })}${field("Judul", `stories.${i}.title`, { ph: "Awal perkenalan", max: 80 })}</div>
        ${area("Ceritanya", `stories.${i}.text`, "Satu-dua kalimat saja", 400)}</div>`).join("")}
      ${state.stories.length < MAX_STORIES ? `<button type="button" class="btn add" data-act="add-story">+ Tambah cerita</button>` : ""}`;
    if (id === "kasih") return `<p class="small" style="margin-bottom:10px">Rekening untuk tamu yang ingin memberi tanda kasih. Boleh dilewati.</p>
      ${state.gifts.map((g, i) => `<div class="item"><div class="top"><span>Rekening ${i + 1}</span>${state.gifts.length > 1 ? `<button type="button" class="btn del" data-act="del-gift" data-i="${i}">Hapus</button>` : ""}</div>
        <div class="grid two">${field("Bank", `gifts.${i}.bank`, { ph: "BCA", max: 40 })}${field("Nomor rekening", `gifts.${i}.number`, { max: 40, attrs: 'inputmode="numeric"' })}</div>
        <div class="grid two">${field("Atas nama", `gifts.${i}.holder`, { max: 80 })}${select("Milik", `gifts.${i}.owner`, ["cpp", "cpw"]).replace(">cpp<", ">Pria (CPP)<").replace(">cpw<", ">Wanita (CPW)<")}</div></div>`).join("")}
      ${state.gifts.length < MAX_GIFTS ? `<button type="button" class="btn add" data-act="add-gift">+ Tambah rekening</button>` : ""}
      <div class="group peach" style="margin-top:14px"><h3>📦 Alamat kirim kado</h3>
        ${field("Nama penerima", "giftAddress.recipient")}${field("Nomor HP penerima", "giftAddress.phone", { type: "tel", max: 30 })}${area("Alamat lengkap", "giftAddress.detail", "", 300)}</div>`;
    if (id === "tampilan") return `<div class="group"><h3>🎨 Pilih warna</h3>
        <div class="swatches" id="swatches">${presets ? presets.map((p) => `<button type="button" class="sw" data-act="preset" data-id="${esc(p.id)}" aria-pressed="${state.presetId === p.id}">
          <b>${esc(p.label)}</b><span class="dots">${Object.values(p.colors || {}).slice(0, 5).map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</span></button>`).join("") : '<p class="small">Memuat pilihan warna…</p>'}</div>
        <small class="small">Boleh dilewati. Warna bisa diganti kapan saja nanti.</small></div>
      ${field("Link foto kalian", "photoLink", { type: "url", ph: "Google Drive / Dropbox …", max: 300, hint: "Unggah foto ke Drive, lalu bagikan linknya (siapa pun yang punya link bisa melihat)." })}
      ${field("Link live streaming (boleh dikosongkan)", "livestream", { type: "url", ph: "https://youtube.com/…", max: 200 })}
      <div class="grid" style="margin-top:12px">${field("Lagu favorit (boleh dikosongkan)", "song", { ph: "Judul — penyanyi", max: 120 })}
      ${area("Catatan untuk kami", "notes", "Apa pun yang ingin kamu sampaikan", 500)}</div>`;
    return summary();
  }

  function summary() {
    const p = buildPayload(state, presets);
    const row = (k, v) => `<div><b>${k}</b><span>${esc(v || "—")}</span></div>`;
    return `<div class="summary">
      ${row("Kontak", `${p.contactName} · ${p.contactWa} · ${p.contactEmail}`)}
      ${row("Pengantin", `${p.couple.bride.nickname || "—"} & ${p.couple.groom.nickname || "—"}`)}
      ${row("Link undangan", "willcome.my.id/" + p.preferredSlug)}
      ${row("Tanggal", p.event.date)}
      ${row("Akad", `${p.event.akad.start} · ${p.event.akad.venueName}`)}
      ${row("Resepsi", `${p.event.resepsi.start} · ${p.event.resepsi.venueName}`)}
      ${row("Cerita", p.loveStory.length ? p.loveStory.length + " cerita" : "")}
      ${row("Rekening", p.gift.accounts.length ? p.gift.accounts.length + " rekening" : "")}
      ${row("Warna", p.theme ? p.theme.label : "")}
    </div>
    <label class="field" style="margin-top:14px"><span class="check"><input type="checkbox" data-p="agree"${state.agree ? " checked" : ""}>
      <span>Data ini benar, dan aku setuju dengan syarat &amp; ketentuan WillCome.</span></span></label>`;
  }

  /* Langkah yang boleh dilewati: isinya dilipat (tertutup) supaya yang tak mau mengisi
     cukup menekan Lanjut. Terbuka otomatis bila sudah ada isinya (mis. mengubah draft)
     atau bila ada isian yang perlu diperbaiki. */
  const OPTIONAL = {
    cerita: { title: "Mau menceritakan perjalanan kalian?", skip: "" },
    kasih: { title: "Mau menambahkan rekening & alamat kado?", skip: "" },
    tampilan: { title: "Mau memilih warna, foto, dan lagu?", skip: "Warna & lainnya bisa diatur nanti." }
  };
  const openOpt = new Set();
  function hasData(id) {
    if (id === "cerita") return state.stories.length > 0;
    if (id === "kasih") return state.gifts.some((g) => t(g.bank) || t(g.number) || t(g.holder)) || !!(t(state.giftAddress.recipient) || t(state.giftAddress.phone) || t(state.giftAddress.detail));
    if (id === "tampilan") return !!(state.presetId || t(state.photoLink) || t(state.livestream) || t(state.song) || t(state.notes));
    return false;
  }
  function wrapOptional(id, inner) {
    const o = OPTIONAL[id];
    if (!o) return inner;
    if (hasData(id)) openOpt.add(id);
    const open = openOpt.has(id);
    return `<div class="skip" role="note"><b>✨ Langkah ini boleh dilewati</b><span>Langsung tekan <em>Lanjut</em> kalau tidak mau mengisi. ${o.skip}</span></div>
      <details class="opt" data-opt="${id}"${open ? " open" : ""}><summary><span>${o.title}</span><i aria-hidden="true">${open ? "Tutup" : "Ketuk untuk mengisi"}</i></summary>
      <div class="optbody">${inner}</div></details>`;
  }

  function render() {
    const s = STEPS[step];
    $("progress").innerHTML = STEPS.map((_, i) => `<li class="${i < step ? "on" : i === step ? "now" : ""}"></li>`).join("");
    $("step").innerHTML = `<div class="stephead"><div class="e">${s.e}</div><div><h2>${s.t}</h2><p>Langkah ${step + 1} dari ${STEPS.length} · ${s.d}</p></div></div>${wrapOptional(s.id, stepHtml(s.id))}`;
    $("back").hidden = step === 0 && mode !== "edit";
    $("back").textContent = step === 0 && mode === "edit" ? "Batal" : "Kembali";
    $("next").textContent = step === STEPS.length - 1 ? (mode === "edit" ? "Simpan perubahan 💾" : "Kirim 🚀") : "Lanjut";
    $("next").disabled = submitting;
    syncGlow();
    showError("");
    if (s.id === "tampilan" && !presets) loadPresets();
  }
  /** Tombol Lanjut menonjol selama langkah opsional masih tertutup (jalan pintas yang disarankan). */
  function syncGlow() {
    const det = document.querySelector("details.opt");
    const skipping = !!det && !det.open && step < STEPS.length - 1;
    $("next").classList.toggle("glow", skipping);
  }
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details.opt")) return;
    d.open ? openOpt.add(d.dataset.opt) : openOpt.delete(d.dataset.opt);
    const hint = d.querySelector("summary i"); if (hint) hint.textContent = d.open ? "Tutup" : "Ketuk untuk mengisi";
    syncGlow();
  }, true);
  function showError(msg) { const el = $("error"); el.textContent = msg; el.hidden = !msg; }
  function markBad(errors) {
    document.querySelectorAll(".field.bad").forEach((el) => { el.classList.remove("bad"); const m = el.querySelector(".msg"); if (m) m.remove(); });
    let first = null;
    errors.forEach((er) => {
      const el = document.querySelector(`[data-p="${er.path}"]`);
      const box = el && el.closest(".field");
      if (!box) return;
      const fold = el.closest("details.opt");
      if (fold && !fold.open) fold.open = true;     // isian yang salah tidak boleh tersembunyi
      box.classList.add("bad");
      box.insertAdjacentHTML("beforeend", `<span class="msg">${esc(er.msg)}</span>`);
      first = first || el;
    });
    if (first) first.focus({ preventScroll: false });
  }

  async function loadPresets() {
    try {
      const j = await (await fetch("templates/klasik/template.json")).json();
      presets = (j.editor && j.editor.presets) || [];
    } catch (_) { presets = []; }
    if (STEPS[step].id === "tampilan") { const keep = window.scrollY; render(); window.scrollTo(0, keep); }
  }

  function go(n) { step = Math.max(0, Math.min(STEPS.length - 1, n)); save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function submit() {
    if (submitting) return;
    submitting = true; $("next").disabled = true; $("next").textContent = "Mengirim…"; showError("");
    const payload = Object.assign(buildPayload(state, presets), { website: $("hp").value });
    try {
      if (mode === "edit") {
        await rpc("update_client_draft", { p_token: editToken, p_payload: payload });
        const tok = editToken;
        mode = "new"; state = defaultState(); step = 0;
        await openView(tok, "Perubahan tersimpan ✓");
      } else {
        const data = await rpc("submit_client_draft", { p_device_token: token(), p_payload: payload });
        try { localStorage.removeItem(STORE); } catch (_) { /* abaikan */ }
        if (data && data.editToken) setSub({ token: data.editToken, code: data.code });
        $("code").textContent = (data && data.code) || "—";
        $("privLink").value = data && data.editToken ? privateLink(data.editToken) : "";
        $("copyLink").parentElement.parentElement.hidden = !(data && data.editToken);
        $("doneView").hidden = !(data && data.editToken);
        show("done");
      }
    } catch (err) {
      showError(err && err.message ? err.message : "Gagal mengirim. Periksa koneksi lalu coba lagi.");
    } finally {
      submitting = false; $("next").disabled = false;
      if (!$("app").hidden) $("next").textContent = step === STEPS.length - 1 ? (mode === "edit" ? "Simpan perubahan 💾" : "Kirim 🚀") : "Lanjut";
    }
  }

  /** Tampilkan tepat satu layar: form, done, view. */
  function show(which) {
    $("app").hidden = which !== "app";
    $("done").hidden = which !== "done";
    $("view").hidden = which !== "view";
    $("hero").hidden = which === "done";
    $("again").hidden = which !== "app" || mode === "edit" || !getSub();
    window.scrollTo({ top: 0 });
  }

  const STATUS_LABEL = {
    baru: ["Menunggu kami proses", "baru"], diproses: ["Sedang kami kerjakan", "diproses"],
    dibuat: ["Undangan sudah dibuat 🎉", "dibuat"], ditolak: ["Belum bisa kami proses", "ditolak"]
  };

  /** Layar baca: semua yang pernah dikirim + status; tombol ubah hanya bila masih boleh. */
  async function openView(tok, notice) {
    show("view");
    $("viewHead").innerHTML = '<p class="small">Memuat datamu…</p>';
    $("viewBody").innerHTML = ""; $("viewNote").textContent = "";
    $("viewEdit").hidden = true;
    let draft = null;
    try { draft = await rpc("get_client_draft", { p_token: tok }); } catch (err) {
      $("viewHead").innerHTML = `<div class="head"><h2>Ups</h2><p class="small">${esc(err.message)}</p></div>`; return;
    }
    if (!draft) {
      viewing = null;
      $("viewHead").innerHTML = '<div class="head"><h2>Link tidak dikenali</h2><p class="small">Mungkin ada yang kurang saat menyalin. Cek lagi linknya, atau kirim data baru.</p></div>';
      return;
    }
    viewing = Object.assign({ token: tok }, draft);
    setSub({ token: tok, code: draft.code });
    const [label, cls] = STATUS_LABEL[draft.status] || [draft.status, "baru"];
    $("viewHead").innerHTML = `<div class="head"><h2>Data yang kamu kirim</h2>
      <span class="chip ${esc(cls)}">${esc(label)}</span> <span class="small">Kode ${esc(draft.code)}</span></div>
      ${notice ? `<p class="ok">${esc(notice)}</p>` : ""}`;
    $("viewBody").innerHTML = describe(draft.payload).map((g) => `<div class="vgroup"><h3>${g.e} ${esc(g.t)}</h3><dl>${
      g.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>`).join("");
    $("viewEdit").hidden = !draft.editable;
    $("viewNote").textContent = draft.editable
      ? "Masih bisa diubah sampai kami mulai membuat undangannya."
      : draft.status === "dibuat" ? "Undanganmu sudah dibuat, jadi datanya tidak bisa diubah dari sini. Hubungi kami kalau ada yang perlu diganti."
      : "Hubungi kami kalau ada yang ingin ditanyakan.";
  }

  function startEdit() {
    if (!viewing || !viewing.editable) return;
    mode = "edit"; editToken = viewing.token;
    state = fromPayload(viewing.payload); step = 0;
    state.agree = false;
    if (!presets) loadPresets();    // supaya warna pilihan tetap terbaca saat disimpan
    show("app"); render();
  }
  function cancelEdit() {
    const tok = editToken;
    mode = "new"; editToken = ""; state = defaultState(); step = 0; restore();
    openView(tok);
  }

  /* ── peristiwa ────────────────────────────────────────────────────────── */
  function onField(e) {
    const el = e.target.closest("[data-p]");
    if (!el) return;
    const path = el.dataset.p;
    const value = el.type === "checkbox" ? el.checked : el.value;
    setPath(path, value);
    if (path === "slug") { state.slugTouched = true; }
    if ((path === "groom.nickname" || path === "bride.nickname") && !state.slugTouched) {
      state.slug = suggestSlug(state); const s = $("slug"); if (s) s.value = state.slug;
    }
    if (path === "slug" || path === "groom.nickname" || path === "bride.nickname") {
      const pv = $("slugPreview"); if (pv) pv.textContent = "willcome.my.id/" + (state.slug || "…");
    }
    if (path === "resepsi.same") render();
    save();
  }
  document.addEventListener("input", onField);
  document.addEventListener("change", (e) => { if (e.target.matches("select,input[type=checkbox],input[type=date],input[type=time]")) onField(e); });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = Number(b.dataset.i);
    switch (b.dataset.act) {
      case "add-story": state.stories.push({ date: "", title: "", text: "" }); break;
      case "del-story": state.stories.splice(i, 1); break;
      case "add-gift": state.gifts.push({ bank: "", number: "", holder: "", owner: "cpp" }); break;
      case "del-gift": state.gifts.splice(i, 1); break;
      case "preset": state.presetId = state.presetId === b.dataset.id ? "" : b.dataset.id; break;
      default: return;
    }
    save(); render();
  });

  $("back").addEventListener("click", () => { if (mode === "edit" && step === 0) cancelEdit(); else go(step - 1); });
  $("viewEdit").addEventListener("click", startEdit);
  $("viewNew").addEventListener("click", () => { mode = "new"; state = defaultState(); step = 0; restore(); show("app"); render(); });
  $("doneView").addEventListener("click", () => { const sub = getSub(); if (sub) openView(sub.token); });
  $("againOpen").addEventListener("click", () => { const sub = getSub(); if (sub) openView(sub.token); });
  $("copyLink").addEventListener("click", async () => {
    const el = $("privLink");
    try { await navigator.clipboard.writeText(el.value); } catch (_) { el.select(); document.execCommand && document.execCommand("copy"); }
    $("copyLink").textContent = "Tersalin ✓"; setTimeout(() => { $("copyLink").textContent = "Salin"; }, 1800);
  });
  $("next").addEventListener("click", () => {
    const errors = validate(STEPS[step].id, state);
    if (errors.length) { markBad(errors); showError("Ada isian yang belum lengkap."); return; }
    if (step === STEPS.length - 1) submit(); else go(step + 1);
  });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); $("next").click(); });

  restore();
  render();
  show("app");
  // Link pribadi (?edit=KODE): buka layar baca, lalu bersihkan kode dari alamat.
  const fromUrl = new URLSearchParams(location.search).get("edit");
  if (fromUrl) {
    try { history.replaceState(null, "", location.pathname); } catch (_) { /* abaikan */ }
    openView(fromUrl.trim());
  }
})();
