/* Service worker khusus PANEL (admin, check-in QR, kirim WA).
 *
 * Tujuannya satu: membuat panel bisa dipasang ke layar utama HP (PWA) dan
 * terbuka layar penuh. Halaman TAMU (undangan) sengaja tidak disentuh — kalau
 * ada bug di sini, undangan yang tayang tidak ikut terdampak.
 *
 * Dua hal yang dilakukannya:
 * 1. Jalur cantik panel (/<slug>/admin/, /<slug>/admin-qr/, /<slug>/wa/, serta
 *    /admin/ dst. untuk root) di GitHub Pages sebenarnya 404 yang dibelokkan
 *    404.html. Aplikasi terpasang butuh start_url yang langsung 200, jadi di
 *    sini jalur itu dijawab dengan cangkang statisnya (admin.html, dst.).
 *    tenant.js membaca slug langsung dari location.pathname, jadi tidak perlu
 *    ?__tenant_route= lagi.
 * 2. Jaringan dulu, cache hanya cadangan saat offline. Deploy baru langsung
 *    terbawa begitu online — tidak ada "versi lama nyangkut".
 *
 * 3. Undangan tamu — HANYA kalau diminta aplikasi terpasang (start_url memuat
 *    ?source=pwa). Alamat /<slug>/ di GitHub Pages adalah 404 yang dibelokkan ke
 *    /index.html?__tenant_route=…; /index.html berada DI LUAR cakupan aplikasi,
 *    sehingga Chrome menampilkan bar URL dan layar tidak penuh. Di sini
 *    /<slug>/ dijawab langsung dengan index.html (200, tetap di dalam cakupan).
 *    Kunjungan tamu biasa (tanpa ?source=pwa) sama sekali tidak dicegat.
 *
 * Request lintas-origin (Supabase, CDN) tidak pernah dicegat.
 */
"use strict";

const CACHE = "willcome-panel-v1";
const SHELLS = { admin: "/admin.html", "admin-qr": "/admin-qr.html", wa: "/wa.html" };

/** "/julia-dan-kevin/admin/" → "/admin.html"; bukan jalur panel → null. */
function adminShellFor(pathname) {
  const m = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?(admin-qr|admin|wa)\/?$/.exec(pathname || "");
  return m ? SHELLS[m[1]] : null;
}

// Folder/berkas nyata di akar situs — bukan slug undangan.
const RESERVED = new Set(["home", "demo", "catin", "admin", "admin-qr", "wa", "assets", "templates"]);

/** "/julia-dan-kevin/?source=pwa" → "/index.html". Tanpa penanda aplikasi → null. */
function guestShellFor(pathname, search) {
  const m = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname || "");
  if (!m || RESERVED.has(m[1])) return null;
  return new URLSearchParams(search || "").get("source") === "pwa" ? "/index.html" : null;
}

/** Sub-resource yang diminta halaman PANEL atau aplikasi undangan terpasang
 * (?source=pwa) — bukan halaman tamu biasa. Tanpa ini aplikasi terbuka offline
 * tetapi skripnya tidak ada, jadi layarnya kosong. */
function fromPanelPage(request) {
  if (!request.referrer) return false;
  try {
    const ref = new URL(request.referrer);
    return !!adminShellFor(ref.pathname) || !!guestShellFor(ref.pathname, ref.search)
      || /^\/(admin|admin-qr|wa)\.html$/.test(ref.pathname);
  } catch (_) { return false; }
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(cacheKey, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    return new Response("Sedang offline dan halaman ini belum pernah dibuka.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const shell = adminShellFor(url.pathname) || guestShellFor(url.pathname, url.search);
    if (!shell) return;                       // tamu biasa & lainnya: tidak disentuh
    event.respondWith(networkFirst(new Request(shell, { headers: request.headers }), shell));
    return;
  }

  if (/^\/(assets|templates)\//.test(url.pathname) && fromPanelPage(request)) {
    event.respondWith(networkFirst(request, request.url));
  }
});

// Dipakai test (Node) untuk menguji pemetaan jalur tanpa browser.
self.WC_SW = { adminShellFor, guestShellFor, fromPanelPage };
