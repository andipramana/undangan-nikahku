/* PWA untuk panel (admin, check-in QR, kirim WA) dan halaman undangan tamu.
 *
 * Situsnya statis dan satu cangkang melayani semua tenant, jadi manifest
 * TIDAK bisa berupa berkas tetap: nama, start_url, dan scope-nya berbeda per
 * tenant (/julia-dan-kevin/admin/ vs /admin/). Manifest dibangun di sini dari
 * TenantContext lalu dipasang lewat blob URL. URL di dalamnya wajib absolut —
 * blob: bukan basis yang bisa meresolusi "/path".
 *
 * Android/Chrome memakai manifest ini. iOS Safari memakai meta apple-* di
 * <head> dan URL halaman saat "Tambah ke Layar Utama", jadi tiap tenant dan
 * halaman otomatis terpasang di alamatnya masing-masing.
 *
 * Service worker (/sw.js) hanya menyentuh jalur panel, bukan halaman tamu.
 */
(function () {
  "use strict";

  const tenant = window.TenantContext;
  if (!tenant) return;

  const origin = location.origin;
  const surface = ["admin-qr", "wa", "invitation"].includes(tenant.surface) ? tenant.surface : "admin";
  const isGuest = surface === "invitation";

  /** Sama dengan AdminAPI.tenantName (panel/core.js) — diturunkan dari slug. */
  function tenantName() {
    if (window.AdminAPI && typeof window.AdminAPI.tenantName === "function") return window.AdminAPI.tenantName();
    const slug = tenant.slug || "root";
    if (slug === "root") return "Undangan Utama";
    return slug.split("-").filter(Boolean)
      .map((w) => (w === "dan" ? "&" : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ");
  }

  const LABEL = {
    admin: { name: "Admin", short: "WillCome" },
    "admin-qr": { name: "Check-in", short: "Check-in" },
    wa: { name: "Kirim WA", short: "Kirim WA" },
    invitation: { name: "Undangan", short: "Undangan" }
  }[surface];

  // Undangan tamu: ikon & warna tema mengikuti cover klasik (emas di atas gelap),
  // bukan ikon panel — tamu tidak boleh melihat "aplikasi admin".
  const ICON_PREFIX = isGuest ? "inv" : "icon";
  const COLOR = isGuest ? "#14120f" : "#f5f6f8";

  // Alamat awal aplikasi terpasang. Untuk tamu, sapaan personal (?to=Nama)
  // ikut terbawa supaya aplikasi terbuka dengan nama tamunya; parameter
  // pratinjau (template, preview) tidak. tenant.js sudah memulihkan query asli
  // saat boot, jadi location.search di sini benar.
  function startPathFor() {
    const base = tenant.path(surface);                             // "/julia-dan-kevin/admin/" | "/julia-dan-kevin/"
    if (!isGuest) return base;
    const params = new URLSearchParams(location.search);
    ["template", "preview", "__tenant_route"].forEach((k) => params.delete(k));
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  }
  const startPath = startPathFor();
  const idPath = tenant.path(surface);                              // identitas aplikasi tanpa query
  // Scope = akar tenant supaya pindah antar panel (admin ↔ check-in ↔ WA) dan
  // ke undangannya sendiri tidak keluar dari aplikasi. Root: "/".
  const scopePath = tenant.slug === "root" ? "/" : `/${tenant.slug}/`;

  function buildManifest() {
    // Tamu: nama = judul halaman ("Julia & Kevin — The Wedding") begitu data
    // tenant sudah dimuat; sebelum itu cukup nama dari slug.
    const pageTitle = (document.title || "").trim();
    const name = isGuest
      ? (pageTitle && !/^Undangan Pernikahan$/i.test(pageTitle) ? pageTitle : `Undangan ${tenantName()}`)
      : `${LABEL.name} ${tenantName()} — WillCome`;
    return {
      id: origin + idPath,
      name,
      short_name: isGuest ? "Undangan" : LABEL.short,
      description: isGuest ? "Undangan pernikahan digital." : "Panel pengelola undangan digital WillCome.",
      lang: "id",
      start_url: origin + startPath,
      scope: origin + scopePath,
      // Layar penuh bila didukung; Chrome Android jatuh ke standalone, iOS
      // memakai apple-mobile-web-app-capable.
      display: "standalone",
      display_override: ["fullscreen", "standalone"],
      background_color: COLOR,
      theme_color: COLOR,
      icons: [
        { src: `${origin}/assets/icons/${ICON_PREFIX}-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${origin}/assets/icons/${ICON_PREFIX}-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: `${origin}/assets/icons/${ICON_PREFIX}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    };
  }

  let manifestUrl = null;
  function installManifest() {
    try {
      document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
      const link = document.createElement("link");
      link.rel = "manifest";
      manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(buildManifest())], { type: "application/manifest+json" }));
      link.href = manifestUrl;
      document.head.appendChild(link);
    } catch (_) { /* tanpa manifest, halaman tetap berfungsi normal */ }
  }
  installManifest();

  // Judul undangan baru diisi main.js setelah data tenant tiba; bangun ulang
  // manifest supaya nama aplikasi memakai nama pasangan yang sebenarnya.
  if (isGuest) {
    const titleEl = document.querySelector("title");
    if (titleEl && window.MutationObserver) {
      new MutationObserver(installManifest).observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  // iOS: judul di bawah ikon layar utama.
  let title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!title) {
    title = document.createElement("meta");
    title.name = "apple-mobile-web-app-title";
    document.head.appendChild(title);
  }
  title.content = isGuest ? "Undangan" : LABEL.short;

  // Service worker hanya ada di HTTPS / localhost. Lewat LAN http://192.168.x.x
  // PWA tidak bisa dipasang — uji di willcome.my.id setelah deploy.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }, { once: true });
  }
})();
