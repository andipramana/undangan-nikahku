/** Path `templates/default/*` adalah objek Supabase Storage, bukan berkas situs.
 *
 * Snapshot provisioning menyalin foto & audio default ke Storage dengan path
 * `templates/default/photos/NNN.webp` dan `templates/default/audio/...`.
 * window.photoUrl pernah memperlakukan SEMUA awalan `templates/` sebagai berkas
 * lokal dan mengembalikannya apa adanya, sehingga browser meminta
 * willcome.my.id/templates/default/photos/065.webp (404) untuk setiap client
 * baru. Berkas lokal template lain (`templates/klasik/cover.jpg`) tetap lokal.
 *
 * Juga mengunci: provisioning membuang override TEKS Editor Visual root
 * ("Mita & Andi" ditimpakan ke halaman tamu client baru) tetapi mempertahankan
 * penyesuaian tampilannya, karena root adalah patokan desain client baru.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [configJs, clientJs, fn] = await Promise.all([
  fs.readFile("assets/js/config.js", "utf8"),
  fs.readFile("assets/js/supabase-client.js", "utf8"),
  fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8")
]);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<!doctype html><body></body>");
await page.addScriptTag({ content: configJs });
await page.addScriptTag({ content: clientJs });
const out = await page.evaluate(() => ({
  photo: window.photoUrl("templates/default/photos/065.webp"),
  audio: window.audioUrl("templates/default/audio/backsound.mp3"),
  srcset: window.photoSrcset("templates/default/photos/065.webp"),
  localCover: window.photoUrl("templates/klasik/cover.jpg"),
  localAsset: window.photoUrl("assets/img/foto_cover/01.webp"),
  tenantFoto: window.photoUrl("julia-dan-kevin/cover/1.webp")
}));
await browser.close();

check("foto snapshot (templates/default/photos) dibaca dari Storage",
  /\/storage\/v1\/object\/public\/photos\/templates\/default\/photos\/065\.webp$/.test(out.photo), out.photo);
check("audio snapshot (templates/default/audio) dibaca dari Storage",
  /\/storage\/v1\/object\/public\/photos\/templates\/default\/audio\/backsound\.mp3$/.test(out.audio), out.audio);
check("srcset foto snapshot memakai transformasi Storage", /width=480 480w/.test(out.srcset), out.srcset);
check("berkas lokal template lain tetap lokal", out.localCover === "templates/klasik/cover.jpg", out.localCover);
check("assets/ tetap lokal", out.localAsset === "assets/img/foto_cover/01.webp", out.localAsset);
check("foto tenant biasa dibaca dari Storage", /\/storage\/v1\/object\/public\/photos\/julia-dan-kevin\/cover\/1\.webp$/.test(out.tenantFoto), out.tenantFoto);

check("provisioning: override TEKS Editor Visual root dibuang (akar & per-template)",
  /delete el\.text/.test(fn) && /stripCopyOverrides\(content\.visualEditor\)/.test(fn) && /stripCopyOverrides\(block\.visualEditor\)/.test(fn));
check("provisioning: penyesuaian tampilan root TIDAK dibuang (root = patokan desain)",
  !/delete content\.visualEditor/.test(fn) && !/delete block\.visualEditor/.test(fn));

process.exit(failed ? 1 : 0);
