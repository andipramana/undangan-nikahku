/**
 * Smoke test admin.html v2 di browser sungguhan — belum ada satu pun test
 * yang benar-benar mem-boot admin.html sampai sekarang; semua test lain
 * membaca source sebagai teks atau me-mount SATU halaman lewat page.setContent.
 * Ini menutup celah itu: KLIK NYATA elemen navigasi (chip STRIP BAB — satu
 * satunya navigasi sejak rombak v3, tampil di viewport HP maupun desktop)
 * — BUKAN location.hash= langsung — supaya bug href fragment-saja yang
 * diresolusi terhadap <base href="/"> (link jadi menunjuk ke root/undangan
 * tamu, bukan tetap di admin.html — dilaporkan dari HP, lihat komentar
 * hashHref() di router.js) benar-benar tertangkap: location.hash= tidak kena
 * bug itu sama sekali, jadi test yang cuma set hash tidak akan pernah
 * mendeteksinya. Pastikan TIDAK ada console error / unhandled rejection,
 * #p-outlet-inner benar-benar terisi di tiap rute, judul stage (.p-stage__title,
 * pengganti pageheader) terisi, dan dokumen tidak pernah berpindah keluar
 * dari admin.html (page.url() tetap mengandung "/admin.html" setelah tiap
 * klik).
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
  check("#/ (Ringkasan, awal): #p-outlet-inner terisi", (await page.locator("#p-outlet-inner").innerHTML()).trim().length > 50);

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

  // Status publikasi: stub invitations mengembalikan published_at null →
  // dirty → pill "Draft" di topbar harus muncul (pengganti badge header lama).
  const pillText = await page.locator("#p-pubpill").textContent().catch(() => "");
  check("pill status publikasi tampil dengan teks Draft", (pillText || "").trim() === "Draft");

  // Jalur HP (viewport 390px): chip STRIP BAB — navigasi satu-satunya,
  // tampil di semua viewport sejak v3 (tidak ada lagi sidebar/kartu hub).
  const ROUTES = ["mempelai", "acara", "pengaturan", "warna"];
  for (const key of ROUTES) {
    await page.locator(`#p-chapters [data-nav-key="${key}"]`).click();
    // router.js mount() sinkron sebagian besar tapi beberapa halaman (mis.
    // warna.js fetch foto preview) async — beri waktu microtask/network mock
    // selesai sebelum membaca outlet.
    await page.waitForTimeout(300);
    stillOnAdminHtml(`strip bab: klik "${key}"`);
    const outletHtml = await page.locator("#p-outlet-inner").innerHTML();
    check(`#/${key}: #p-outlet-inner benar-benar terisi`, outletHtml.trim().length > 50);
    const stageTitle = await page.locator(".p-stage__title").textContent().catch(() => "");
    check(`#/${key}: judul stage (.p-stage__title) terisi`, !!(stageTitle && stageTitle.trim().length));
    const chipCurrent = await page.locator(`#p-chapters [data-nav-key="${key}"]`).getAttribute("aria-current");
    check(`#/${key}: chip strip aktif ditandai aria-current="page"`, chipCurrent === "page");

    // Balik ke Ringkasan lewat chip-nya (bukan location.hash=) supaya
    // iterasi berikutnya bisa klik chip bab lagi.
    await page.locator('#p-chapters [data-nav-key="home"]').click();
    await page.waitForTimeout(300);
    stillOnAdminHtml(`chip "Ringkasan" dari "${key}"`);
  }

  // Jalur desktop: strip yang SAMA, tapi layout beda (slug chip & seluruh
  // chip bab + alat terlihat tanpa scroll di ≥1024px) — pastikan navigasi
  // tetap benar di viewport lebar juga.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);
  await page.locator('#p-chapters [data-nav-key="cover"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('strip desktop: klik "cover"');
  const coverKicker = await page.locator(".p-stage__kicker").textContent().catch(() => "");
  check("desktop: kicker stage menyebut bab 01 untuk cover", /bab\s*01/i.test(coverKicker || ""));
  await page.locator('#p-chapters [data-nav-key="home"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('strip desktop: klik "Ringkasan"');
  check("desktop: kembali ke Ringkasan, #p-outlet-inner terisi", (await page.locator("#p-outlet-inner").innerHTML()).trim().length > 50);
  const checklistRows = await page.locator("#home-chapters .p-checkrow").count();
  check("Ringkasan: checklist 9 bab dirender sebagai baris", checklistRows === 9);
  const waCta = await page.locator("#p-outlet-inner .p-cta").getAttribute("href");
  check("Ringkasan: CTA kirim WhatsApp menunjuk ke workspace wa.html tenant", /wa\.html|\/wa\/?/.test(waCta || ""));

  // SIDEBAR parent-child — jalur navigasi KEDUA. Desktop: kolom permanen;
  // HP: drawer dari hamburger topbar. Strip bab tetap utama & tak diubah.
  const sidebarOpen = () => page.locator("#p-sidebar").evaluate((el) => el.classList.contains("p-sidebar--open"));
  check("desktop: sidebar tampil permanen (tanpa drawer)", await page.locator("#p-sidebar").isVisible());
  await page.locator('#p-sidebar [data-nav-key="hadiah"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('sidebar desktop: klik "hadiah"');
  const kickerHadiah = await page.locator(".p-stage__kicker").textContent().catch(() => "");
  check("desktop: kicker stage menyebut bab 08 untuk hadiah", /bab\s*08/i.test(kickerHadiah || ""));

  // Grup parent bisa diciutkan/dibuka (berlaku di kedua mode).
  const firstHead = page.locator(".p-sidegroup__head").first();
  const groupCount = await page.locator("#p-sidebar-nav .p-sidegroup").count();
  check("sidebar: 3 grup parent dirender (Bab undangan/Tamu/Tampilan & setelan)", groupCount === 3);
  await firstHead.click();
  check("sidebar: klik parent menutup daftar child-nya", (await firstHead.getAttribute("aria-expanded")) === "false");
  await firstHead.click();
  check("sidebar: klik parent lagi membuka daftar child-nya", (await firstHead.getAttribute("aria-expanded")) === "true");

  // Jalur drawer HP.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  check("HP: drawer awalnya tertutup", !(await sidebarOpen()));
  await page.locator("#p-menu-btn").click();
  await page.waitForTimeout(300);
  check("HP: hamburger membuka drawer", await sidebarOpen());
  await page.keyboard.press("Escape");
  check("HP: Escape menutup drawer", !(await sidebarOpen()));
  await page.locator("#p-menu-btn").click();
  await page.waitForTimeout(300);
  await page.locator('#p-sidebar [data-nav-key="kontak"]').click();
  await page.waitForTimeout(300);
  stillOnAdminHtml('drawer HP: klik "kontak"');
  check("HP: setelah memilih tujuan, drawer menutup sendiri", !(await sidebarOpen()));
  const stageKontak = await page.locator(".p-stage__title").textContent().catch(() => "");
  check("HP: rute kontak benar-benar termuat dari drawer", /kontak/i.test(stageKontak || ""));
  // Halaman Kontak serumpun Kirim WhatsApp: mount memasang class .wa-family
  // pada outlet (aksen hijau + judul serif, lihat panel.css).
  check("HP: halaman kontak membawa scope serumpun-WA (.wa-family)", await page.locator("#p-outlet-inner").evaluate((el) => el.classList.contains("wa-family")));

  // Menu ⋯ topbar (laporan user): wajib menutup saat klik bagian layar lain.
  const topmenuOpen = () => page.locator("#p-topmenu").evaluate((el) => el.open);
  await page.locator(".p-topmenu__btn").click();
  check("menu titik-titik terbuka", await topmenuOpen());
  // Area netral di LUAR menu — merek di ujung kiri topbar (sheet ⋯ rata
  // kanan dan kini berisi 3 item sehingga membentang melewati #p-stage
  // di viewport HP; brand mustahil tertutupnya).
  await page.locator(".p-topbar .p-brand").click();
  check("menu titik-titik menutup saat klik area lain", !(await topmenuOpen()));
  await page.locator(".p-topmenu__btn").click();
  await page.keyboard.press("Escape");
  check("menu titik-titik menutup dengan Escape", !(await topmenuOpen()));

  // Ganti Password (menu ⋯): item ada, klik membuka modal & menutup menu,
  // validasi lokal (konfirmasi beda) tampil inline TANPA menyentuh Supabase
  // (stub auth bahkan tidak punya updateUser — jalur jaringan tak tersentuh),
  // Escape menutup modal (focus-trap PanelUI.openModal).
  await page.locator(".p-topmenu__btn").click();
  check("menu titik-titik berisi item Ganti Password", await page.locator("#p-menu-password").isVisible());
  await page.locator("#p-menu-password").click();
  check("klik Ganti Password membuka modal", await page.locator("#p-passwd-modal").isVisible());
  check("membuka modal menutup menu titik-titik", !(await topmenuOpen()));
  await page.locator("#p-passwd-new").fill("sandi-panjang-cukup");
  await page.locator("#p-passwd-confirm").fill("yang-beda");
  await page.locator("#p-passwd-save").click();
  check("konfirmasi tidak cocok ditampilkan sebagai error inline", await page.locator("#p-passwd-error").isVisible());
  const errText = await page.locator("#p-passwd-error").textContent();
  check("error inline menjelaskan ketidakcocokan konfirmasi", /tidak sama/i.test(errText || ""));
  await page.keyboard.press("Escape");
  check("Escape menutup modal ganti password", !(await page.locator("#p-passwd-modal").isVisible()));

  check("tidak ada console error di sepanjang navigasi", consoleErrors.length === 0);
  if (consoleErrors.length) consoleErrors.forEach((e) => console.error("  console error:", e));
  check("tidak ada unhandled exception/rejection di sepanjang navigasi", pageErrors.length === 0);
  if (pageErrors.length) pageErrors.forEach((e) => console.error("  page error:", e));
} finally {
  await browser.close();
}

if (failed) { console.error("\nFAIL: smoke test admin.html v2 menemukan masalah."); process.exit(1); }
console.log("\nPASS: admin.html v3 boot bersih (tanpa error), navigasi klik nyata via strip bab (HP + desktop) tetap di admin.html, dan merender konten nyata di tiap rute yang diuji.");
