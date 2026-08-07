/**
 * Memindai folder foto dan menulis manifest.json per folder (diurutkan nama file).
 * Jalankan ulang SETIAP kali foto ditambah/dihapus: `node scripts/build-manifests.mjs`
 * Aplikasi tidak menyebut nama file statis — cukup fetch manifest + urutkan by name.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "img");
const FOLDERS = [
  "foto_cover", // slideshow cover (halaman pertama)
  "foto_opening", // slideshow section pembuka (countdown)
  "foto_closing", // slideshow penutup (footer)
  "foto_slider_section_1", // slider We Found Love
  "foto_slider_section_2", // slider kartu Event
  "foto_gallery", // galeri foto
  "foto_bride", // slideshow mempelai wanita
  "foto_groom" // slideshow mempelai pria
];

for (const dir of FOLDERS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) {
    console.warn("SKIP (folder tidak ada):", dir);
    continue;
  }
  const jpgs = fs
    .readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith(".jpg"))
    .sort(); // urut nama: 01, 02, ..., 20
  const items = jpgs.map((f) => ({
    jpg: `assets/img/${dir}/${f}`,
    webp: `assets/img/${dir}/${f.replace(/\.jpg$/i, ".webp")}`
  }));
  fs.writeFileSync(path.join(full, "manifest.json"), JSON.stringify(items, null, 2));
  console.log(`${dir}: ${items.length} foto -> manifest.json`);
}
