/** Font yang dipakai CSS template harus benar-benar tersedia.
 *
 * Saat font dipindah dari Google Fonts ke self-host, hanya sebagian yang ikut
 * disalin: Italianno (tulisan "the" di Save The Date) hilang dan jatuh ke font
 * `cursive` bawaan sistem; Alegreya Sans dan Cormorant Garamond juga hilang;
 * Poppins 600/700 tidak ada sehingga teks tebal jadi faux-bold. Tidak ada
 * error di mana pun — tampilannya saja diam-diam berubah. Test ini mengunci:
 *   1. tiap keluarga font BERNAMA yang dipakai CSS punya @font-face,
 *   2. berkas woff2 yang ditunjuk @font-face ada di disk,
 *   3. tiap bobot yang diminta rule berfont-eksplisit punya @font-face
 *      (variable font dengan rentang bobot dihitung mencakup rentangnya).
 *
 * Font sistem (Georgia, Segoe UI, ...) dan keluarga generik dikecualikan.
 */
import fs from "node:fs/promises";
import path from "node:path";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const SYSTEM = new Set(["georgia", "segoe ui", "arial", "helvetica", "times new roman", "system-ui", "-apple-system", "inter var"]);
const GENERIC = new Set(["serif", "sans-serif", "cursive", "monospace", "fantasy", "inherit", "initial", "unset"]);

/** Bobot yang SEJAK AWAL memang faux-bold (bukan regresi): URL Google Fonts asli
 * klasik hanya memuat Cormorant Garamond 400, tapi CSS meminta 500/600. Menambah
 * bobot aslinya akan mengubah tampilan undangan yang sudah tayang, jadi sengaja
 * dibiarkan. Format: "<template>/<family>" → bobot yang dikecualikan. */
const ORIGINALLY_SYNTHESIZED = { "klasik/cormorant garamond": [500, 600] };

const folders = (await fs.readdir("templates", { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);

for (const id of folders) {
  const cssPath = path.join("templates", id, "style.css");
  const css = await fs.readFile(cssPath, "utf8");

  // @font-face: family → daftar { weightMin, weightMax, files }
  const faces = new Map();
  const faceRe = /@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = faceRe.exec(css))) {
    const body = m[1];
    const fam = (body.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1];
    if (!fam) continue;
    const w = (body.match(/font-weight:\s*(\d+)(?:\s+(\d+))?/) || []);
    const lo = Number(w[1] || 400), hi = Number(w[2] || w[1] || 400);
    const urls = [...body.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((u) => u[1]);
    if (!faces.has(fam.toLowerCase())) faces.set(fam.toLowerCase(), []);
    faces.get(fam.toLowerCase()).push({ lo, hi, urls });
  }

  const rest = css.replace(/@font-face\s*\{[^}]*\}/g, "");

  // 1. keluarga bernama yang dipakai di CSS
  const used = new Set();
  for (const f of rest.matchAll(/font-family:\s*([^;}]+)/g)) {
    for (const part of f[1].split(",")) {
      const mm = part.trim().match(/^['"]([^'"]+)['"]$/);
      if (!mm) continue;
      const name = mm[1].toLowerCase();
      if (SYSTEM.has(name) || GENERIC.has(name)) continue;
      used.add(name);
    }
  }
  // Keluarga yang dideklarasikan lewat variabel CSS di :root juga dihitung.
  for (const f of rest.matchAll(/--font-[a-z-]+:\s*([^;}]+)/g)) {
    for (const part of f[1].split(",")) {
      const mm = part.trim().match(/^['"]([^'"]+)['"]$/);
      if (!mm) continue;
      const name = mm[1].toLowerCase();
      if (SYSTEM.has(name) || GENERIC.has(name)) continue;
      used.add(name);
    }
  }

  for (const fam of used) {
    check(`${id}: font "${fam}" punya @font-face`, faces.has(fam));
  }

  // 2. berkas ada di disk
  for (const [fam, list] of faces) {
    for (const face of list) {
      for (const u of face.urls) {
        if (/^(https?:|data:)/.test(u)) continue;
        const file = path.normalize(path.join("templates", id, u));
        let ok = true;
        try { await fs.access(file); } catch { ok = false; }
        check(`${id}: berkas font ${fam} ${face.lo} ada (${path.basename(u)})`, ok, file);
      }
    }
  }

  // 3. bobot yang diminta di rule yang menyebut keluarga bernama secara eksplisit
  const ruleRe = /\{([^{}]*)\}/g;
  const needed = new Map(); // family → Set(weight)
  while ((m = ruleRe.exec(rest))) {
    const body = m[1];
    const w = (body.match(/font-weight:\s*(\d+)/) || [])[1];
    const fam = (body.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1];
    if (!w || !fam) continue;
    const key = fam.toLowerCase();
    if (!needed.has(key)) needed.set(key, new Set());
    needed.get(key).add(Number(w));
  }
  for (const [fam, weights] of needed) {
    const list = faces.get(fam);
    if (!list) continue; // sudah dilaporkan di langkah 1
    for (const w of weights) {
      const covered = list.some((f) => w >= f.lo && w <= f.hi)
        || (ORIGINALLY_SYNTHESIZED[`${id}/${fam}`] || []).includes(w);
      // font display satu-bobot (mis. Italianno 400) memang tak punya yang lain:
      // faux-bold sengaja tidak dihitung salah bila template tak meminta bobot itu.
      check(`${id}: "${fam}" bobot ${w} tersedia`, covered, `tersedia: ${list.map((f) => f.lo + (f.hi !== f.lo ? "-" + f.hi : "")).join(", ")}`);
    }
  }
}

process.exit(failed ? 1 : 0);
