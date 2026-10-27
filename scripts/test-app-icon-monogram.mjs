/** Ikon bawaan undangan = monogram dari huruf depan nama CPP dan CPW.
 *
 * Sumber desain: assets/icons/monogram-template.svg (dua huruf yang diganti).
 *  A. aturan huruf: CPP dulu lalu CPW, nama panggilan lebih dulu dari nama
 *     lengkap, nama bawaan "Mempelai Pria/Wanita" tidak dihitung.
 *  B. render dari SVG sungguhan: empat ukuran, huruf benar-benar berbeda untuk
 *     pasangan berbeda, latar krem dari templat, sudut ikon "any" transparan.
 *  C. syncAuto: kapan ikon otomatis dibuat/diperbarui, dan kapan TIDAK BOLEH
 *     menimpa (unggahan client, huruf yang diatur manual).
 *  D. kabel statis: kait di store.js dan router.js, kolom huruf di Pengaturan.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [iconJs, templateSvg, fontBin] = await Promise.all([
  fs.readFile("assets/js/panel/app-icon.js", "utf8"),
  fs.readFile("assets/icons/monogram-template.svg"),
  fs.readFile("assets/fonts/eb-garamond/eb-garamond-600.woff2")
]);

const ORIGIN = "https://admin.test";
const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: "block" });
const page = await ctx.newPage();
await page.route(`${ORIGIN}/**`, (r) => {
  const p = new URL(r.request().url()).pathname;
  if (p === "/assets/icons/monogram-template.svg") return r.fulfill({ contentType: "image/svg+xml", body: templateSvg });
  if (p === "/assets/fonts/eb-garamond/eb-garamond-600.woff2") return r.fulfill({ contentType: "font/woff2", body: fontBin });
  return r.fulfill({ contentType: "text/html", body: "<!doctype html><body></body>" });
});
await page.goto(`${ORIGIN}/`);
await page.addScriptTag({ content: iconJs });

/* ── A. aturan huruf ────────────────────────────────────────────────────── */
const letters = await page.evaluate(() => {
  const d = (groom, bride) => window.PanelAppIcon.deriveLetters({ couple: { groom, bride } });
  return {
    basic: d({ nickname: "Andi", name: "Andi Pramana" }, { nickname: "Mita", name: "Mita Meliana" }),
    cppFirst: d({ nickname: "Kevin" }, { nickname: "Julia" }),
    nickBeforeName: d({ nickname: "Dimas", name: "Raden Dimas" }, { nickname: "Sari", name: "Putri Sari" }),
    fallbackName: d({ name: "Budi Santoso" }, { name: "Citra Dewi" }),
    lower: d({ nickname: "andi" }, { nickname: "mita" }),
    accent: d({ nickname: "Étienne" }, { nickname: "Ánh" }),
    placeholderGroom: d({ nickname: "Mempelai Pria" }, { nickname: "Mita" }),
    placeholderBride: d({ nickname: "Andi" }, { nickname: "Mempelai Wanita" }),
    missing: d({ nickname: "Andi" }, {}),
    empty: window.PanelAppIcon.deriveLetters({}),
    digitsAndSpace: d({ nickname: "  7up" }, { nickname: "Mita" }),
    first: window.PanelAppIcon.firstLetter("  —(mita)")
  };
});
check("huruf: CPP lebih dulu, lalu CPW (Andi & Mita → AM)", letters.basic === "AM", letters.basic);
check("huruf: urutan mengikuti CPP/CPW, bukan abjad (Kevin & Julia → KJ)", letters.cppFirst === "KJ", letters.cppFirst);
check("huruf: nama panggilan didahulukan dari nama lengkap", letters.nickBeforeName === "DS", letters.nickBeforeName);
check("huruf: tanpa nama panggilan memakai nama lengkap", letters.fallbackName === "BC", letters.fallbackName);
check("huruf: dikapitalkan", letters.lower === "AM", letters.lower);
check("huruf: aksara beraksen tetap terbaca", letters.accent === "ÉÁ", letters.accent);
check("huruf: nama bawaan 'Mempelai Pria' tidak dihitung (→ null, bukan 'MM')", letters.placeholderGroom === null, String(letters.placeholderGroom));
check("huruf: nama bawaan 'Mempelai Wanita' tidak dihitung", letters.placeholderBride === null, String(letters.placeholderBride));
check("huruf: salah satu nama kosong → null", letters.missing === null && letters.empty === null, `${letters.missing} ${letters.empty}`);
check("huruf: spasi/tanda baca di depan dilewati, angka boleh", letters.digitsAndSpace === "7M" && letters.first === "M", `${letters.digitsAndSpace} ${letters.first}`);

