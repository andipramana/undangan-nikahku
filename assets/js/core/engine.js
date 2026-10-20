/** Mesin template v4 — template memiliki MARKUP-nya sendiri, bukan sekadar CSS.
 *
 * Versi sebelumnya hanya menukar file CSS sementara markup tetap dari
 * index.html yang kaku, sehingga urutan/posisi section mustahil dibedakan
 * antar template (lihat docs/kontrak-template.md untuk kontrak barunya).
 *
 * Urutan muat dirancang supaya TIDAK menambah waktu tunggu dibanding versi
 * satu-template: id template di-cache di localStorage, jadi aset template
 * (json + markup + css) mulai diunduh BERSAMAAN dengan RPC data, bukan
 * menunggu datanya tiba dulu. Kunjungan pertama membayar satu perjalanan
 * jaringan; kunjungan berikutnya tidak.
 */
(function () {
  "use strict";

  const DEFAULT_ID = "klasik";
  const CACHE_KEY = "wedding_template_id_" + ((window.TenantContext && window.TenantContext.slug) || "root");

  window.WeddingTemplates = window.WeddingTemplates || {};

  function cachedId() {
    try { return localStorage.getItem(CACHE_KEY) || null; } catch (_) { return null; }
  }
  function cacheId(id) {
    try { localStorage.setItem(CACHE_KEY, id); } catch (_) { /* mode privat — abaikan */ }
  }

  /** Urutan pemilihan: ?template= (pratinjau admin) → cache → default.
   * Nilai dari data Supabase diperiksa belakangan di applyIfDifferent(). */
  function initialId() {
    const fromUrl = (new URLSearchParams(location.search).get("template") || "").replace(/\/+$/, "");
    return fromUrl || cachedId() || DEFAULT_ID;
  }

  function loadCss(href, attr) {
    return new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      if (attr) link.dataset[attr] = "1";
      // Jangan pernah menggantung render karena satu CSS gagal (mis. CDN font
      // diblokir jaringan kantor) — tetap lanjut, tampilan sekadar kurang manis.
      link.onload = link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  }

  function loadJs(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false; // urutan eksekusi penting: sebagian modul saling bergantung
      s.dataset.templateAsset = "1";
      s.onload = s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal memuat ${url} (${res.status})`);
    return res.json();
  }

  /** Katalog template (templates/index.json), di-cache di memori. Dipakai untuk
   * memverifikasi bahwa templateId tersimpan milik tenant masih ada di katalog
   * aktif — kalau template lama sudah dihapus (mis. nocturne/kertas/sekar-jagat),
   * mesin jatuh ke DEFAULT_ID ("klasik") tanpa menulis balik ke database. */
  let catalogIdsPromise = null;
  function getCatalogIds() {
    if (!catalogIdsPromise) {
      catalogIdsPromise = fetchJson("templates/index.json")
        .then((data) => (data && Array.isArray(data.templates) ? data.templates.map((t) => t.id) : null))
        .catch(() => null);
    }
    return catalogIdsPromise;
  }

  async function resolveKnownId(id) {
    const target = String(id || "").trim() || DEFAULT_ID;
    if (target === DEFAULT_ID) return DEFAULT_ID;
    const ids = await getCatalogIds();
    if (Array.isArray(ids) && !ids.includes(target)) return DEFAULT_ID;
    return target;
  }

  /** Mulai unduh manifest + markup lebih awal, tanpa menunggu data undangan. */
  function prefetch(id) {
    return {
      id,
      manifest: fetchJson(`templates/${id}/template.json`),
      markup: fetch(`templates/${id}/markup.html`).then((r) => {
        if (!r.ok) throw new Error(`markup.html template "${id}" tidak ditemukan (${r.status})`);
        return r.text();
      })
    };
  }

  function applyTheme(vars) {
    const root = document.documentElement;
    Object.entries(vars || {}).forEach(([k, v]) => {
      if (k.startsWith("--")) root.style.setProperty(k, v);
    });
  }

  /** Warna pilihan client di atas warna bawaan manifest.
   *
   * Pemetaannya milik template: manifest.editor.colors mendaftarkan pasangan
   * key (tempat simpan di content.templates[<id>].theme.colors) ↔ variabel CSS
   * (nama var milik style.css template itu). Dengan begitu template dengan
   * variabel bernama apa pun — --color-* milik klasik, --nc-* milik Nocturne —
   * bisa diwarnai lewat halaman Warna yang sama, tanpa mesin tahu nama var
   * satu pun. Key yang tidak diisi client dilewati, jadi bawaan manifest tetap
   * berlaku (jangan pernah menulis string kosong ke CSS var). */
  function applyThemeOverrides(manifest, savedTheme) {
    const schema = (manifest.editor && manifest.editor.colors) || [];
    const saved = (savedTheme && savedTheme.colors) || {};
    const vars = {};
    schema.forEach((c) => {
      const value = saved[c.key];
      if (c.var && value) vars[c.var] = value;
    });
    applyTheme(vars);
  }

  /** Tipografi pilihan client, dipasang SETELAH render karena selector-nya
   * menunjuk elemen yang baru dibuat template.
   *
   * Pemetaannya milik template: manifest.editor.typography mendaftarkan
   * pasangan key (tempat simpan) ↔ selector (milik markup template itu).
   * Dengan begitu halaman Font di admin melayani template mana pun tanpa tahu
   * satu pun nama kelas — sama seperti halaman Warna. Hanya elemen yang
   * benar-benar disetel client yang disentuh; sisanya dibiarkan apa adanya
   * supaya desain bawaan template tetap utuh. */
  function applyTypographyOverrides(manifest, savedTypography) {
    const groups = (manifest.editor && manifest.editor.typography) || [];
    const saved = (savedTypography && savedTypography.elements) || {};
    if (!groups.length) return;

    const specs = new Map();
    groups.forEach((g) => (g.elements || []).forEach((e) => specs.set(e.key, e)));

    Object.entries(saved).forEach(([key, setting]) => {
      const spec = specs.get(key);
      if (!spec || !spec.selector || !setting) return;

      const family = String(setting.family || "").trim();
      if (family) loadFont(family);

      document.querySelectorAll(spec.selector).forEach((el) => {
        if (family) el.style.fontFamily = `"${family.replace(/"/g, "")}", sans-serif`;
        if (setting.size !== "" && Number(setting.size) > 0) el.style.fontSize = `${Number(setting.size)}px`;
        if (setting.weight !== "" && Number(setting.weight) >= 100) el.style.fontWeight = String(Number(setting.weight));
        if (setting.color) el.style.color = String(setting.color);
      });
    });
  }

  /** Muat satu keluarga font dari Google Fonts, sekali saja per nama. */
  function loadFont(family) {
    const id = "tpl-font-" + encodeURIComponent(family).replace(/%/g, "");
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") + ":wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }

  /** Pasang template ke halaman: aset → markup → render.js → render(ctx). */
  async function mount(pending, ctxFactory) {
    const { id } = pending;
    const [manifest, markup] = await Promise.all([pending.manifest, pending.markup]);

    const assets = manifest.assets || {};
    // CSS template dimuat SEBELUM markup dipasang supaya tidak ada kedip
    // "markup tanpa gaya" di layar.
    await Promise.all([
      ...(assets.fonts || []).map((h) => loadCss(h, "templateFont")),
      ...(assets.css || []).map((h) => loadCss(h, "templateAsset")),
      loadCss(`templates/${id}/style.css`, "templateStyle")
    ]);

    // ctx dibangun lebih awal daripada markup semata-mata supaya setelan warna
    // milik template aktif (ctx.tpl.theme) sudah bisa dipakai di bawah ini —
    // dipasang SEBELUM markup muncul, jadi tamu tidak pernah melihat kedipan
    // warna bawaan sebelum warna pilihan client.
    const root = document.getElementById("inv-root");
    const ctx = ctxFactory(manifest, root);

    applyTheme(manifest.theme);
    applyThemeOverrides(manifest, ctx.tpl && ctx.tpl.theme);

    root.innerHTML = markup;
    root.dataset.tpl = id;
    document.documentElement.dataset.tpl = id;

    // Modul perilaku yang diminta template, lalu render.js-nya sendiri.
    // Berurutan (async=false) karena sebagian modul lama saling bergantung.
    for (const src of assets.js || []) await loadJs(src);
    await loadJs(`templates/${id}/render.js`);

    const tpl = window.WeddingTemplates[id];
    if (!tpl || typeof tpl.render !== "function") {
      throw new Error(`Template "${id}" tidak mendaftarkan render() di window.WeddingTemplates`);
    }
    await tpl.render(ctx);
    applyTypographyOverrides(manifest, ctx.tpl && ctx.tpl.typography);
    cacheId(id);
    window.__ACTIVE_TEMPLATE = { id, manifest };
    return ctx;
  }

  window.WeddingEngine = {
    DEFAULT_ID, initialId, prefetch, mount,
    applyTheme, applyThemeOverrides, applyTypographyOverrides,
    getCatalogIds, resolveKnownId
  };
})();
