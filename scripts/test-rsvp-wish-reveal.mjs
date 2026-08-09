import fs from "node:fs/promises";

const html = await fs.readFile("index.html", "utf8");
const rsvp = await fs.readFile("assets/js/rsvp.js", "utf8");
const reveal = await fs.readFile("assets/js/reveal.js", "utf8");

const checks = [
  ["RSVP wrapper bukan reveal group", /<div class="rsvp-wrap" data-reveal="fade">/.test(html)],
  ["wish card memakai pemicu awal bawah viewport", /class="wish-card" data-reveal="\$\{i % 2 \? "slide-left" : "slide-right"\}" data-reveal-early/.test(rsvp)],
  ["wish card didaftarkan ke observer individual", /window\.revealScan\) window\.revealScan\(listEl\)/.test(rsvp)],
  ["observer early memakai pemicu bawah viewport", /rootMargin: "0px 0px -5% 0px"/.test(reveal)]
];

for (const [name, passed] of checks) {
  if (!passed) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}
