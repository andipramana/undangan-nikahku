import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
// R2 (docs/rencana-admin-v2-revisi.md): admin.css dihapus. Di admin v2 ruang
// aman di bawah tombol simpan bukan lagi aturan khusus `.visual-editor-panel`
// (tab lama) — SEMUA halaman berbagi satu save bar (.p-savebar, panel/router.js).
//
// Putaran desain 2026-08 mengubah implementasinya dari "sticky bottom:0
// full-width" menjadi PIL MELAYANG position:fixed di bawah-tengah dengan
// offset env(safe-area-inset-bottom). Test ini sengaja MENEGASKAN PERILAKU,
// bukan properti CSS spesifik: (1) savebar memperhitungkan safe-area bawah
// perangkat ber-notch, (2) ia selalu punya JARAK dari tepi bawah viewport
// (tidak pernah menempel edge bahkan saat env() = 0 di desktop), dan
// (3) di layar sempit ia tidak menempel/menembus edge kiri-kanan.
const css = await fs.readFile("assets/css/panel.css", "utf8");
let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const rule = css.match(/\.p-savebar\s*\{[^}]*\}/s);
check("panel.css punya rule .p-savebar", !!rule);
if (!rule || !rule[0].includes("safe-area-inset-bottom")) {
  check("save bar memperhitungkan ruang aman bawah (env(safe-area-inset-bottom))", false);
} else {
  check("save bar memperhitungkan ruang aman bawah (env(safe-area-inset-bottom))", true);
}
// Mengambang/sticky terhadap viewport — keduanya sah; yang dilarang: statis
// (ikut scroll hilang) atau offset bawah 0 persis (menempel edge / masuk area notch).
const positioned = rule && (/position:\s*(fixed|sticky)/.test(rule[0]));
const offEdge = rule && !/bottom:\s*0(?![^a-z])/.test(rule[0].replace(/calc\([^)]*\)/g, ""));
check("save bar mengambang di viewport (position fixed/sticky)", !!positioned);
check("save bar punya offset dari tepi bawah (bottom bukan 0 persis)", !!offEdge);

if (!failed) {
  const browser = await chromium.launch();
  try {
    // Geometri nyata: savebar ditampilkan (router hanya memunculkannya saat
    // dirty — di sini cukup un-hide untuk mengukur kotaknya).
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      const page = await browser.newPage({ viewport: vp });
      try {
        await page.setContent(`<style>${css}</style><div class="p-savebar" id="sb"><span class="p-savebar__status">x</span><button class="p-btn p-btn--primary">Simpan</button></div>`);
        const rect = await page.locator("#sb").evaluate((el) => {
          el.hidden = false;
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
        });
        check(`${vp.width}px: save bar terlihat`, rect.height > 0);
        check(`${vp.width}px: tidak menempel/menembus tepi bawah (jarak >= 8px; rect.bottom=${rect.bottom.toFixed(1)}, vh=${vp.height})`,
          rect.bottom <= vp.height - 8);
        if (vp.width < 500) {
          check(`${vp.width}px: tidak menempel tepi kiri-kanan (left=${rect.left.toFixed(1)}, right=${rect.right.toFixed(1)})`,
            rect.left >= 8 && rect.right <= vp.width - 8);
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (failed) { console.error("\nFAIL: save bar panel tidak menyediakan ruang aman di bawah."); process.exit(1); }
console.log("\nPASS: save bar panel (dipakai semua halaman termasuk Editor Visual) melayang dengan jarak aman dari tepi & safe-area.");
