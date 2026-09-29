/** Editor Visual harus menemukan target teks di SEMUA template, bukan cuma
 * klasik. Bug yang dikunci di sini: assets/js/visual-editor/registry.js
 * mencari kandidat dengan selector `#invitation h1, #invitation h2, ...` —
 * tapi `#invitation` HANYA ada di templates/klasik/markup.html (elemen
 * `<main id="invitation">`). Nocturne/Kertas/Sekar Jagat memakai id akar
 * sendiri (nc-root/kt-root/sj-root), jadi candidates() mengembalikan array
 * KOSONG untuk ketiganya — halaman Editor Visual di admin tampak "berhasil
 * dimuat" tapi tidak ada satu pun elemen berpensil untuk diedit.
 *
 * page.setContent mandiri per template (pola sama seperti
 * test-template-shared-modules.mjs): markup ASLI dimuat, dibungkus #inv-root
 * (elemen mount universal milik cangkang, bukan template mana pun), lalu
 * registry.js yang ASLI dijalankan di atasnya — tanpa stub, karena yang
 * diuji adalah selector-nya sendiri.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const registrySrc = await fs.readFile("assets/js/visual-editor/registry.js", "utf8");
const folders = (await fs.readdir("templates", { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);

const browser = await chromium.launch();
for (const id of folders) {
  const markup = await fs.readFile(path.join("templates", id, "markup.html"), "utf8");
  const page = await browser.newPage();
  // Markup dibungkus #inv-root — persis cara core/engine.js memasangnya
  // (root.innerHTML = markup; lihat mount() di engine.js), bukan ditempel
  // langsung ke <body>.
  await page.setContent(`<div id="inv-root">${markup}</div>`);
  await page.addScriptTag({ content: registrySrc });

  const targets = await page.evaluate(() => window.VisualEditorRegistry.autoTargets(document).map((t) => t.label));
  // "count > 0" TIDAK CUKUP: #gift-confirm-modal & #gift-recs-modal punya
  // selector SENDIRI di daftar yang sama (tidak lewat #invitation), jadi
  // keduanya tetap menyumbang ~5 target walau seluruh BADAN undangan tidak
  // tercakup sama sekali — persis kondisi bug ini sebelum diperbaiki. Yang
  // membuktikan bug benar-benar hilang adalah target dari BADAN undangan
  // (bukan modal hadiah) benar-benar ada — di sini diwakili tombol "Buka
  // Undangan", satu-satunya teks yang pasti ada di sampul tiap template.
  const modalOnly = targets.filter((t) => /pengiriman|whatsapp|rekomendasi kado|^×$/i.test(t));
  const fromBody = targets.length - modalOnly.length;
  check(`${id}: Editor Visual menemukan target di BADAN undangan, bukan cuma modal hadiah (${fromBody} target)`,
    fromBody > 0, `total ${targets.length} target, semuanya dari modal hadiah: ${JSON.stringify(targets)}`);
  check(`${id}: tombol "Buka Undangan" ada di antara target yang bisa diedit`,
    targets.some((t) => /buka undangan/i.test(t)));
  await page.close();
}
await browser.close();

if (failed) { console.error("\nFAIL: Editor Visual tidak menemukan target di satu atau lebih template."); process.exit(1); }
console.log("\nPASS: Editor Visual menemukan target teks di semua template.");
