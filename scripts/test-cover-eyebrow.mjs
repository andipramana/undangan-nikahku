/** Tulisan di atas nama (cover & Save The Date): bisa diganti per client lewat field
 *  cover.eyebrow; kosong = bawaan "The Wedding Of" tetap. */
import fs from "node:fs/promises";
let failed = false;
const check = (label, pass) => { console.log(`${pass ? "PASS" : "FAIL"}: ${label}`); if (!pass) failed = true; };
const manifest = JSON.parse(await fs.readFile("templates/klasik/template.json", "utf8"));
const cover = manifest.editor.sections.find((s) => s.key === "cover");
const field = cover.fields.find((f) => f.path === "cover.eyebrow");
check("panel: field cover.eyebrow ada di bab Cover (teks, kartu Cover)", !!field && field.type === "text" && field.card === "Cover");
check("panel: placeholder menunjukkan bawaan", field && field.placeholder === "The Wedding Of");
const render = await fs.readFile("templates/klasik/render.js", "utf8");
check("render: eyebrow diisi dari cfg.cover.eyebrow ke semua .eyebrow-wrap .eyebrow", /cfg\.cover && cfg\.cover\.eyebrow/.test(render) && /\.eyebrow-wrap \.eyebrow/.test(render));
check("render: kosong tidak menimpa bawaan (hanya jika ada teks)", /if \(eyebrowText\) document\.querySelectorAll/.test(render));
const markup = await fs.readFile("templates/klasik/markup.html", "utf8");
check("markup: bawaan 'The Wedding Of' tetap ada di cover & Save The Date", (markup.match(/The Wedding Of/g) || []).length === 2);
if (failed) process.exit(1);
console.log("\nSemua pemeriksaan eyebrow LULUS.");
