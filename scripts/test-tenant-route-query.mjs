/** Query string & hash harus selamat dari pengalihan 404.html.
 *
 * GitHub Pages tidak punya folder /<slug>/, jadi 404.html membungkus
 * pathname + search + hash ke dalam SATU parameter (?__tenant_route=...) dan
 * tenant.js yang membukanya lagi. Dulu seluruh string itu diperlakukan sebagai
 * path: "?to=Putri" ikut jadi bagian path, lalu "/" ditambahkan di ujungnya
 * sehingga URL menjadi /<slug>/?to=Putri/ dan nama tamu terbaca "Putri/".
 * Semua pembaca location.search (?to=, ?template=, ?preview=) kena akibatnya.
 *
 * Tidak butuh server: page.route() menyajikan tenant.js asli dari disk di
 * origin palsu, dan shell-nya cuma HTML minimal yang memuat tenant.js.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const tenantJs = await fs.readFile("assets/js/tenant.js", "utf8");
const ORIGIN = "http://tenant.test";

// Dicatat SEGERA setelah tenant.js jalan — itulah yang dilihat modul lain
// (core/context.js, engine.js, supabase-client.js) saat render.
const SHELL = `<!doctype html><meta charset="utf-8"><base href="/">
<script src="/assets/js/tenant.js"></script>
<script>
  window.__boot = {
    search: location.search,
    hash: location.hash,
    to: new URLSearchParams(location.search).get("to"),
    template: new URLSearchParams(location.search).get("template"),
    slug: window.TenantContext.slug,
    surface: window.TenantContext.surface
  };
</script>
<body>shell</body>`;

const browser = await chromium.launch();

async function run(route) {
  const page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/assets/js/tenant.js") return r.fulfill({ contentType: "text/javascript", body: tenantJs });
    return r.fulfill({ contentType: "text/html", body: SHELL });
  });
  await page.goto(`${ORIGIN}/index.html?__tenant_route=${encodeURIComponent(route)}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__boot && document.readyState === "complete");
  // replaceState "pasca-load" dipasang di window load — beri satu tick.
  await page.waitForTimeout(50);
  const out = await page.evaluate(() => ({
    boot: window.__boot,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash
  }));
  await page.close();
  return out;
}

// 1. Tanpa slash akhir — persis yang diketik user: /julia-dan-kevin?to=Putri
{
  const r = await run("/julia-dan-kevin?to=Putri");
  check("tanpa slash: slug tetap julia-dan-kevin (bukan root)", r.boot.slug === "julia-dan-kevin", r.boot.slug);
  check("tanpa slash: surface = invitation", r.boot.surface === "invitation", r.boot.surface);
  check("tanpa slash: ?to= terbaca benar SEGERA setelah tenant.js", r.boot.to === "Putri", JSON.stringify(r.boot.to));
  check("tanpa slash: URL akhir /julia-dan-kevin/?to=Putri", r.pathname + r.search === "/julia-dan-kevin/?to=Putri", r.pathname + r.search);
  check("tanpa slash: tidak ada '/' menempel di nilai query", !/\/$/.test(r.search), r.search);
}

// 2. Dengan slash akhir
{
  const r = await run("/julia-dan-kevin/?to=Putri");
  check("dengan slash: ?to= terbaca 'Putri' (tanpa '/')", r.boot.to === "Putri", JSON.stringify(r.boot.to));
  check("dengan slash: URL akhir /julia-dan-kevin/?to=Putri", r.pathname + r.search === "/julia-dan-kevin/?to=Putri", r.pathname + r.search);
}

// 3. Banyak parameter + nama bersandi (spasi, karakter khusus)
{
  const r = await run("/julia-dan-kevin/?to=Putri+Ayu%20Lestari&template=klasik");
  check("multi-param: ?to= tetap utuh", r.boot.to === "Putri Ayu Lestari", JSON.stringify(r.boot.to));
  check("multi-param: ?template= terbaca", r.boot.template === "klasik", JSON.stringify(r.boot.template));
  check("multi-param: query asli dipertahankan apa adanya",
    r.search === "?to=Putri+Ayu%20Lestari&template=klasik", r.search);
}

// 4. Tanpa query sama sekali: perilaku lama tetap
{
  const r = await run("/julia-dan-kevin");
  check("tanpa query: slug benar & URL /julia-dan-kevin/", r.boot.slug === "julia-dan-kevin" && r.pathname === "/julia-dan-kevin/" && r.search === "",
    `${r.boot.slug} ${r.pathname}${r.search}`);
  check("tanpa query: __tenant_route hilang dari URL", !/__tenant_route/.test(r.search), r.search);
}

// 5. Admin dengan hash — pengalihan ke admin.html tidak boleh menelan hash
{
  const r = await run("/julia-dan-kevin/admin/#/acara");
  check("admin: slug & surface benar", r.boot.slug === "julia-dan-kevin" && r.boot.surface === "admin", `${r.boot.slug}/${r.boot.surface}`);
  check("admin: hash sudah ada SEBELUM router boot", r.boot.hash === "#/acara", JSON.stringify(r.boot.hash));
  check("admin: URL akhir /julia-dan-kevin/admin/#/acara (hash tanpa '/' tambahan)",
    r.pathname + r.search + r.hash === "/julia-dan-kevin/admin/#/acara", r.pathname + r.search + r.hash);
}

await browser.close();
process.exit(failed ? 1 : 0);
