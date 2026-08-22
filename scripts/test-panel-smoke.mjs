/**
 * Smoke test admin.html v2 di browser sungguhan — belum ada satu pun test
 * yang benar-benar mem-boot admin.html sampai sekarang; semua test lain
 * membaca source sebagai teks atau me-mount SATU halaman lewat page.setContent.
 * Ini menutup celah itu: KLIK NYATA elemen navigasi (kartu hub Beranda di
 * viewport HP, lalu sidebar di viewport desktop) — BUKAN location.hash=
 * langsung — supaya bug href fragment-saja yang diresolusi terhadap
 * <base href="/"> (link jadi menunjuk ke root/undangan tamu, bukan tetap di
 * admin.html — dilaporkan dari HP, lihat komentar hashHref() di router.js)
 * benar-benar tertangkap: location.hash= tidak kena bug itu sama sekali,
 * jadi test yang cuma set hash tidak akan pernah mendeteksinya. Pastikan
 * TIDAK ada console error / unhandled rejection, #p-outlet-inner benar-benar
 * terisi di tiap rute, dan dokumen tidak pernah berpindah keluar dari
 * admin.html (page.url() tetap mengandung "/admin.html" setelah tiap klik).
 *
 * Tidak butuh server maupun Supabase sungguhan: page.route() mencegat SEMUA
 * request ke origin palsu http://panel.test/ dan menyajikannya langsung dari
 * disk (supaya <base href="/"> di admin.html resolve dengan benar — file://
 * TIDAK bisa dipakai untuk ini karena base href="/" akan resolve ke root
 * filesystem, bukan folder proyek). Request ke CDN (supabase-js, html2canvas)
 * dicegat juga dan diganti stub lokal — window.supabase.createClient()
 * mengembalikan client tiruan yang cukup untuk boot: sesi sudah "login",
 * site_content kosong (PGRST116) supaya store.js jatuh ke starter dari
 * config.js asli (bukan dikarang di sini), dan tabel lain (photos/wishes/
 * checkins/wa_contacts/invitations) semua mengembalikan hasil kosong yang sah.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const SUPABASE_STUB = `
window.supabase = {
  createClient() {
    function chain(resolver) {
      const b = {
        select() { return b; }, eq() { return b; }, order() { return b; },
        range() { return b; }, limit() { return b; }, delete() { return b; },
        update() { return b; }, insert() { return b; },
        maybeSingle() { return Promise.resolve(resolver()); },
        single() { return Promise.resolve(resolver()); },
        upsert() { return Promise.resolve(resolver()); },
        then(resolve, reject) { return Promise.resolve(resolver()).then(resolve, reject); }
      };
      return b;
    }
    function resultFor(table) {
      if (table === "site_content") return { data: null, error: { code: "PGRST116", message: "no rows (smoke stub)" } };
      if (table === "invitations") return { data: { content_updated_at: new Date().toISOString(), published_at: null }, error: null };
      if (table === "photos") return { data: [], error: null };
      return { data: [], count: 0, error: null };
    }
    return {
      auth: {
        onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
        getSession: async () => ({ data: { session: { user: { id: "smoke-test" } } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ error: null })
      },
      rpc(name) {
        if (name === "get_my_invitation_access") {
          return Promise.resolve({ data: [{ invitation_id: "smoke-test-invitation", slug: "test", role: "admin" }], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      from(table) { return chain(() => resultFor(table)); },
      storage: { from() { return { getPublicUrl: (p) => ({ data: { publicUrl: "about:blank#" + p } }) }; } }
    };
  }
};
`;

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (err) => pageErrors.push(err.message));

await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== "panel.test") {
    if (url.href.includes("supabase-js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: SUPABASE_STUB });
    }
    if (url.href.includes("html2canvas")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
    }
    // Font Google (Geist/Geist Mono, dimuat <link> di head admin.html) sah —
    // stub CSS & berkas font kosong tapi VALID supaya offline test ini tidak
    // mencatat console error 404 untuk request yang normal di production.
    if (url.hostname === "fonts.googleapis.com") {
      return route.fulfill({ status: 200, contentType: "text/css", body: "/* smoke stub: @font-face dinonaktifkan */" });
    }
    if (url.hostname === "fonts.gstatic.com") {
      return route.fulfill({ status: 200, contentType: "font/woff2", body: "" });
    }
    // CDN jsdelivr lain (mis. xlsx untuk kontak.js) — script kosong valid;
    // rute yang diuji smoke tidak menyentuh fitur yang memakainya.
    if (url.hostname === "cdn.jsdelivr.net") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
    }
    return route.fulfill({ status: 404, body: "" });
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname));
  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    return route.fulfill({ status: 200, contentType: MIME[ext] || "application/octet-stream", body });
  } catch {
    return route.fulfill({ status: 404, body: "not found: " + filePath });
  }
});

