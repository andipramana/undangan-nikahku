/** Kontrak mesin template (docs/kontrak-template.md).
 *
 * Menjaga jaminan yang paling gampang bocor diam-diam saat menambah template
 * baru: template harus mandiri (markup+CSS sendiri), cangkang tidak boleh ikut
 * membawa gaya template mana pun, dan setelan tampilan harus tersimpan
 * per-template — bukan global seperti dulu, yang membuat warna/font template A
 * ikut merusak template B.
 */
import fs from "node:fs/promises";
import path from "node:path";

const fail = [];
const ok = (label) => console.log(`PASS: ${label}`);
const check = (label, cond) => (cond ? ok(label) : fail.push(label));

const [shell, demo, storeJs, mainJs, indexJson] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("demo/index.html", "utf8"),
  fs.readFile("assets/js/panel/store.js", "utf8"),
  fs.readFile("assets/js/main.js", "utf8"),
  fs.readFile("templates/index.json", "utf8")
]);

/* ── 1. Struktur tiap template ──────────────────────────────────────────── */
const entries = await fs.readdir("templates", { withFileTypes: true });
const folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
check("ada minimal satu template", folders.length > 0);

const REQUIRED = ["template.json", "markup.html", "style.css", "render.js"];
for (const id of folders) {
  for (const f of REQUIRED) {
    const p = path.join("templates", id, f);
    let exists = true;
    try { await fs.access(p); } catch { exists = false; }
    check(`templates/${id}/${f} ada`, exists);
  }

  const manifest = JSON.parse(await fs.readFile(path.join("templates", id, "template.json"), "utf8"));
  check(`${id}: id manifest cocok dengan nama folder`, manifest.id === id);
  check(`${id}: punya nama tampil`, typeof manifest.name === "string" && manifest.name.length > 0);

  // Skema editor inilah yang membangun halaman & field di panel admin —
  // kalau bentuknya salah, admin untuk template itu diam-diam jadi kosong.
  const sections = manifest.editor && manifest.editor.sections;
  check(`${id}: editor.sections berupa array tidak kosong`, Array.isArray(sections) && sections.length > 0);
  if (Array.isArray(sections)) {
    const bad = sections.filter((s) =>
      !s.key || !s.label ||
      (s.fields && !Array.isArray(s.fields)) ||
      (s.photos && !Array.isArray(s.photos)) ||
      (Array.isArray(s.fields) && s.fields.some((f) => !f.path || !f.type || !f.label))
    );
    check(`${id}: tiap section & field punya key/label/path/type`, bad.length === 0);
  }

  // Skema warna: halaman Warna admin menyimpan `key`, sisi tamu memasangkannya
  // ke `var`. Salah ketik nama var tidak pernah melempar error — client cuma
  // mendapati pengaturan warna yang diam-diam tidak berefek, jadi dicek di sini.
  const colors = (manifest.editor && manifest.editor.colors) || [];
  if (colors.length) {
    const css = await fs.readFile(path.join("templates", id, "style.css"), "utf8");
    const badShape = colors.filter((c) => !c.key || !c.var || !c.label || !c.default);
    check(`${id}: tiap warna editor punya key/var/label/default`, badShape.length === 0);

    const keys = colors.map((c) => c.key);
    check(`${id}: key warna tidak ada yang kembar`, new Set(keys).size === keys.length);

    const unused = colors.filter((c) => c.var && !css.includes(c.var));
    check(`${id}: tiap var warna benar-benar dipakai style.css`, unused.length === 0);
    if (unused.length) fail.push(`  → var tak terpakai di ${id}: ${unused.map((c) => c.var).join(", ")}`);

    // manifest.theme adalah nilai bawaan yang dipasang mesin sebelum override
    // client; kalau var editor tidak ada di sana, "reset ke default" di admin
    // dan tampilan awal template bisa berbeda.
    const themeVars = Object.keys(manifest.theme || {});
    const missingDefault = colors.filter((c) => !themeVars.includes(c.var));
    check(`${id}: tiap var warna punya nilai bawaan di manifest.theme`, missingDefault.length === 0);
  }

  // render.js WAJIB mendaftarkan dirinya dengan id yang sama, kalau tidak
  // mesin melempar "tidak mendaftarkan render()" saat tamu membuka undangan.
  const render = await fs.readFile(path.join("templates", id, "render.js"), "utf8");
  check(`${id}: render.js mendaftar ke window.WeddingTemplates["${id}"]`,
    render.includes(`window.WeddingTemplates["${id}"]`));
}

