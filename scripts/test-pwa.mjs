/** Panel bisa dipasang sebagai PWA (layar penuh di HP).
 *
 * Tiga lapis:
 *  A. statis   — meta/ikon/skrip terpasang di ketiga halaman panel, sw.js di akar.
 *  B. manifest — pwa.js membangun manifest per-tenant dengan URL absolut.
 *  C. SW asli  — service worker sungguhan di localhost (konteks aman) dengan server
 *                yang meniru GitHub Pages: berkas ada = 200, selain itu = 404.html.
 *                Jalur cantik panel harus dijawab 200 dari cangkangnya (itu yang
 *                dibutuhkan aplikasi terpasang), halaman TAMU tidak boleh disentuh,
 *                dan panel tetap terbuka saat offline.
 */
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

/* ── A. statis ──────────────────────────────────────────────────────────── */
const PAGES = ["admin.html", "admin-qr.html", "wa.html"];
for (const page of PAGES) {
  const html = await fs.readFile(page, "utf8");
  // Cari TAG <script>, bukan nama berkas: komentar di <head> juga menyebut pwa.js.
  const tenantAt = html.indexOf('<script src="assets/js/tenant.js"></script>');
  const pwaAt = html.indexOf('<script src="assets/js/pwa.js"></script>');
  check(`${page}: pwa.js dimuat SETELAH tenant.js (butuh TenantContext)`, tenantAt > 0 && pwaAt > tenantAt);
  check(`${page}: theme-color`, /<meta name="theme-color" content="#[0-9a-f]{6}">/i.test(html));
  check(`${page}: apple-touch-icon`, /rel="apple-touch-icon" href="assets\/icons\/apple-touch-icon\.png"/.test(html));
  check(`${page}: apple-mobile-web-app-capable`, /name="apple-mobile-web-app-capable" content="yes"/.test(html));
  check(`${page}: tidak ada <link rel="manifest"> statis (dibangun per-tenant)`, !/<link rel="manifest"/.test(html));
}

async function pngSize(file) {
  const b = await fs.readFile(file);
  return b.readUInt32BE(16) + "x" + b.readUInt32BE(20);
}
for (const [file, size] of [["icon-192.png", "192x192"], ["icon-512.png", "512x512"], ["icon-maskable-512.png", "512x512"], ["apple-touch-icon.png", "180x180"]]) {
  let got = "tidak ada";
  try { got = await pngSize(`assets/icons/${file}`); } catch (_) { /* dilaporkan di bawah */ }
  check(`ikon ${file} berukuran ${size}`, got === size, got);
}

const swSrc = await fs.readFile("sw.js", "utf8");
const sandboxSelf = { addEventListener() {}, location: { origin: "https://x.test" } };
new Function("self", swSrc)(sandboxSelf);
const { adminShellFor, fromPanelPage } = sandboxSelf.WC_SW;
const routes = [
  ["/julia-dan-kevin/admin/", "/admin.html"], ["/julia-dan-kevin/admin", "/admin.html"],
  ["/julia-dan-kevin/admin-qr/", "/admin-qr.html"], ["/julia-dan-kevin/wa/", "/wa.html"],
  ["/admin/", "/admin.html"], ["/admin-qr/", "/admin-qr.html"], ["/wa/", "/wa.html"],
  // BUKAN panel — tidak boleh dicegat:
  ["/", null], ["/julia-dan-kevin/", null], ["/julia-dan-kevin", null], ["/home/", null],
  ["/demo/", null], ["/admin.html", null], ["/templates/klasik/style.css", null],
  ["/julia-dan-kevin/admin/extra", null], ["/register.html", null]
];
for (const [p, want] of routes) check(`sw: ${p} → ${want}`, adminShellFor(p) === want, String(adminShellFor(p)));
check("sw: sub-resource dari halaman panel dikenali",
  fromPanelPage({ referrer: "https://x.test/julia-dan-kevin/admin/" }) && fromPanelPage({ referrer: "https://x.test/admin.html" }));
