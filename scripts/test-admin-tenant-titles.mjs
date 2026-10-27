/** Halaman admin tidak boleh membawa nama pasangan tenant lain.
 *
 * <title> admin.html dulu di-hardcode "Admin — Mita & Andi", jadi admin client
 * /julia-dan-kevin/ melihat nama pasangan orang lain di tab (dan tiap menu
 * berjudul sama, sehingga tab berdampingan tak terbedakan). Nama yang tampil
 * sebelum data dimuat kini berasal dari slug (core.js tenantName), dan judul
 * per menu diatur router (setDocTitle).
 */
import fs from "node:fs/promises";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [admin, adminQr, core, router] = await Promise.all([
  fs.readFile("admin.html", "utf8"),
  fs.readFile("admin-qr.html", "utf8"),
  fs.readFile("assets/js/panel/core.js", "utf8"),
  fs.readFile("assets/js/panel/router.js", "utf8")
]);

for (const [name, html] of [["admin.html", admin], ["admin-qr.html", adminQr]]) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  check(`${name}: <title> tidak memuat nama pasangan`, !/Mita|Andi/i.test(title), title);
  check(`${name}: teks login tidak memuat nama pasangan`, !/class="p-hint"[^>]*>[^<]*(Mita|Andi)/i.test(html));
  check(`${name}: tidak ada "Mita"/"Andi" hardcode di markup`, !/Mita|Andi/.test(html.replace(/<!--[\s\S]*?-->/g, "")));
  check(`${name}: judul dasar lewat data-title-base`, /<html[^>]*data-title-base="[^"]+"/.test(html));
}

check("core.js: tenantName() diturunkan dari slug dan dibagikan lewat AdminAPI",
  /function tenantName\(/.test(core) && /AdminAPI = \{[\s\S]*?\btenantName\b/.test(core));
check('core.js: "dan" pada slug jadi "&"', /w === "dan" \? "&"/.test(core));
check("router.js: judul tab diatur per menu (setDocTitle dipanggil saat mount)",
  /function setDocTitle\(/.test(router) && (router.match(/setDocTitle\(def\)/g) || []).length >= 2);
check("router.js: judul memuat judul menu", /\[def\.title, name\]/.test(router));

process.exit(failed ? 1 : 0);
