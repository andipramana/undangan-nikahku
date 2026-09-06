import fs from "node:fs/promises";

// Markup & CSS undangan sekarang milik template, bukan index.html/style.css:
// index.html tinggal cangkang kosong dan tiap template membawa markup+CSS-nya
// sendiri (lihat docs/kontrak-template.md). Template modern-minimal dihapus.
// demo/index.html kini cangkang yang sama dengan index.html (template yang
// menentukan markup), jadi tidak ada lagi salinan markup terpisah untuk diuji.
const [page, css] = await Promise.all([
  fs.readFile("templates/klasik/markup.html", "utf8"),
  fs.readFile("templates/klasik/style.css", "utf8")
]);

const requiredIds = ["event-day-label", "event-date-num", "event-month-label", "event-year-label", "akad-time-h", "akad-time-m", "venue-name-akad", "venue-address-akad", "akad-maps", "resepsi-time-h", "resepsi-time-m", "venue-name-resepsi", "venue-address-resepsi", "resepsi-maps"];
const hasCapsule = (html) => /id="event"[^>]*data-snap-rail[\s\S]*?class="event-hero__capsule"/.test(html);
const checks = [
  ["root Event memiliki capsule rail", hasCapsule(page)],
  ["ID data Event tetap utuh", requiredIds.every((id) => page.includes(`id="${id}"`))],
  ["Classic memiliki capsule ivory", /\.event-hero__capsule\s*\{[\s\S]*border-radius:\s*999px;/.test(css) && /--event-canvas:\s*#f4eee3/.test(css)],
  ["wrapper capsule tidak tersembunyi reveal", /not\(\.event-hero__capsule\)/.test(css)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
