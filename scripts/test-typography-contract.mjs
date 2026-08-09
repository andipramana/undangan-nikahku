import fs from "node:fs/promises";

const guest = await fs.readFile("assets/js/theme.js", "utf8");
const admin = await fs.readFile("assets/js/admin/fonts.js", "utf8").catch(() => "");
const page = await fs.readFile("admin.html", "utf8");

const checks = [
  ["tab Font tersedia", /data-tab="fonts"/.test(page)],
  ["panel Font tersedia", /id="tab-fonts"/.test(page)],
  ["aplikasi tamu menerapkan tipografi", /applyTypography/.test(guest)],
  ["panel admin Font tersedia", /window\.FontsPanel/.test(admin)],
  ["kontrol font manual tersedia", /font-custom/.test(admin)],
  ["preview lokal tersedia", /font-preview/.test(admin)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
