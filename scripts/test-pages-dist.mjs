import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const publicFiles = ["index.html", "home/index.html", "demo/index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html", "CNAME", ".nojekyll"];
const runtimeAssets = ["assets/img/favicon.png", "assets/css/style.css", "assets/css/admin.css", "assets/css/wa.css", "assets/css/landing.css", "assets/js/config.js", "assets/js/tenant.js", "assets/js/wa.js", "assets/js/register.js", "assets/js/landing-motion.js"];
for (const file of [...publicFiles, ...runtimeAssets]) await access(path.join(dist, file));
for (const forbidden of ["supabase", "scripts", "docs", ".env.example", "package.json", "package-lock.json"]) {
  try { await access(path.join(dist, forbidden)); throw new Error(`Private/source path leaked to dist: ${forbidden}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
for (const page of ["index.html", "home/index.html", "demo/index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html"]) {
  const html = await readFile(path.join(dist, page), "utf8");
  if (!html.includes("favicon.png")) throw new Error(`Favicon missing from ${page}`);
}
const rootInvitation = await readFile(path.join(dist, "index.html"), "utf8");
const landing = await readFile(path.join(dist, "home/index.html"), "utf8");
const demo = await readFile(path.join(dist, "demo/index.html"), "utf8");
if (!rootInvitation.includes("Mita &amp; Andi — The Wedding")) throw new Error("Root / no longer serves the personal invitation shell.");
if (!landing.includes("Undangan Nikahku") || !landing.includes("6287843267115")) throw new Error("Landing /home/ missing brand or WhatsApp CTA.");
if (!demo.includes("Mita &amp; Andi — The Wedding")) throw new Error("Demo /demo/ is not an invitation shell.");
console.log("PASS: dist preserves root invitation, serves landing at /home/, demo at /demo/, includes favicons, and excludes source-only folders.");