check("sw: sub-resource dari halaman TAMU tidak dikenali",
  !fromPanelPage({ referrer: "https://x.test/julia-dan-kevin/" }) && !fromPanelPage({ referrer: "" }));
check("sw: tidak pernah mencegat lintas-origin", /url\.origin !== self\.location\.origin\) return/.test(swSrc));

const browser = await chromium.launch();

/* ── B. manifest per-tenant ─────────────────────────────────────────────── */
const pwaSrc = await fs.readFile("assets/js/pwa.js", "utf8");
const ORIGIN = "https://panel.test";
async function manifestFor(slug, surface) {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><head></head><body></body>" }));
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(({ slug, surface }) => {
    const base = slug === "root" ? "/" : `/${slug}/`;
    window.TenantContext = {
      slug, surface,
      path(kind) { return kind === "admin" ? (slug === "root" ? "/admin/" : `/${slug}/admin/`)
        : kind === "admin-qr" ? (slug === "root" ? "/admin-qr/" : `/${slug}/admin-qr/`)
        : kind === "wa" ? (slug === "root" ? "/wa/" : `/${slug}/wa/`) : base; }
    };
  }, { slug, surface });
  await page.addScriptTag({ content: pwaSrc });
  const out = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const json = link ? await (await fetch(link.href)).json() : null;
    return { json, appleTitle: (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content };
  });
  await ctx.close();
  return out;
}

