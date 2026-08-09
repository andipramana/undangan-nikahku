import fs from "node:fs/promises";
const css = await fs.readFile("assets/css/admin.css", "utf8");
const rule = css.match(/\.visual-editor-panel\s*\{[^}]*padding:\s*([^;]+);/s);
if (!rule || !rule[1].includes("5.5rem") || !rule[1].includes("safe-area-inset-bottom")) {
  throw new Error("Editor Visual tidak memiliki ruang bawah aman untuk tombol simpan floating.");
}
console.log("PASS: panel Editor Visual menyediakan ruang aman di bawah tombol floating.");
