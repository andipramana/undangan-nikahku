/**
 * Renderer bab generik (assets/js/panel/pages/section.js).
 *
 * Sembilan halaman bab yang dulu ditulis tangan diganti satu renderer yang
 * dibangun dari skema editor template. Untungnya besar (admin otomatis
 * mengikuti template), risikonya juga: satu bug di sini merusak SEMUA bab
 * sekaligus, dan skema yang salah tidak pernah melempar error — gejalanya
 * cuma "field-nya tidak nyimpen" atau "kartunya kosong".
 *
 * Diuji dengan skema NYATA dari templates/klasik/template.json (bukan skema
 * karangan) di DOM sungguhan: kartu terbentuk sesuai urutan, nilai awal
 * terbaca dari content, editor daftar & warna hidup, simpan menulis ke path
 * yang benar, dan field wajib yang kosong benar-benar memblokir simpan.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const [uiSrc, sectionSrc, manifestRaw] = await Promise.all([
  fs.readFile("assets/js/panel/ui.js", "utf8"),
  fs.readFile("assets/js/panel/pages/section.js", "utf8"),
  fs.readFile("templates/klasik/template.json", "utf8")
]);
const sections = JSON.parse(manifestRaw).editor.sections;
const sectionOf = (key) => sections.find((s) => s.key === key);

const browser = await chromium.launch();
const page = await browser.newPage();

// Store & foto tiruan: cukup untuk renderer, tanpa Supabase maupun server.
// Nilai yang ditulis dikumpulkan apa adanya supaya bisa diperiksa path-nya.
const HARNESS = `
window.__saved = null;
window.__content = {
  couple: { bride: { name: "Ayu", nickname: "Ayu", instagram: "@ayu", father: "Budi", mother: "Sri" },
            groom: { name: "Rizki", nickname: "Kiki", instagram: "", father: "Joko", mother: "Wati" } },
  event: { dateISO: "2026-08-25", dateLabel: "25 Agustus 2026", dayLabel: "Selasa",
           countdownTarget: "2026-08-25T08:00:00+07:00",
           akad: { label: "Akad", start: "08.00", end: "10.00", venue: { name: "Masjid", address: "Jl. A", mapsUrl: "" } },
           resepsi: { label: "Resepsi", start: "11.00", end: "14.00", venue: { name: "Gedung", address: "Jl. B", mapsUrl: "" } } },
  dresscode: { text: "Earth tone", colors: ["#c9a668", "#2b2620"] },
  loveStory: [{ date: "2019", title: "Bertemu", text: "Di kampus." }],
  subcover: { enabled: true, quoteLine1: "Baris satu", quoteLine2: "" }
};
window.PanelStore = {
  get(path, fallback) {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.__content);
    return v === undefined ? fallback : v;
  },
  set(path, value) {
    window.__writes = window.__writes || {};
    window.__writes[path] = value;
    const keys = path.split(".");
    let o = window.__content;
    for (let i = 0; i < keys.length - 1; i++) { if (typeof o[keys[i]] !== "object" || o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = value;
  },
  async save(keys) { window.__saved = keys; return { error: null }; }
};
window.PanelRouter = { setDirty(v, fn) { window.__dirty = v; window.__onSave = fn; } };
window.PanelPhotos = { mount(el, slot) { el.dataset.mountedSlot = slot; return { destroy() {} }; } };
window.AdminAPI = { toast(msg, isErr) { window.__toast = { msg, isErr }; } };
`;

async function mountSection(key) {
  await page.setContent('<div id="outlet"></div>');
  await page.addScriptTag({ content: uiSrc });
  await page.addScriptTag({ content: HARNESS });
  await page.addScriptTag({ content: sectionSrc });
  await page.evaluate(async (section) => {
    window.__page = window.PanelSectionPage(section);
    await window.__page.mount(document.getElementById("outlet"));
  }, sectionOf(key));
}

try {
  /* ── Bab Mempelai: dua kartu, foto menumpang kartu orangnya ──────────── */
  await mountSection("mempelai");
  const titles = await page.locator("#outlet .p-card__title").allTextContents();
  check("mempelai: dua kartu, urut wanita lalu pria",
    titles.length === 2 && titles[0] === "Mempelai wanita" && titles[1] === "Mempelai pria");
  check("mempelai: nilai awal terbaca dari content",
    (await page.locator("#outlet input").first().inputValue()) === "Ayu");
  check("mempelai: foto mempelai wanita di dalam kartu wanita (bukan kartu terpisah)",
    await page.locator('#outlet .p-card:first-child [data-mounted-slot="bride"]').count() === 1);
  check("mempelai: slot foto pria ikut ter-mount",
    await page.locator('[data-mounted-slot="groom"]').count() === 1);

  // Mengetik menandai kotor lewat router — itulah pemicu bar simpan.
  await page.locator("#outlet input").first().fill("Ayu Lestari");
  check("mempelai: mengubah field menandai halaman kotor", await page.evaluate(() => window.__dirty === true));

  await page.evaluate(() => window.__onSave());
  const writes = await page.evaluate(() => window.__writes);
  check("mempelai: menulis ke path bersarang yang benar", writes["couple.bride.name"] === "Ayu Lestari");
  check("mempelai: menyimpan hanya top-level key yang tersentuh",
    JSON.stringify(await page.evaluate(() => window.__saved)) === JSON.stringify(["couple"]));

  /* ── Field wajib kosong memblokir simpan ─────────────────────────────── */
  await page.locator("#outlet input").first().fill("   ");
  const ok = await page.evaluate(async () => await window.__onSave());
  check("mempelai: nama kosong memblokir simpan", ok === false);
  check("mempelai: alasannya disampaikan sebagai error, bukan diam-diam",
    await page.evaluate(() => window.__toast && window.__toast.isErr === true && /Nama lengkap/.test(window.__toast.msg)));

  /* ── Bab Acara: banyak kartu + editor daftar warna ───────────────────── */
  await mountSection("acara");
  const acaraTitles = await page.locator("#outlet .p-card__title").allTextContents();
  check("acara: kartu berurut Tanggal → Akad → Resepsi → Dresscode → Foto",
    JSON.stringify(acaraTitles) === JSON.stringify(
      ["Tanggal & countdown", "Akad", "Resepsi", "Dresscode", "Foto slider event"]));
  check("acara: dresscode punya dua baris warna dari content",
    await page.locator("#outlet input[type=color]").count() === 2);

  await page.locator("#outlet [data-color-add]").click();
  check("acara: tombol + warna menambah baris", await page.locator("#outlet input[type=color]").count() === 3);
  await page.evaluate(() => window.__onSave());
  const acaraWrites = await page.evaluate(() => window.__writes);
  check("acara: warna dresscode tersimpan sebagai array, bukan string",
    Array.isArray(acaraWrites["dresscode.colors"]) && acaraWrites["dresscode.colors"].length === 3);
  check("acara: menyimpan kedua top-level key yang tersentuh",
    JSON.stringify(await page.evaluate(() => window.__saved)) === JSON.stringify(["event", "dresscode"]));

  /* ── Bab Cerita: editor daftar objek ─────────────────────────────────── */
  await mountSection("cerita");
  check("cerita: satu baris babak dari content", await page.locator("#outlet .p-list-row").count() === 1);
  await page.locator("#outlet [data-add]").click();
  check("cerita: tombol tambah menambah babak", await page.locator("#outlet .p-list-row").count() === 2);
  await page.locator('#outlet [data-i="1"][data-k="title"]').fill("Lamaran");
  await page.evaluate(() => window.__onSave());
  const story = (await page.evaluate(() => window.__writes))["loveStory"];
  check("cerita: babak baru punya semua key skema (bukan objek setengah jadi)",
    Array.isArray(story) && story.length === 2 &&
    ["date", "title", "text"].every((k) => k in story[1]));
  check("cerita: isian babak baru tersimpan", story[1].title === "Lamaran");

  /* ── Bab Cover: kartu foto mendahului kartu field ────────────────────── */
  await mountSection("cover");
  const coverTitles = await page.locator("#outlet .p-card__title").allTextContents();
  check("cover: kartu Cover (hanya foto) mendahului kartu Subcover",
    JSON.stringify(coverTitles) === JSON.stringify(["Cover", "Subcover"]));
  check("cover: switch subcover terbaca dari content",
    await page.locator("#outlet .p-switch input").isChecked());
  await page.locator("#outlet .p-switch input").uncheck();
  await page.evaluate(() => window.__onSave());
  check("cover: switch tersimpan sebagai boolean",
    (await page.evaluate(() => window.__writes))["subcover.enabled"] === false);

  /* ── Bab Galeri: kartu tanpa isi tidak dirender kosong ───────────────── */
  await mountSection("galeri");
  const galeriTitles = await page.locator("#outlet .p-card__title").allTextContents();
  check("galeri: tidak ada kartu kosong yang ikut dirender",
    galeriTitles.length === 3 && !galeriTitles.includes(""));
} finally {
  await browser.close();
}

if (failed) { console.error("\nFAIL: renderer bab generik tidak memenuhi kontrak."); process.exit(1); }
console.log("\nPASS: renderer bab generik membangun kartu, mengisi nilai, dan menyimpan ke path yang benar dari skema template.");
