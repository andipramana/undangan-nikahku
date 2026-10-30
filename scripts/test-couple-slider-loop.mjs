// Slider mempelai harus loop searah: dari foto terakhir terus maju ke foto pertama
// (lewat klon), tidak pernah memutar mundur melewati semua foto.
import { chromium } from "playwright";
import fs from "node:fs";

const src = fs.readFileSync("assets/js/couple-sliders.js", "utf8");
let failed = 0;
const check = (n, ok) => { console.log(`${ok ? "PASS" : "FAIL"}: ${n}`); if (!ok) failed++; };

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>.couple-slider{overflow:hidden;width:200px}.swiper-wrapper{display:flex;transition:transform .05s}.swiper-slide{flex:0 0 100%}</style>
<div id="bride-slider" class="couple-slider"><div class="swiper-wrapper" id="bride-slider-wrapper"></div></div>
<div id="groom-slider" class="couple-slider"><div class="swiper-wrapper" id="groom-slider-wrapper"></div></div>`);
await page.evaluate((code) => {
  window.getPhotos = async () => [1, 2, 3].map((n) => ({ n }));
  window.buildPhotoSlide = (item, cls) => { const d = document.createElement("div"); d.className = `${cls} swiper-slide`; d.textContent = item.n; return d; };
  window.whenInvitationOpen = (fn) => fn();
  window.__ctl = {};
  window.pauseAutoplayOffscreen = (c, el) => { window.__ctl[el.id] = c; };
  (0, eval)(code);
}, src);
await page.evaluate(() => window.initCoupleSliders());

// Rekam semua perubahan transform + transition pada wrapper.
await page.evaluate(() => {
  const w = document.getElementById("bride-slider-wrapper");
  window.__log = [];
  // Tiap perubahan style = satu record; oldValue record berikutnya = keadaan setelah perubahan ini.
  let pending = [];
  const flush = (final) => {
    const states = pending.slice(1).concat(final);
    states.forEach((st) => window.__log.push({ t: /transform:\s*([^;]+)/.exec(st)[1], none: /transition:\s*none/.test(st) }));
    pending = [];
  };
  window.__flush = () => flush(w.getAttribute("style"));
  new MutationObserver((recs) => { recs.forEach((r) => pending.push(r.oldValue || "")); })
    .observe(w, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
});
const pct = (t) => parseFloat((/translate3d\((-?[\d.]+)%/.exec(t) || [])[1]);

const visible = () => page.evaluate(() => {
  const w = document.getElementById("bride-slider-wrapper");
  const m = /translate3d\((-?[\d.]+)%/.exec(w.style.transform);
  return w.children[Math.round(-parseFloat(m[1]) / 100)].textContent;
});

check("ada klon di depan & belakang (5 anak untuk 3 foto)",
  await page.evaluate(() => document.getElementById("bride-slider-wrapper").children.length === 5));
check("mulai di foto 1", (await visible()) === "1");

const seq = [];
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => { const r = Array.from(document.getElementById('bride-slider-wrapper').children).filter(c => !c.dataset.clone).findIndex(c => c.classList.contains('swiper-slide-active')); window.__ctl['bride-slider'].slideTo(r + 1); });
  await page.waitForTimeout(120);
  seq.push(await visible());
}
check(`maju terus berurutan 2,3,1,2,3,1 (dapat: ${seq})`, seq.join() === "2,3,1,2,3,1");

await page.evaluate(() => window.__flush());
const log = await page.evaluate(() => window.__log);
let bigJump = false;
for (let i = 1; i < log.length; i++) {
  if (!log[i].none && Math.abs(pct(log[i].t) - pct(log[i - 1].t)) > 100.01) bigJump = true;
}
check("tidak ada geseran animasi lebih dari satu foto", !bigJump);

// Mundur dari foto 1 → foto 3 juga searah (slider pria berarah terbalik).
const back = [];
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => { const r = Array.from(document.getElementById('bride-slider-wrapper').children).filter(c => !c.dataset.clone).findIndex(c => c.classList.contains('swiper-slide-active')); window.__ctl['bride-slider'].slideTo(r - 1); });
  await page.waitForTimeout(120);
  back.push(await visible());
}
check(`mundur berurutan (dapat: ${back})`, back.join() === "3,2,1,3");
await page.evaluate(() => window.__flush());
const log2 = await page.evaluate(() => window.__log);
let bigJump2 = false;
for (let i = 1; i < log2.length; i++) {
  if (!log2[i].none && Math.abs(pct(log2[i].t) - pct(log2[i - 1].t)) > 100.01) bigJump2 = true;
}
check("mundur: tidak ada geseran animasi lebih dari satu foto", !bigJump2);

await browser.close();
if (failed) { console.log(`\nFAIL: ${failed} pemeriksaan gagal.`); process.exit(1); }
console.log("\nSemua pemeriksaan slider mempelai LULUS.");
