import fs from "node:fs/promises";

// Diperbarui untuk admin v2 (rencana-admin-v2.md): tab lama (data-tab="fonts")
// digantikan halaman panel/pages/font.js sendiri, tanpa markup tab sama sekali.
const guest = await fs.readFile("assets/js/theme.js", "utf8");
const admin = await fs.readFile("assets/js/panel/pages/font.js", "utf8").catch(() => "");
const page = await fs.readFile("admin.html", "utf8");

const checks = [
  ["halaman Font terdaftar di admin.html", /pages\/font\.js/.test(page)],
  ["tidak ada markup tab lama", !/data-tab="fonts"/.test(page) && !/id="tab-fonts"/.test(page)],
  ["aplikasi tamu menerapkan tipografi", /applyTypography/.test(guest)],
  ["halaman Font terdaftar di window.PanelPages", /window\.PanelPages\["font"\]/.test(admin)],
  ["kontrol font manual tersedia", /font-custom|data-font-family/.test(admin)],
  ["preview lokal tersedia", /font-preview|data-font-preview/.test(admin)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
