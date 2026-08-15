/**
 * Kontrak Admin Panel v2 (docs/rencana-admin-v2.md §10) — pemeriksaan statis,
 * tanpa Playwright/browser. Jaring pengaman migrasi: pastikan tidak ada sisa
 * kode tab lama, setiap halaman terdaftar benar, dan setiap field lama
 * (§3.1) sudah punya rumah baru.
 */
import fs from "node:fs/promises";
import path from "node:path";

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

// ---------------------------------------------------------------------
// 1) File lama (§6.1) sudah tidak ada, kecuali shared.js (shim tipis).
// ---------------------------------------------------------------------
const removed = [
  "assets/js/admin/admin.js",
  "assets/js/admin/content.js",
  "assets/js/admin/photos.js",
  "assets/js/admin/editor.js",
  "assets/js/admin/theme.js",
  "assets/js/admin/fonts.js",
  "assets/js/admin/template.js",
  "assets/js/admin/visual-editor.js",
  "assets/js/admin/wishes.js",
  "assets/js/admin/section-nav.js",
  "assets/js/admin/publish.js"
];
for (const file of removed) {
  const exists = await fs.access(file).then(() => true).catch(() => false);
  check(`${file} sudah dihapus`, !exists);
}
const sharedJs = await fs.readFile("assets/js/admin/shared.js", "utf8");
check("shared.js adalah shim tipis (memuat panel/core.js, bukan implementasi lama)",
  /panel\/core\.js/.test(sharedJs) && sharedJs.length < 2000);

