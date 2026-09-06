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

    applyTheme(manifest.theme);

    const root = document.getElementById("inv-root");
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
    const ctx = ctxFactory(manifest, root);
    await tpl.render(ctx);
    cacheId(id);
    window.__ACTIVE_TEMPLATE = { id, manifest };
    return ctx;
  }

  window.WeddingEngine = { DEFAULT_ID, initialId, prefetch, mount, applyTheme };
})();