try {
  await page.goto("http://panel.test/admin.html");
  await page.locator("#app").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  check("layar login tersembunyi, #app tampil setelah boot", await page.locator("#app").isVisible());
  check("#/ (Beranda, awal): #p-outlet-inner terisi", (await page.locator("#p-outlet-inner").innerHTML()).trim().length > 50);

  // BUG KRITIS (dilaporkan dari HP): admin.html punya <base href="/">, dan
  // href fragment-saja seperti "#/mempelai" diresolusi HTML terhadap base
  // itu (bukan terhadap URL dokumen saat ini) — jadi tanpa perbaikan, link
  // itu sebenarnya menunjuk ke http://host/#/mempelai, PATH-nya "/" (beda
  // dari "/admin.html"), sehingga browser melakukan navigasi lintas-dokumen
  // ke situ (halaman undangan tamu di root), bukan cuma ganti hash. Test ini
  // WAJIB meng-KLIK elemen nav sungguhan (bukan location.hash= langsung) dan
  // menegaskan page.url() tetap mengandung "/admin.html" — location.hash=
  // (dipakai navigate() di router.js) tidak kena bug ini sama sekali, jadi
  // hanya lewat klik nyata bug ini benar-benar tertangkap.
  function stillOnAdminHtml(label) {
    check(`${label}: dokumen TIDAK berpindah keluar dari admin.html (url: ${page.url()})`, page.url().includes("/admin.html"));
  }

  // Jalur mobile (viewport HP): kartu navigasi di hub Beranda
  // (renderNavGridHtml(), dirender di dalam #p-outlet-inner tiap home.js
  // mount — sidebar disembunyikan CSS di bawah 1024px, lihat panel.css).
  const ROUTES = ["mempelai", "acara", "pengaturan", "warna"];
  for (const key of ROUTES) {
    await page.locator(`#p-outlet-inner [data-nav-key="${key}"]`).click();
    // router.js mount() sinkron sebagian besar tapi beberapa halaman (mis.
    // warna.js fetch foto preview) async — beri waktu microtask/network mock
    // selesai sebelum membaca outlet.
    await page.waitForTimeout(300);
    stillOnAdminHtml(`hub Beranda: klik menu "${key}"`);
    const outletHtml = await page.locator("#p-outlet-inner").innerHTML();
    check(`#/${key}: #p-outlet-inner benar-benar terisi`, outletHtml.trim().length > 50);
    const headerTitle = await page.locator(".p-pageheader__title").textContent().catch(() => "");
    check(`#/${key}: judul halaman di header terisi`, !!(headerTitle && headerTitle.trim().length));

    // Balik ke Beranda lewat tombol "Kembali" (dipicu navigate() langsung,
    // bukan href) supaya iterasi berikutnya bisa klik kartu hub lagi.
    await page.locator("#p-back").click();
    await page.waitForTimeout(300);
    stillOnAdminHtml(`tombol "Kembali" dari "${key}"`);
  }

  // Jalur desktop: sidebar permanen (>=1024px) — kode href-nya SAMA
  // (navItemHref()) tapi elemennya beda dari kartu hub, dan link Beranda di
  // sidebar punya href hardcoded terpisah (renderSidebar()) — wajib diuji
  // sendiri, bukan diasumsikan sama dari uji kartu hub di atas.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);
  await page.locator('.p-sidebar__item[data-nav-key="mempelai"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('sidebar desktop: klik "mempelai"');
  await page.locator('.p-sidebar__item[data-nav-key="home"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('sidebar desktop: klik "Beranda"');
  check("sidebar desktop: kembali ke Beranda, #p-outlet-inner terisi", (await page.locator("#p-outlet-inner").innerHTML()).trim().length > 50);

  check("tidak ada console error di sepanjang navigasi", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.error("  console error:", e));
  check("tidak ada unhandled exception/rejection di sepanjang navigasi", pageErrors.length === 0);
  if (pageErrors.length) pageErrors.forEach((e) => console.error("  page error:", e));
} finally {
  await browser.close();
}

if (failed) { console.error("\nFAIL: smoke test admin.html v2 menemukan masalah."); process.exit(1); }
console.log("\nPASS: admin.html v2 boot bersih (tanpa error), navigasi klik nyata (hub mobile + sidebar desktop) tetap di admin.html, dan merender konten nyata di tiap rute yang diuji.");
