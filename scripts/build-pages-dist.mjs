import { cp, mkdir, rm, access, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const rootFiles = ["index.html", "admin.html", "admin-qr.html", "register.html", "404.html", "CNAME"];
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
  "assets/css/style.css",
  "assets/css/admin.css",
  "assets/js/template-engine.js",
  "assets/js/config.js",
  "assets/js/tenant.js",
  "assets/js/register.js",
  "templates/classic-elegance.json",
  "templates/modern-minimal.json"
];
for (const file of required) {
  try { await access(path.join(dist, file)); }
  catch { throw new Error(`Build Pages tidak lengkap: ${file}`); }
}
console.log(`PASS: Pages dist dibuat di ${dist} dengan ${required.length} file runtime wajib.`);
