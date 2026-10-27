/* PWA untuk panel (admin, check-in QR, kirim WA).
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
  const surface = tenant.surface === "admin-qr" || tenant.surface === "wa" ? tenant.surface : "admin";

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
    wa: { name: "Kirim WA", short: "Kirim WA" }
  }[surface];

  const startPath = tenant.path(surface);                          // "/julia-dan-kevin/admin/"
  // Scope = akar tenant supaya pindah antar panel (admin ↔ check-in ↔ WA) dan
  // ke undangannya sendiri tidak keluar dari aplikasi. Root: "/".
  const scopePath = tenant.slug === "root" ? "/" : `/${tenant.slug}/`;

  const manifest = {
    id: origin + startPath,
    name: `${LABEL.name} ${tenantName()} — WillCome`,
    short_name: LABEL.short,
    description: "Panel pengelola undangan digital WillCome.",
    lang: "id",
    start_url: origin + startPath,
    scope: origin + scopePath,
    // Layar penuh bila didukung; Chrome Android jatuh ke standalone, iOS
    // memakai apple-mobile-web-app-capable.
    display: "standalone",
    display_override: ["fullscreen", "standalone"],
    background_color: "#f5f6f8",
    theme_color: "#f5f6f8",
    icons: [
      { src: origin + "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: origin + "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: origin + "/assets/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };

  try {
    document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
    document.head.appendChild(link);
  } catch (_) { /* tanpa manifest, panel tetap berfungsi normal */ }

  // iOS: judul di bawah ikon layar utama.
  let title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!title) {
    title = document.createElement("meta");
    title.name = "apple-mobile-web-app-title";
    document.head.appendChild(title);
  }
  title.content = LABEL.short;

  // Service worker hanya ada di HTTPS / localhost. Lewat LAN http://192.168.x.x
  // PWA tidak bisa dipasang — uji di willcome.my.id setelah deploy.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }, { once: true });
  }
})();
