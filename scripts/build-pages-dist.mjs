import { cp, mkdir, rm, access, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const rootFiles = ["index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html", "sw.js", "CNAME"];
const routedFiles = ["home/index.html", "demo/index.html"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of [...rootFiles, ...routedFiles]) {
  const destination = path.join(dist, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination);
}

// Only browser runtime assets belong in Pages. Source, tests, docs, migrations,
// Edge Functions, package files, and local tooling deliberately stay out.
await cp(path.join(root, "assets"), path.join(dist, "assets"), {
  recursive: true,
  filter(source) {
    return !source.split(path.sep).includes("img_backup");
  }
});

// Template definitions — public JSON, no secrets
await cp(path.join(root, "templates"), path.join(dist, "templates"), { recursive: true });

await writeFile(path.join(dist, ".nojekyll"), "");

const required = [
  ...rootFiles,
  ...routedFiles,
  ".nojekyll",
  "assets/img/favicon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/inv-192.png",
  "assets/icons/inv-512.png",
  "assets/icons/inv-maskable-512.png",
  "assets/icons/inv-apple-touch-icon.png",
  "assets/js/pwa.js",
  "assets/css/panel.css",
  "assets/css/wa.css",
  "assets/js/core/engine.js",
  "assets/js/core/context.js",
  "assets/js/core/template-photos.js",
  "assets/js/core/behaviors.js",
  "assets/js/split-text.js",
  "assets/js/config.js",
  "assets/js/tenant.js",
  "assets/js/wa.js",
  "assets/js/admin/wa-blast.js",
  "assets/js/admin/admin-qr.js",
  "assets/js/panel/core.js",
  "assets/js/panel/app-icon.js",
  "assets/js/panel/router.js",
  "assets/js/panel/pages/home.js",
  "assets/js/register.js",
  "templates/index.json",
  "assets/fonts",
  "assets/js/motion",
  "assets/js/vendor",
  "templates/klasik/template.json",
  "templates/klasik/markup.html",
  "templates/klasik/style.css",
  "templates/klasik/render.js"
];

const tplIndexRaw = await readFile(path.join(root, "templates/index.json"), "utf8");
const tplCatalog = JSON.parse(tplIndexRaw).templates || [];
for (const tpl of tplCatalog) {
  for (const f of ["template.json", "markup.html", "style.css", "render.js"]) {
    const rel = `templates/${tpl.id}/${f}`;
    if (!required.includes(rel)) required.push(rel);
  }
}
for (const file of required) {
  try { await access(path.join(dist, file)); }
  catch { throw new Error(`Build Pages tidak lengkap: ${file}`); }
}
console.log(`PASS: Pages dist dibuat di ${dist} dengan ${required.length} file runtime wajib.`);
