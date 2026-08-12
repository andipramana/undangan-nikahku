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
  ["mandatory hanya pada class rail", /\.app-frame__scroll\.is-snap-rail\s*\{\s*scroll-snap-type:\s*y mandatory;/.test(css)],
  ["mandatory tidak global", !/scroll-snap-type:\s*y mandatory;/.test(baseScrollerRule)],
  ["semua rail berhenti satu per satu", /\.app-frame__scroll\.is-snap-rail \[data-snap-rail\][\s\S]*scroll-snap-stop:\s*always;/.test(css)],
  ["couple classic tepat satu viewport", /\.couple-solo\.section\s*\{[\s\S]*height:\s*100dvh;[\s\S]*padding:\s*0;/.test(css)],
  ["modern minimal mendukung rail dan couple baru", /\.app-frame__scroll\.is-snap-rail \[data-snap-rail\][\s\S]*scroll-snap-stop:\s*always;/.test(modernCss) && /\.couple-solo\.section\s*\{[\s\S]*height:\s*100dvh;/.test(modernCss)],
  ["semua section rail diberi penanda", railIds.every((id) => new RegExp(`<section id="${id}"[^>]*data-snap-rail`).test(page))],
  ["controller mengatur class rail", /function setupSnapRail\(/.test(main) && /window\.setInvitationSnapMode\s*=\s*setMode/.test(main)],
  ["menu memilih mode snap target", /window\.setInvitationSnapMode\) window\.setInvitationSnapMode\(target\)/.test(nav)],
  ["menu Mempelai menuju bride", /\["couple-bride", "Mempelai"\]/.test(nav)]
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