/* ── B. render dari SVG ─────────────────────────────────────────────────── */
const r = await page.evaluate(async () => {
  const dims = async (b) => { const x = await createImageBitmap(b); return `${x.width}x${x.height}`; };
  const pixels = async (b) => {
    const x = await createImageBitmap(b); const c = document.createElement("canvas"); c.width = x.width; c.height = x.height;
    const g = c.getContext("2d"); g.drawImage(x, 0, 0); return g.getImageData(0, 0, x.width, x.height).data;
  };
  const px = async (b, fx, fy) => {
    const x = await createImageBitmap(b); const c = document.createElement("canvas"); c.width = x.width; c.height = x.height;
    const g = c.getContext("2d"); g.drawImage(x, 0, 0);
    return Array.from(g.getImageData(Math.floor(fx * (x.width - 1)), Math.floor(fy * (x.height - 1)), 1, 1).data);
  };
  const am = await window.PanelAppIcon.buildMonogramSet("AM");
  const jk = await window.PanelAppIcon.buildMonogramSet("JK");
  const a = await pixels(am["icon-512.png"]), j = await pixels(jk["icon-512.png"]);
  let differing = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - j[i]) + Math.abs(a[i + 1] - j[i + 1]) > 40) differing++;
  const out = {
    names: Object.keys(am),
    dims: [await dims(am["icon-192.png"]), await dims(am["icon-512.png"]), await dims(am["icon-maskable-512.png"]), await dims(am["apple-touch-icon.png"])],
    differing,
    anyCorner: await px(am["icon-512.png"], 0.003, 0.003),
    anyCenterBg: await px(am["icon-512.png"], 0.5, 0.06),
    maskCorner: await px(am["icon-maskable-512.png"], 0.003, 0.003),
    appleCorner: await px(am["apple-touch-icon.png"], 0.003, 0.003)
  };
  const bad = async (v) => { try { await window.PanelAppIcon.buildMonogramSet(v); return "ok"; } catch (e) { return e.message; } };
  out.badShort = await bad("A"); out.badLong = await bad("ABC"); out.badSymbol = await bad("?!"); out.badEmpty = await bad("");
  return out;
});
check("monogram: empat berkas dengan nama yang dibaca halaman tamu",
  JSON.stringify(r.names) === JSON.stringify(["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]), r.names.join(","));
check("monogram: ukuran 192, 512, 512 (maskable), 180 (iOS)", r.dims.join(" ") === "192x192 512x512 512x512 180x180", r.dims.join(" "));
check("monogram: huruf benar-benar tergambar (AM berbeda dari JK ratusan piksel)", r.differing > 800, String(r.differing));
check("monogram 'any': sudut luar transparan (kotak membulat dari templat)", r.anyCorner[3] === 0, JSON.stringify(r.anyCorner));
check("monogram 'any': latar krem dari templat (#FBF3E6)", r.anyCenterBg[0] === 251 && r.anyCenterBg[1] === 243 && r.anyCenterBg[2] === 230, JSON.stringify(r.anyCenterBg));
check("monogram maskable: sudut penuh krem (aman dipotong lingkaran)", r.maskCorner[3] === 255 && r.maskCorner[0] === 251 && r.maskCorner[2] === 230, JSON.stringify(r.maskCorner));
check("monogram iOS: sudut penuh krem, bukan hitam", r.appleCorner[3] === 255 && r.appleCorner[0] === 251, JSON.stringify(r.appleCorner));
check("monogram: tolak 1 huruf", /satu huruf/i.test(r.badShort), r.badShort);
check("monogram: tolak 3 huruf", /satu huruf/i.test(r.badLong), r.badLong);
check("monogram: tolak simbol", /satu huruf/i.test(r.badSymbol), r.badSymbol);
check("monogram: tolak kosong", /satu huruf/i.test(r.badEmpty), r.badEmpty);

/* ── C. syncAuto ────────────────────────────────────────────────────────── */
async function runSync(content) {
  return page.evaluate(async (content) => {
    const uploads = [];
    const saves = [];
    const sets = [];
    window.AdminAPI = {
      tenant: { slug: "julia-dan-kevin", invitationId: "inv-1" },
      sb: { storage: { from: () => ({ upload: async (path) => { uploads.push(path); return { error: null }; }, remove: async () => ({ error: null }) }) } }
    };
    window.PanelStore = {
      getContent: () => content,
      set: (k, v) => { sets.push([k, v]); content[k] = v; },
      save: async (keys) => { saves.push(keys); return { error: null }; }
    };
    await window.PanelAppIcon.syncAuto();
    return { uploads, saves, sets };
  }, content);
}
const names = (g, b) => ({ couple: { groom: { nickname: g }, bride: { nickname: b } } });

{
  const out = await runSync({ ...names("Andi", "Mita") });
  check("syncAuto: belum ada ikon + nama terisi → 4 berkas diunggah ke <slug>/icons/",
    out.uploads.length === 4 && out.uploads.every((u) => u.startsWith("julia-dan-kevin/icons/")), out.uploads.join(","));
  const ai = out.sets.find(([k]) => k === "appIcon");
  check("syncAuto: appIcon disimpan {source:auto, letters:AM, custom:false}",
    !!ai && ai[1].source === "auto" && ai[1].letters === "AM" && ai[1].custom === false && ai[1].path === "julia-dan-kevin/icons" && !!ai[1].version, JSON.stringify(ai));
  check("syncAuto: disimpan lewat satu pintu hanya untuk key appIcon", JSON.stringify(out.saves) === JSON.stringify([["appIcon"]]), JSON.stringify(out.saves));
}
{
  const out = await runSync({ ...names("Andi", "Mita"), appIcon: { path: "julia-dan-kevin/icons", version: 1, source: "auto", letters: "AM", custom: false } });
  check("syncAuto: huruf sudah sesuai → tidak mengunggah lagi", out.uploads.length === 0 && out.saves.length === 0, out.uploads.join(","));
}
{
  const out = await runSync({ ...names("Budi", "Sari"), appIcon: { path: "julia-dan-kevin/icons", version: 1, source: "auto", letters: "AM", custom: false } });
  const ai = out.sets.find(([k]) => k === "appIcon");
  check("syncAuto: nama berubah (Andi&Mita → Budi&Sari) → ikon dibuat ulang BS", out.uploads.length === 4 && ai && ai[1].letters === "BS", JSON.stringify(ai));
}
{
  const out = await runSync({ ...names("Budi", "Sari"), appIcon: { path: "julia-dan-kevin/icons", version: 1, source: "upload" } });
  check("syncAuto: ikon UNGGAHAN client tidak pernah ditimpa", out.uploads.length === 0 && out.saves.length === 0);
}
{
  const out = await runSync({ ...names("Budi", "Sari"), appIcon: { path: "julia-dan-kevin/icons", version: 1, source: "auto", letters: "XY", custom: true } });
  check("syncAuto: huruf yang diatur manual (custom) tidak ditimpa", out.uploads.length === 0 && out.saves.length === 0);
}
{
  const out = await runSync({ ...names("Mempelai Pria", "Mempelai Wanita") });
  check("syncAuto: nama masih bawaan → tidak membuat ikon 'MM'", out.uploads.length === 0 && out.saves.length === 0);
}
{
  const out = await runSync({ ...names("Andi", "") });
  check("syncAuto: salah satu nama kosong → tidak membuat apa-apa", out.uploads.length === 0 && out.saves.length === 0);
}
{
  // gagal unggah tidak boleh meledak maupun menyimpan appIcon setengah jadi
  const out = await page.evaluate(async () => {
    const sets = []; const saves = [];
    window.AdminAPI = { tenant: { slug: "x", invitationId: "i" }, sb: { storage: { from: () => ({ upload: async () => ({ error: { message: "denied" } }) }) } } };
    window.PanelStore = { getContent: () => ({ couple: { groom: { nickname: "Andi" }, bride: { nickname: "Mita" } } }), set: (k, v) => sets.push(k), save: async (k) => { saves.push(k); return { error: null }; } };
    let threw = false;
    try { await window.PanelAppIcon.syncAuto(); } catch (_) { threw = true; }
    return { threw, sets, saves };
  });
  check("syncAuto: unggah gagal → senyap, appIcon tidak disimpan setengah jadi", !out.threw && out.sets.length === 0 && out.saves.length === 0, JSON.stringify(out));
}

await ctx.close();
await browser.close();

/* ── D. kabel statis ────────────────────────────────────────────────────── */
const [store, router, pengaturan] = await Promise.all([
  fs.readFile("assets/js/panel/store.js", "utf8"),
  fs.readFile("assets/js/panel/router.js", "utf8"),
  fs.readFile("assets/js/panel/pages/pengaturan.js", "utf8")
]);
check("store.js: ikon otomatis disinkronkan setelah data mempelai (couple) tersimpan",
  /keys\.includes\("couple"\)[^;]*PanelAppIcon\.syncAuto\(\)/.test(store));
check("router.js: ikon otomatis disinkronkan saat panel dibuka", /PanelAppIcon\.syncAuto\(\)/.test(router));
check("Pengaturan: kolom huruf CPP dan CPW", /id="st-icon-l1"/.test(pengaturan) && /id="st-icon-l2"/.test(pengaturan));
check("Pengaturan: huruf diubah → monogram dibangun dari templat SVG", /buildMonogramSet\(a \+ b\)/.test(pengaturan));
check("Pengaturan: tombol 'Kembali ke otomatis'", /id="st-icon-reset"/.test(pengaturan));
check("templat SVG ada di repo (sumber desain yang bisa diedit)", templateSvg.toString().includes("<text"));

process.exit(failed ? 1 : 0);
