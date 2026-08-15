/**
 * Smoke test admin.html v2 di browser sungguhan — belum ada satu pun test
 * yang benar-benar mem-boot admin.html sampai sekarang; semua test lain
 * membaca source sebagai teks atau me-mount SATU halaman lewat page.setContent.
 * Ini menutup celah itu: navigasi ke beberapa rute hash beneran, pastikan
 * TIDAK ada console error / unhandled rejection, dan #p-outlet-inner
 * benar-benar terisi di tiap rute (bukan cuma tidak crash).
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

  const ROUTES = ["", "mempelai", "acara", "pengaturan", "warna"];
  for (const route of ROUTES) {
    const label = route || "home";
    await page.evaluate((r) => { location.hash = "#/" + r; }, route);
    // router.js mount() sinkron sebagian besar tapi beberapa halaman (mis.
    // warna.js fetch foto preview) async — beri waktu microtask/network mock
    // selesai sebelum membaca outlet.
    await page.waitForTimeout(300);
    const outletHtml = await page.locator("#p-outlet-inner").innerHTML();
    check(`#/${label}: #p-outlet-inner benar-benar terisi`, outletHtml.trim().length > 50);
    const headerTitle = await page.locator(".p-pageheader__title").textContent().catch(() => "");
    check(`#/${label}: judul halaman di header terisi`, !!(headerTitle && headerTitle.trim().length));
  }

  check("tidak ada console error di sepanjang navigasi", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.error("  console error:", e));
  check("tidak ada unhandled exception/rejection di sepanjang navigasi", pageErrors.length === 0);
  if (pageErrors.length) pageErrors.forEach((e) => console.error("  page error:", e));
} finally {
  await browser.close();
}

if (failed) { console.error("\nFAIL: smoke test admin.html v2 menemukan masalah."); process.exit(1); }
console.log("\nPASS: admin.html v2 boot bersih (tanpa error) dan merender konten nyata di 5 rute yang diuji.");
