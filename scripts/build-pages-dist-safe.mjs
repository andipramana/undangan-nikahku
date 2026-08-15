import { cp, mkdir, access, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const rootFiles = ["index.html", "admin.html", "admin-qr.html", "wa.html", "register.html", "404.html", "CNAME"];
const routedFiles = ["home/index.html", "demo/index.html"];

// Clear contents of dist WITHOUT removing the dist directory itself (Windows can
// hold a lock on the directory handle even when it's empty, e.g. from Explorer or
// an editor with the folder open). Emptying contents avoids EBUSY on rmdir.
await mkdir(dist, { recursive: true });
const entries = await readdir(dist);
for (const entry of entries) {
  await rm(path.join(dist, entry), { recursive: true, force: true });
}

for (const file of [...rootFiles, ...routedFiles]) {
  const destination = path.join(dist, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination);
}

await cp(path.join(root, "assets"), path.join(dist, "assets"), {
  recursive: true,
  filter(source) {
    return !source.split(path.sep).includes("img_backup");
  }
});

await cp(path.join(root, "templates"), path.join(dist, "templates"), { recursive: true });

await writeFile(path.join(dist, ".nojekyll"), "");

const required = [
  ...rootFiles,
  ...routedFiles,
  ".nojekyll",
  "assets/img/favicon.png",
  "assets/css/style.css",
  "assets/css/admin.css",
  "assets/css/panel.css",
  "assets/css/wa.css",
  "assets/js/template-engine.js",
  "assets/js/config.js",
  "assets/js/tenant.js",
  "assets/js/wa.js",
  "assets/js/admin/wa-blast.js",
  "assets/js/admin/admin-qr.js",
  "assets/js/panel/core.js",
  "assets/js/panel/router.js",
  "assets/js/panel/pages/home.js",
  "assets/js/register.js",
  "templates/classic-elegance.json",
  "templates/modern-minimal.json",
  "templates/classic-elegance.css",
  "templates/modern-minimal.css",
  "templates/modern-minimal.js"
];
for (const file of required) {
  try { await access(path.join(dist, file)); }
  catch { throw new Error(`Build Pages tidak lengkap: ${file}`); }
}
console.log(`PASS: Pages dist dibuat di ${dist} dengan ${required.length} file runtime wajib.`);