/* ── 2. Katalog sinkron dengan folder ───────────────────────────────────── */
const catalog = JSON.parse(indexJson).templates || [];
const catalogIds = catalog.map((t) => t.id);
check("templates/index.json: tiap entri punya id, name, desc",
  catalog.every((t) => t.id && t.name && typeof t.desc === "string"));
check("katalog dan folder template sinkron",
  folders.every((f) => catalogIds.includes(f)) && catalogIds.every((c) => folders.includes(c)));

/* ── 3. Cangkang tidak membawa gaya template ────────────────────────────── */
// Kalau cangkang ikut memuat CSS/JS milik satu template, template lain akan
// mewarisi gayanya — persis masalah yang arsitektur ini hapus.
// Komentar dibuang dulu: penjelasan di dalam <!-- --> sering menyebut nama
// aset ("Swiper/AOS/Font Awesome dideklarasikan template masing-masing") dan
// itu bukan pemuatan aset.
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");
for (const [label, raw] of [["index.html", shell], ["demo/index.html", demo]]) {
  const html = stripComments(raw);
  check(`${label}: menyediakan mount point #inv-root`, html.includes('id="inv-root"'));
  check(`${label}: memuat mesin template`, html.includes("core/engine.js"));
  check(`${label}: tidak memuat CSS template apa pun`, !/<link[^>]+href="(assets\/css\/style\.css|templates\/)/.test(html));
  check(`${label}: tidak memuat aset khas template (Swiper/AOS/Font Awesome)`,
    !/swiper|aos@|fontawesome/i.test(html));
}

/* ── 4. core/ tidak boleh membuat elemen visual ─────────────────────────── */
// core/ adalah infrastruktur (ambil data, format, muat aset). Begitu ia mulai
// membuat elemen tampilan, template kehilangan kendali penuh atas markup-nya.
const coreFiles = (await fs.readdir("assets/js/core")).filter((f) => f.endsWith(".js"));
for (const f of coreFiles) {
  const src = await fs.readFile(path.join("assets/js/core", f), "utf8");
  const visual = /createElement\(\s*["'](div|section|span|img|button|p|h1|h2|h3|h4|h5|h6|ul|li|a)["']/i.test(src);
  check(`core/${f}: tidak membuat elemen visual`, !visual);
}

/* ── 5. Setelan tampilan tersimpan per-template ─────────────────────────── */
check("store.js menyediakan accessor bercakupan template",
  /activeTemplateId/.test(storeJs) && /tplGet/.test(storeJs) && /tplSet/.test(storeJs) && /saveTpl/.test(storeJs));
check("store.js menanam blok templates[<id>] saat load", /c\.templates\[activeId\]/.test(storeJs));

for (const [page, key] of [
  ["assets/js/panel/pages/warna.js", "theme"],
  ["assets/js/panel/pages/font.js", "typography"],
  ["assets/js/panel/pages/editor-visual.js", "visualEditor"]
]) {
  const src = await fs.readFile(page, "utf8");
  const scoped = /PanelStore\.tplSet\(/.test(src) && /PanelStore\.saveTpl\(/.test(src);
  const global = new RegExp(`PanelStore\\.save\\(\\["${key}"\\]\\)`).test(src);
  check(`${path.basename(page)}: menulis setelan per-template, bukan global`, scoped && !global);
}

check("bootstrapper memproyeksikan setelan template aktif",
  /projectTemplateSettings/.test(mainJs));

if (fail.length) {
  console.error("\nGAGAL:\n- " + fail.join("\n- "));
  process.exit(1);
}
console.log("\nPASS: kontrak mesin template terpenuhi.");
