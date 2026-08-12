import fs from "node:fs/promises";

const [css, modernCss, page, main, nav] = await Promise.all([
  fs.readFile("assets/css/style.css", "utf8"),
  fs.readFile("templates/modern-minimal.css", "utf8"),
  fs.readFile("index.html", "utf8"),
  fs.readFile("assets/js/main.js", "utf8"),
  fs.readFile("assets/js/nav-menu.js", "utf8")
]);

const railIds = ["opening", "couple-bride", "couple-groom", "save-the-date-2", "event"];
const baseScrollerRule = css.match(/\.app-frame__scroll\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const checks = [
  ["mandatory hanya pada mode rail", /\.app-frame__scroll\.snap-mode--upper,\s*\.app-frame__scroll\.snap-mode--gift\s*\{\s*scroll-snap-type:\s*y mandatory;/.test(css)],
  ["mandatory tidak global", !/scroll-snap-type:\s*y mandatory;/.test(baseScrollerRule)],
  ["rail atas hanya mengenali marker upper", /snap-mode--upper \[data-snap-rail="upper"\][\s\S]*scroll-snap-stop:\s*always;/.test(css)],
  ["rail gift hanya mengenali marker gift", /snap-mode--gift \[data-snap-rail="gift"\][\s\S]*scroll-snap-stop:\s*always;/.test(css)],
  ["couple classic tepat satu viewport", /\.couple-solo\.section\s*\{[\s\S]*height:\s*100dvh;[\s\S]*padding:\s*0;/.test(css)],
  ["modern minimal mendukung dua rail", /snap-mode--upper \[data-snap-rail="upper"\][\s\S]*scroll-snap-stop:\s*always;/.test(modernCss) && /snap-mode--gift \[data-snap-rail="gift"\][\s\S]*scroll-snap-stop:\s*always;/.test(modernCss)],
  ["semua section rail atas diberi marker", railIds.every((id) => new RegExp(`<section id="${id}"[^>]*data-snap-rail="upper"`).test(page))],
  ["gift diberi marker rail terpisah", /<section id="gift"[^>]*data-snap-rail="gift"/.test(page)],
  ["controller memakai mode upper dan gift", /function setupSnapRail\(/.test(main) && /snap-mode--upper/.test(main) && /snap-mode--gift/.test(main)],
  ["menu memilih mode snap target", /window\.setInvitationSnapMode\) window\.setInvitationSnapMode\(target\)/.test(nav)],
  ["menu Mempelai menuju bride", /\["couple-bride", "Mempelai"\]/.test(nav)]
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