{
  const { json: m, appleTitle } = await manifestFor("julia-dan-kevin", "admin");
  check("manifest admin: ada", !!m);
  check("manifest admin: start_url absolut ke jalur cantik tenant", m.start_url === `${ORIGIN}/julia-dan-kevin/admin/`, m.start_url);
  check("manifest admin: scope = akar tenant", m.scope === `${ORIGIN}/julia-dan-kevin/`, m.scope);
  check("manifest admin: start_url berada di dalam scope", m.start_url.startsWith(m.scope));
  check("manifest admin: nama memuat nama pasangan dari slug", /Julia & Kevin/.test(m.name) && /WillCome/.test(m.name), m.name);
  check("manifest admin: short_name WillCome", m.short_name === "WillCome", m.short_name);
  check("manifest admin: layar penuh + cadangan standalone", m.display === "standalone" && m.display_override[0] === "fullscreen" && m.display_override.includes("standalone"));
  check("manifest admin: semua ikon absolut", m.icons.every((i) => i.src.startsWith(`${ORIGIN}/assets/icons/`)));
  check("manifest admin: ada ikon 192, 512 dan maskable",
    m.icons.some((i) => i.sizes === "192x192") && m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any") && m.icons.some((i) => i.purpose === "maskable"));
  check("iOS: judul layar utama diisi", appleTitle === "WillCome", String(appleTitle));
}
{
  const { json: q } = await manifestFor("julia-dan-kevin", "admin-qr");
  check("manifest check-in: start_url ke admin-qr, id berbeda dari admin", q.start_url === `${ORIGIN}/julia-dan-kevin/admin-qr/` && q.id !== `${ORIGIN}/julia-dan-kevin/admin/`, q.start_url);
  check("manifest check-in: short_name Check-in", q.short_name === "Check-in", q.short_name);
  const { json: w } = await manifestFor("julia-dan-kevin", "wa");
  check("manifest WA: start_url ke wa", w.start_url === `${ORIGIN}/julia-dan-kevin/wa/`, w.start_url);
  const { json: r } = await manifestFor("root", "admin");
  check("manifest root: start_url /admin/, scope /", r.start_url === `${ORIGIN}/admin/` && r.scope === `${ORIGIN}/`, `${r.start_url} ${r.scope}`);
}

/* ── C. service worker sungguhan (localhost) ────────────────────────────── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const root = process.cwd();
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const send = (status, body, type) => { res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };
  try {
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) return send(403, "x", "text/plain");
    let st = await fs.stat(file).catch(() => null);
    if (st && st.isDirectory()) { file = path.join(file, "index.html"); st = await fs.stat(file).catch(() => null); }
    if (st && st.isFile()) return send(200, await fs.readFile(file), MIME[path.extname(file)] || "application/octet-stream");
    // Meniru GitHub Pages: jalur tak dikenal → 404.html, status 404.
    return send(404, await fs.readFile(path.join(root, "404.html")), "text/html; charset=utf-8");
  } catch (err) { send(500, String(err), "text/plain"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`;

const ctx = await browser.newContext();
const page = await ctx.newPage();
// Tanpa jaringan luar: CDN (supabase, fonts) dibatalkan; panel tak perlu jalan penuh.
await page.route((u) => !u.hostname.includes("localhost") && !u.hostname.includes("127.0.0.1"), (r) => r.abort());

await page.goto(`${BASE}/admin.html`, { waitUntil: "load" });
const registered = await page.evaluate(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 8000))]);
  return !!(reg && reg.active);
});
check("sw: terdaftar dan aktif dari admin.html", registered);
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => {});

{
  const resp = await page.goto(`${BASE}/julia-dan-kevin/admin/`, { waitUntil: "load" });
  check("sw: /julia-dan-kevin/admin/ dijawab 200 (bukan 404 GitHub Pages)", resp.status() === 200, String(resp.status()));
  const info = await page.evaluate(() => ({
    base: document.documentElement.dataset.titleBase,
    slug: window.TenantContext && window.TenantContext.slug,
    surface: window.TenantContext && window.TenantContext.surface,
    path: location.pathname,
    manifest: !!document.querySelector('link[rel="manifest"]')
  }));
  check("sw: yang tampil adalah cangkang admin.html", info.base === "Admin", String(info.base));
  check("sw: tenant & surface terbaca langsung dari jalur cantik", info.slug === "julia-dan-kevin" && info.surface === "admin", `${info.slug}/${info.surface}`);
  check("sw: URL tetap jalur cantik (tidak dibelokkan)", info.path === "/julia-dan-kevin/admin/", info.path);
  check("sw: manifest terpasang di halaman itu", info.manifest);
}
{
  const resp = await page.goto(`${BASE}/julia-dan-kevin/admin-qr/`, { waitUntil: "load" });
  const base = await page.evaluate(() => document.documentElement.dataset.titleBase);
  check("sw: /julia-dan-kevin/admin-qr/ → cangkang check-in", resp.status() === 200 && base === "Check-in", `${resp.status()} ${base}`);
}
{
  // Halaman TAMU tidak boleh dicegat: respons pertamanya harus tetap 404 GitHub Pages.
  const resp = await page.goto(`${BASE}/julia-dan-kevin/`, { waitUntil: "commit" });
  check("sw: halaman tamu /julia-dan-kevin/ TIDAK dicegat (tetap alur 404.html)", resp.status() === 404, String(resp.status()));
}
{
  // Offline: panel yang pernah dibuka tetap terbuka dari cache.
  await page.goto(`${BASE}/julia-dan-kevin/admin/`, { waitUntil: "load" });
  await ctx.setOffline(true);
  const resp = await page.goto(`${BASE}/julia-dan-kevin/admin/`, { waitUntil: "load" }).catch((e) => ({ err: String(e) }));
  const base = resp.err ? null : await page.evaluate(() => document.documentElement.dataset.titleBase);
  check("sw: offline — panel yang pernah dibuka tetap terbuka dari cache", !resp.err && resp.status() === 200 && base === "Admin", resp.err || `${resp.status()} ${base}`);
  await ctx.setOffline(false);
}

await ctx.close();
server.close();
await browser.close();
process.exit(failed ? 1 : 0);
