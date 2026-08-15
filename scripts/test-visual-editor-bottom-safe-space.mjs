import fs from "node:fs/promises";
// R2 (docs/rencana-admin-v2-revisi.md): admin.css dihapus. Di admin v2 ruang
// aman di bawah tombol simpan floating bukan lagi aturan khusus
// `.visual-editor-panel` (tab lama, satu tombol simpan per tab) — sekarang
// SEMUA halaman berbagi satu save bar sticky (.p-savebar, panel/router.js),
// jadi cukup satu aturan generik yang menaunginya, termasuk Editor Visual.
const css = await fs.readFile("assets/css/panel.css", "utf8");
const rule = css.match(/\.p-savebar\s*\{[^}]*\}/s);
if (!rule || !rule[0].includes("safe-area-inset-bottom")) {
  throw new Error("Save bar panel tidak memiliki ruang bawah aman (env(safe-area-inset-bottom)).");
}
if (!/position:\s*sticky/.test(rule[0]) || !/bottom:\s*0/.test(rule[0])) {
  throw new Error("Save bar panel harus sticky di bawah viewport.");
}
console.log("PASS: save bar panel (dipakai semua halaman termasuk Editor Visual) menyediakan ruang aman di bawah tombol floating.");
