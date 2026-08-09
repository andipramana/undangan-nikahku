import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const publicFiles = ["index.html", "admin.html", "admin-qr.html", "register.html", "404.html", "CNAME", ".nojekyll"];
const runtimeAssets = ["assets/img/favicon.png", "assets/css/style.css", "assets/css/admin.css", "assets/js/config.js", "assets/js/tenant.js", "assets/js/register.js"];
for (const file of [...publicFiles, ...runtimeAssets]) await access(path.join(dist, file));
for (const forbidden of ["supabase", "scripts", "docs", ".env.example", "package.json", "package-lock.json"]) {
  try { await access(path.join(dist, forbidden)); throw new Error(`Private/source path leaked to dist: ${forbidden}`); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
for (const page of ["index.html", "admin.html", "admin-qr.html", "register.html", "404.html"]) {
  const html = await readFile(path.join(dist, page), "utf8");
  if (!html.includes("favicon.png")) throw new Error(`Favicon missing from ${page}`);
}
console.log("PASS: dist contains required Pages runtime files/favicon and excludes source-only folders.");
