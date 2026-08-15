/**
 * Satu pintu baca/tulis site_content untuk seluruh halaman panel. Dimuat SEKALI
 * per sesi (di-cache di memori — halaman berikutnya memakai objek yang sama,
 * bukan fetch ulang), supaya perpindahan antar 18 halaman terasa instan.
 *
 * Simpan tetap memakai pola aman SELECT → ubah HANYA key yang diminta →
 * UPSERT objek utuh: kalau tab lain (jarang, tapi mungkin — dua device admin)
 * mengubah key lain di antara load dan save, perubahan itu tidak ikut
 * tertimpa. Sebelum ada file ini, pola yang sama disalin-tempel di 6+ tempat
 * (content.js/theme.js/fonts.js/template.js/visual-editor.js/photos.js) —
 * sekarang cukup satu implementasi.
 */
(function () {
  const { sb } = window.AdminAPI;
  let content = null;
  let loadPromise = null;

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  /** Tanam default untuk key yang belum ada di site_content versi lama —
   * dipindah dari content.js lama (seedDefaults), dijalankan SEKALI di sini
   * saat load supaya seluruh halaman melihat state yang sudah konsisten,
   * bukan masing-masing menjaga guard `|| []`/`|| {}` sendiri-sendiri. */
  function seedDefaults(c) {
    c.livestream = Object.assign({ youtube: "", instagram: "", tiktok: "" }, isPlainObject(c.livestream) ? c.livestream : {});
    c.galleryVideo = Object.assign({ youtube: "" }, isPlainObject(c.galleryVideo) ? c.galleryVideo : {});
    if (!isPlainObject(c.gift)) c.gift = {};
    if (!Array.isArray(c.gift.accounts)) c.gift.accounts = [];
    c.gift.accounts.forEach((a) => { if (typeof a.template !== "string") a.template = ""; });
    if (!isPlainObject(c.gift.address)) c.gift.address = {};
    if (typeof c.gift.address.template !== "string") c.gift.address.template = "";
    if (c.gift.contactCPP === undefined) c.gift.contactCPP = "";
    if (c.gift.contactCPW === undefined) c.gift.contactCPW = "";
    if (!Array.isArray(c.giftRecommendations)) c.giftRecommendations = [];
    if (!isPlainObject(c.audio)) c.audio = {};
    if (typeof c.audio.src !== "string") c.audio.src = "";
    if (typeof c.audio.path !== "string") c.audio.path = "";
    if (typeof c.audio.title !== "string") c.audio.title = "";
    if (!Array.isArray(c.guestGreetings)) c.guestGreetings = [];
    if (c.defaultGuestGreeting === undefined) c.defaultGuestGreeting = "Kepada Yth.";
    if (typeof c.closing !== "object" || c.closing === null) c.closing = { text: "" };
    if (typeof c.closing.text !== "string") c.closing.text = "";
    c.guestGreetings.forEach((g) => {
      if (!Array.isArray(g.names)) g.names = [];
      if (typeof g.label !== "string") g.label = "";
      if (typeof g.closing !== "string") g.closing = "";
    });
    if (!isPlainObject(c.event)) c.event = {};
    ["akad", "resepsi"].forEach((key) => {
      if (!isPlainObject(c.event[key])) c.event[key] = {};
      if (!isPlainObject(c.event[key].venue)) {
        c.event[key].venue = {
          name: (c.event.venue && typeof c.event.venue.name === "string") ? c.event.venue.name : "",
          address: (c.event.venue && typeof c.event.venue.address === "string") ? c.event.venue.address : "",
          mapsUrl: (c.event.venue && typeof c.event.venue.mapsUrl === "string") ? c.event.venue.mapsUrl : ""
        };
      }
    });
    if (!isPlainObject(c.subcover)) c.subcover = {};
    if (typeof c.subcover.enabled !== "boolean") c.subcover.enabled = true;
    if (typeof c.subcover.quoteLine1 !== "string") c.subcover.quoteLine1 = "All because two people";
    if (typeof c.subcover.quoteLine2 !== "string") c.subcover.quoteLine2 = "fell in love ...";
    if (!isPlainObject(c.qrCheckin)) c.qrCheckin = {};
    if (typeof c.qrCheckin.enabled !== "boolean") c.qrCheckin.enabled = true;
    if (!isPlainObject(c.dresscode)) c.dresscode = { text: "", colors: [] };
    if (!Array.isArray(c.dresscode.colors)) c.dresscode.colors = [];
    if (!isPlainObject(c.quotePhoto)) c.quotePhoto = { quote: "" };
    if (!Array.isArray(c.loveStory)) c.loveStory = [];
    if (!isPlainObject(c.theme)) c.theme = {};
    if (!isPlainObject(c.typography)) c.typography = { elements: {} };
    if (!isPlainObject(c.typography.elements)) c.typography.elements = {};
    if (!isPlainObject(c.visualEditor)) c.visualEditor = { elements: {} };
    if (!isPlainObject(c.visualEditor.elements)) c.visualEditor.elements = {};
    return c;
  }

  async function fetchFresh() {
    const { data, error } = await window.AdminAPI.query(
      sb.from("site_content").select("content").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1).maybeSingle(),
      "Permintaan konten"
    );
    if (error && error.code !== "PGRST116") throw error;
    return data && data.content ? data.content : window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);
  }

  /** Muat sekali per sesi. Panggilan berikutnya (halaman lain) memakai cache
   * yang sama — dipanggil ulang HANYA lewat reload(). */
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = fetchFresh().then((c) => {
      content = seedDefaults(c);
      return content;
    }).catch((err) => {
      loadPromise = null; // gagal — halaman berikutnya boleh coba lagi
      throw err;
    });
    return loadPromise;
  }

  function reload() {
    loadPromise = null;
    return load();
  }

  function getContent() {
    return content;
  }

  function get(path, fallback) {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), content);
    return v === undefined ? fallback : v;
  }

  function set(path, value) {
    const keys = path.split(".");
    let o = content;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  /** Simpan HANYA top-level key yang disebut di `keys`, memakai nilai
   * terkini dari `content` (working copy in-memory) — SELECT-merge-UPSERT
   * satu pintu (lihat komentar berkas). Ini SATU-SATUNYA tempat yang
   * memanggil .upsert("site_content") di seluruh panel v2. */
  async function save(keys) {
    let fresh;
    try {
      fresh = await fetchFresh();
    } catch (err) {
      return { error: err };
    }
    seedDefaults(fresh);
    keys.forEach((k) => { fresh[k] = content[k]; });
    const { error } = await window.AdminAPI.query(
      sb.from("site_content").upsert(
        { invitation_id: window.AdminAPI.tenant.invitationId, id: 1, content: fresh, updated_at: new Date().toISOString() },
        { onConflict: "invitation_id,id" }
      ),
      "Penyimpanan konten"
    );
    if (!error) content = fresh; // resync cache lokal dengan hasil merge di DB
    return { error };
  }

  window.PanelStore = { load, reload, getContent, get, set, save };
})();
