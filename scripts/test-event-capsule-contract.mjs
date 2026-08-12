import fs from "node:fs/promises";

const [page, demo, css, modern] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("demo/index.html", "utf8"),
  fs.readFile("assets/css/style.css", "utf8"),
  fs.readFile("templates/modern-minimal.css", "utf8")
]);

const requiredIds = ["event-day-label", "event-date-num", "event-month-label", "event-year-label", "akad-time-h", "akad-time-m", "venue-name-akad", "venue-address-akad", "akad-maps", "resepsi-time-h", "resepsi-time-m", "venue-name-resepsi", "venue-address-resepsi", "resepsi-maps"];
const hasCapsule = (html) => /id="event"[^>]*data-snap-rail[\s\S]*?class="event-hero__capsule"/.test(html);
const checks = [
  ["root Event memiliki capsule rail", hasCapsule(page)],
  ["demo Event memiliki capsule rail", hasCapsule(demo)],
  ["ID data Event tetap utuh", requiredIds.every((id) => page.includes(`id="${id}"`) && demo.includes(`id="${id}"`))],
  ["divider horizontal tersedia", page.includes("divider-horizontal.png") && demo.includes("divider-horizontal.png")],
  ["Classic memiliki capsule ivory", /\.event-hero__capsule\s*\{[\s\S]*border-radius:\s*999px;/.test(css) && /--event-canvas:\s*#f4eee3/.test(css)],
  ["Modern memiliki capsule Event aktual", /#event \.event-hero__capsule\s*\{[\s\S]*border-radius:\s*999px;/.test(modern)],
  ["wrapper capsule tidak tersembunyi reveal", /not\(\.event-hero__capsule\)/.test(css)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
