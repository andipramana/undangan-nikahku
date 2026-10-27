/** Grid foto di panel admin tidak boleh melebihi kontainernya.
 *
 * `.p-photo-card { grid-column: span 12 }` ditulis untuk grid galeri (12 kolom)
 * tapi berlaku untuk SEMUA `.p-photo-grid`. Pada grid biasa (auto-fill,
 * minmax(150px, 1fr)) tiap kartu dipaksa menjangkau 12 kolom: browser membuat 10
 * kolom implisit + 11 celah, grid melebar melewati kartunya, dan foto di picker
 * per-template terpotong/meluber ke kanan — terlihat di viewport sempit.
 *
 * Memakai panel.css asli dan markup yang sama dengan photos.js /
 * photo-template-picker.js; tidak butuh server maupun Supabase.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const css = await fs.readFile("assets/css/panel.css", "utf8");

const card = (cls = "", ratio = "9/16") =>
  `<div class="p-photo-card ${cls}" style="--photo-ratio:${ratio}">
     <div class="p-photo-card__thumb"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>
     <div class="p-photo-card__meta"><span class="p-photo-card__name">060.webp</span></div>
     <div class="p-photo-card__actions"><button class="p-btn p-btn--tiny">Atur crop</button><button class="p-btn p-btn--tiny">&#9650;</button><button class="p-btn p-btn--tiny">&#9660;</button></div>
   </div>`;

const browser = await chromium.launch();

// Lebar ISI kartu (bukan viewport): viewport dikurangi padding halaman dan kartu,
// jadi 360px di layar sudah menjadi sekitar 280px di dalam kartu. Batas lama
// meluber ada di ~282px (150px kolom + 11 celah 12px dari kolom implisit).
for (const width of [200, 240, 270, 281, 300, 340, 420]) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await page.setContent(`<style>${css}</style>
    <div id="box" style="box-sizing:border-box;width:${width}px;margin:0">
      <div class="p-photo-grid" id="plain">${card()}${card()}${card()}</div>
      <div class="p-photo-grid p-photo-grid--gallery" id="gallery">${card("p-photo-card--half", "1/1")}${card("p-photo-card--half", "1/1")}${card("p-photo-card--full", "16/9")}</div>
    </div>`);

  const m = await page.evaluate(() => {
    const rect = (el) => el.getBoundingClientRect();
    const box = rect(document.getElementById("box"));
    const plain = document.getElementById("plain");
    const gallery = document.getElementById("gallery");
    const cards = [...plain.querySelectorAll(".p-photo-card")].map(rect);
    const gcards = [...gallery.querySelectorAll(".p-photo-card")].map(rect);
    return {
      boxRight: box.right,
      plainRight: Math.max(...cards.map((r) => r.right)),
      gridScroll: plain.scrollWidth - plain.clientWidth,
      galleryWidth: rect(gallery).width,
      galleryRight: Math.max(...gcards.map((r) => r.right)),
      gHalf: gcards[0].width, gFull: gcards[2].width
    };
  });

  check(`isi ${width}px: kartu foto grid biasa tidak keluar dari kontainer`, m.plainRight <= m.boxRight + 0.5,
    `kartu paling kanan ${Math.round(m.plainRight)}px > kontainer ${Math.round(m.boxRight)}px`);
  check(`isi ${width}px: grid biasa tidak scroll horizontal`, m.gridScroll <= 0, `lebih ${m.gridScroll}px`);
  // Grid galeri tetap 12 kolom: kartu "full" selebar grid, "half" sekitar separuh.
  check(`isi ${width}px: galeri tetap di dalam kontainer`, m.galleryRight <= m.boxRight + 0.5, `${Math.round(m.galleryRight)} > ${Math.round(m.boxRight)}`);
  check(`isi ${width}px: galeri tetap benar (full = selebar grid)`, Math.abs(m.gFull - m.galleryWidth) <= 1, `${m.gFull} vs ${m.galleryWidth}`);
  check(`isi ${width}px: galeri tetap benar (half ≈ separuh)`, m.gHalf < m.galleryWidth * 0.55 && m.gHalf > m.galleryWidth * 0.4, `${m.gHalf} dari ${m.galleryWidth}`);
  await page.close();
}

await browser.close();
process.exit(failed ? 1 : 0);
