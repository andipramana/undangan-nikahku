/** "Clone dari client lain" (provision-invitation): parsing slug/URL dan isi konten hasil
 *  clone. Kode diambil langsung dari index.ts. Yang dijaga: SEMUA ikut kecuali nama
 *  mempelai (dan data per-orang di bawahnya), ikon unggahan milik sumber, dan judul situs. */
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

let failed = false;
const check = (label, pass, detail) => {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
};

const src = await fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8");
const a = src.indexOf("const slugFromInput");
const b = src.indexOf("const loadCloneSource");
check("potongan kode ditemukan", a > 0 && b > a);
const js = stripTypeScriptTypes(src.slice(a, b));
const blank = 'const blankPerson = (name) => ({ name, nickname: name, father: "", mother: "", instagram: "" });';
const { slugFromInput, buildCloneContent } = new Function(`${blank}\n${js}\nreturn { slugFromInput, buildCloneContent };`)();

for (const [input, want] of [
  ["julia-dan-kevin", "julia-dan-kevin"],
  ["https://willcome.my.id/julia-dan-kevin/", "julia-dan-kevin"],
  ["willcome.my.id/Julia-Dan-Kevin/?to=Putri", "julia-dan-kevin"],
  ["  https://willcome.my.id/uput-dan-dany/admin/#/warna ", "uput-dan-dany"],
  ["", ""],
]) check(`slugFromInput(${JSON.stringify(input)}) = ${JSON.stringify(want)}`, slugFromInput(input) === want, slugFromInput(input));

const source = {
  templateId: "klasik",
  couple: { bride: { name: "Sumber W", nickname: "SW", father: "Ayah", mother: "Ibu", instagram: "@sw" }, groom: { name: "Sumber P" }, extra: "tetap" },
  siteTitle: "Sumber — The Wedding",
  appIcon: { path: "sumber/icons/a.png", custom: true },
  event: { dateISO: "2026-11-08", dateLabel: "08 November 2026", akad: { venue: { name: "Gedung X" } } },
  gift: { accounts: [{ bank: "BCA", number: "123" }] },
  loveStory: [{ title: "Bertemu" }],
  guestGreetings: [{ label: "Keluarga" }],
  audio: { path: "sumber/audio/a.mp3" },
  templates: { klasik: { theme: { colors: { bg: "#123456" } }, photos: { cover: [1] }, visualEditor: { elements: { a: { text: "Teks sumber" } } } } },
};
const snap = JSON.stringify(source);
const out = buildCloneContent(source, "Baru & Baru", "Putri", "Dany");
check("sumber tidak dimutasi", JSON.stringify(source) === snap);
check("nama mempelai diganti isian form", out.couple.bride.name === "Putri" && out.couple.groom.name === "Dany");
check("orang tua & Instagram mempelai lama dikosongkan", out.couple.bride.father === "" && out.couple.bride.instagram === "");
check("judul situs mengikuti nama client baru", out.siteTitle === "Baru & Baru — The Wedding");
check("ikon unggahan sumber tidak ikut", out.appIcon === undefined);
check("tanggal & lokasi acara ikut", out.event.dateISO === "2026-11-08" && out.event.akad.venue.name === "Gedung X");
check("rekening, cerita, sapaan ikut", out.gift.accounts[0].bank === "BCA" && out.loveStory.length === 1 && out.guestGreetings.length === 1);
check("setelan template + override teks Editor Visual ikut", out.templates.klasik.theme.colors.bg === "#123456" && out.templates.klasik.visualEditor.elements.a.text === "Teks sumber");
check("templateId & field lain ikut", out.templateId === "klasik" && out.couple.extra === "tetap");

if (failed) { console.error("\nFAIL: clone"); process.exit(1); }
console.log("\nSemua pemeriksaan clone LULUS.");
