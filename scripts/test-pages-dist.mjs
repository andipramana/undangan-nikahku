import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const publicFiles = ["index.html", "home/index.html", "demo/index.html", "catin/index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html", "sw.js", "CNAME", ".nojekyll"];
const runtimeAssets = ["assets/img/favicon.png", "assets/css/catin.css", "assets/js/catin.js", "assets/docs/Undangan-Digital-WillCome.pdf", "assets/fonts/catin", "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-512.png", "assets/icons/apple-touch-icon.png", "assets/icons/inv-192.png", "assets/icons/monogram-template.svg", "assets/icons/inv-512.png", "assets/icons/inv-maskable-512.png", "assets/icons/inv-apple-touch-icon.png", "assets/js/pwa.js", "assets/js/panel/app-icon.js", "templates/klasik/style.css", "templates/klasik/markup.html", "templates/klasik/render.js", "templates/klasik/template.json", "templates/index.json", "assets/fonts", "assets/js/motion", "assets/js/vendor", "assets/js/core/engine.js", "assets/css/panel.css", "assets/css/wa.css", "assets/css/landing.css", "assets/js/config.js", "assets/js/tenant.js", "assets/js/wa.js", "assets/js/register.js", "assets/js/landing-motion.js"];
for (const file of [...publicFiles, ...runtimeAssets]) await access(path.join(dist, file));

// Verifikasi katalog template dan seluruh berkas wajib tiap template di dist
const catalogRaw = await readFile(path.join(dist, "templates/index.json"), "utf8");
const catalog = JSON.parse(catalogRaw).templates || [];
if (catalog.length === 0) throw new Error("Katalog dist/templates/index.json kosong.");
for (const tpl of catalog) {
  for (const reqFile of ["style.css", "markup.html", "render.js", "template.json"]) {
    try {
      await access(path.join(dist, "templates", tpl.id, reqFile));
    } catch {
      throw new Error(`Berkas template wajib hilang dari dist: dist/templates/${tpl.id}/${reqFile}`);
    }
  }
}
// assets/css/admin.css dihapus di R2 (docs/rencana-admin-v2-revisi.md) —
// admin-qr.html dan register.html sekarang terang, memakai panel.css.
for (const forbidden of ["supabase", "scripts", "docs", ".env.example", "package.json", "package-lock.json", "assets/css/admin.css"]) {
  try { await access(path.join(dist, forbidden)); throw new Error(`Private/source path leaked to dist: ${forbidden}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
for (const page of ["index.html", "home/index.html", "demo/index.html", "catin/index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html"]) {
  const html = await readFile(path.join(dist, page), "utf8");
  // Setiap halaman punya ikon: segel root (favicon.png) atau ikon WillCome (assets/icons/*.png, mis. /catin).
  if (!/favicon\.png|assets\/icons\/[a-z0-9-]+\.png/.test(html)) throw new Error(`Favicon missing from ${page}`);
}
const rootInvitation = await readFile(path.join(dist, "index.html"), "utf8");
const landing = await readFile(path.join(dist, "home/index.html"), "utf8");
const demo = await readFile(path.join(dist, "demo/index.html"), "utf8");
// Cangkang undangan sekarang GENERIK: nama pasangan tidak lagi ditulis di
// HTML karena satu cangkang melayani semua tenant & semua template — judul
// dan markup diisi saat runtime oleh bootstrapper + template aktif.
if (!rootInvitation.includes('id="inv-root"') || !rootInvitation.includes("core/engine.js")) {
  throw new Error("Root / bukan cangkang undangan (mount point / mesin template hilang).");
}
if (!landing.includes("Undangan Nikahku") || !landing.includes("6287843267115")) throw new Error("Landing /home/ missing brand or WhatsApp CTA.");
if (!demo.includes('id="inv-root"')) throw new Error("Demo /demo/ bukan cangkang undangan.");
console.log("PASS: dist menyajikan cangkang undangan + template klasik di /, landing di /home/, demo di /demo/, favicon lengkap, dan tidak membocorkan folder sumber.");