// ---------------------------------------------------------------------
// 2) admin.html tidak mengandung markup tab lama.
// ---------------------------------------------------------------------
const adminHtml = await fs.readFile("admin.html", "utf8");
check('admin.html tidak mengandung class="tab"', !/class="tab/.test(adminHtml));
check("admin.html tidak mengandung data-tab", !/data-tab/.test(adminHtml));

// ---------------------------------------------------------------------
// 3) Setiap window.PanelPages[...] punya title/group/mount/destroy.
// ---------------------------------------------------------------------
const pagesDir = "assets/js/panel/pages";
const pageFiles = (await fs.readdir(pagesDir)).filter((f) => f.endsWith(".js"));
check("ada 17 file halaman di assets/js/panel/pages/ (18 tujuan non-Beranda - 1, karena Kirim WA & Check-in QR adalah link, bukan halaman)", pageFiles.length === 17);

const registeredKeys = new Set();
// giftRecommendations diedit langsung di kartu foto folder gift_item (lihat
// panel/photos.js), bukan di hadiah.js sebagai form terpisah — ikutkan file
// itu di pencarian token supaya jaring pengaman §3.1 tidak salah lapor.
let allPagesText = await fs.readFile("assets/js/panel/photos.js", "utf8");
for (const file of pageFiles) {
  const source = await fs.readFile(path.join(pagesDir, file), "utf8");
  allPagesText += `\n// --- ${file} ---\n` + source;
  const m = source.match(/window\.PanelPages\["([a-z0-9-]+)"\]\s*=\s*\{/);
  if (!m) { check(`${file} mendaftarkan window.PanelPages[...]`, false); continue; }
  const key = m[1];
  registeredKeys.add(key);
  const hasTitle = /title\s*:/.test(source);
  const hasGroup = /group\s*:/.test(source);
  const hasMount = /(?:async\s+)?mount\s*\(/.test(source);
  const hasDestroy = /destroy\s*\(\s*\)\s*\{/.test(source);
  check(`${key}: punya title/group/mount/destroy`, hasTitle && hasGroup && hasMount && hasDestroy);
}
const EXPECTED_KEYS = [
  "home", "cover", "mempelai", "pembuka", "acara", "cerita", "galeri", "hadiah",
  "livestream", "penutup", "sapaan", "ucapan", "template", "warna", "font", "editor-visual", "pengaturan"
];
for (const key of EXPECTED_KEYS) check(`window.PanelPages["${key}"] terdaftar`, registeredKeys.has(key));
check("19 tujuan (18 halaman + Beranda) — router.js membawa link Kirim WA & Check-in QR sendiri",
  registeredKeys.size === EXPECTED_KEYS.length);

const routerSrc = await fs.readFile("assets/js/panel/router.js", "utf8");
check('router.js memuat link "Kirim WhatsApp" (wa.html, bukan PanelPages)', /link:\s*"wa"/.test(routerSrc));
check('router.js memuat link "Check-in QR" (admin-qr.html, bukan PanelPages)', /link:\s*"admin-qr"/.test(routerSrc));

// ---------------------------------------------------------------------
// 4) Field lama (§3.1) semuanya punya rumah — dicek sebagai token yang
//    HARUS muncul di suatu tempat pada gabungan seluruh file pages/*.js.
//    Dua penyesuaian sengaja terhadap nama di tabel §3.1 (kode nyata yang
//    benar, dicatat di ringkasan eksekusi): "gift.templateKado" -> field
//    asli adalah gift.address.template; "closingText" -> field asli
//    adalah closing.text (dipindah ke halaman Penutup, bukan Sapaan Tamu).
// ---------------------------------------------------------------------
const FIELD_TOKENS = [
  "subcover.enabled", "subcover.quoteLine1", "subcover.quoteLine2",
  "couple.bride", "couple.groom", '"bride"', '"groom"',
  "opening.arabicQuote", "opening.quote", "opening.source", '"opening"', '"std2"',
  "event.dateISO", "event.dateLabel", "event.dayLabel", "event.countdownTarget",
  "event.akad", "event.resepsi", "dresscode.text", "dresscode.colors", '"event"',
  "loveStory", '"story"',
  "quotePhoto.quote", "galleryVideo", '"gallery"', '"quote"',
  "gift.accounts", "gift.contactCPW", "gift.contactCPP", "gift.address",
  "giftRecommendations", '"gift_item"',
  "livestream.youtube", "livestream.instagram", "livestream.tiktok",
  "closing.text", '"closing"',
  "defaultGuestGreeting", "guestGreetings",
  "template",
  "theme",
  "typography.elements",
  "visualEditor",
  "siteTitle", "guestParam", "defaultGuestName", "heroSlideInterval", "audio.title", "audio.path",
  "qrCheckin.enabled"
];
for (const token of FIELD_TOKENS) {
  check(`field "${token}" ada rumahnya di pages/*.js`, allPagesText.includes(token));
}

// R1 (docs/rencana-admin-v2-revisi.md): qrCheckin.enabled sempat kehilangan
// UI-nya seluruhnya (Check-in QR jadi link biasa ke admin-qr.html, bukan
// halaman panel, jadi togglenya tidak punya rumah). Cek generik di atas
// (substring "qrCheckin.enabled" di gabungan pages/*.js) tidak cukup keras —
// string itu bisa saja hanya muncul di komentar. Pastikan spesifik: halaman
// Pengaturan benar-benar merender kontrol .p-switch untuk field ini DAN
// menyimpannya lewat store.js.
const pengaturanSrc = await fs.readFile(path.join(pagesDir, "pengaturan.js"), "utf8");
check("pengaturan.js merender switch untuk qrCheckin.enabled (bukan cuma disebut di komentar)",
  /switchRow\(\s*"[^"]*"\s*,\s*"[a-z0-9-]+qr[a-z0-9-]*"/i.test(pengaturanSrc));
check("pengaturan.js menyimpan qrCheckin.enabled lewat PanelStore",
  /PanelStore\.set\(\s*"qrCheckin\.enabled"/.test(pengaturanSrc) && /PanelStore\.save\(\[[^\]]*"qrCheckin"/.test(pengaturanSrc));

// ---------------------------------------------------------------------
// 5) panel.css: tidak ada literal hex di luar blok :root.
// ---------------------------------------------------------------------
const panelCss = await fs.readFile("assets/css/panel.css", "utf8");
const rootMatch = panelCss.match(/:root\s*\{[\s\S]*?\n\}/);
check("panel.css punya blok :root", !!rootMatch);
const withoutRoot = rootMatch ? panelCss.slice(0, rootMatch.index) + panelCss.slice(rootMatch.index + rootMatch[0].length) : panelCss;
const strayHex = withoutRoot.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
check("tidak ada literal hex di luar :root", strayHex.length === 0);
if (strayHex.length) console.error("  hex ditemukan:", strayHex.join(", "));

// ---------------------------------------------------------------------
// 6) admin-qr.html & wa.html tidak disentuh secara struktural — masih
//    memuat shared.js dan modul aslinya.
// ---------------------------------------------------------------------
const adminQrHtml = await fs.readFile("admin-qr.html", "utf8");
check("admin-qr.html masih memuat shared.js", /admin\/shared\.js/.test(adminQrHtml));
check("admin-qr.html masih memuat admin-qr.js", /admin\/admin-qr\.js/.test(adminQrHtml));
const waHtml = await fs.readFile("wa.html", "utf8");
check("wa.html masih memuat shared.js", /admin\/shared\.js/.test(waHtml));
check("wa.html masih memuat wa-blast.js", /admin\/wa-blast\.js/.test(waHtml));

if (failed) {
  console.error("\nFAIL: kontrak admin v2 belum terpenuhi.");
  process.exit(1);
}
console.log("\nPASS: kontrak admin v2 terpenuhi.");
