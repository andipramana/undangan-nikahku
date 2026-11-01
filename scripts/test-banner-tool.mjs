/** Alat banner lokal (scripts/banner-tool.mjs): tiap client punya gambar & halaman sendiri,
 *  menyimpan banner satu client TIDAK menyentuh client lain, input buruk ditolak.
 *  Berjalan di folder sementara tanpa git. */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "banner-"));
await fs.mkdir(path.join(tmp, "scripts"), { recursive: true });
await fs.copyFile("index.html", path.join(tmp, "index.html"));
await fs.writeFile(path.join(tmp, "scripts/share-pages.json"), "[]\n");
process.env.BANNER_ROOT = tmp;
process.env.BANNER_NO_GIT = "1";
const { saveBanner, createServer } = await import("./banner-tool.mjs");

let failed = false;
const check = (label, pass, detail) => {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
};
const jpeg = "data:image/jpeg;base64," + (await fs.readFile("assets/img/social/og-uput-dan-dany-2.jpg")).toString("base64");
const rejects = async (input) => { try { await saveBanner(input); return false; } catch { return true; } };
const exists = (p) => fs.access(path.join(tmp, p)).then(() => true, () => false);
const read = (p) => fs.readFile(path.join(tmp, p), "utf8");

const a1 = await saveBanner({ slug: "uput", title: "Undangan Uput", description: "Desc A", image: jpeg });
const b1 = await saveBanner({ slug: "uput-dan", title: "Undangan Uput & Dan", description: "Desc B", image: jpeg });
check("gambar tiap client berbeda & unik", a1.file !== b1.file && /og-uput-[a-z0-9]+\.jpg$/.test(a1.file) && /og-uput-dan-[a-z0-9]+\.jpg$/.test(b1.file));
check("halaman & gambar kedua client ada", await exists("uput/index.html") && await exists("uput-dan/index.html") && await exists(a1.file) && await exists(b1.file));
check("halaman menunjuk gambar miliknya sendiri", (await read("uput/index.html")).includes(a1.file) && (await read("uput-dan/index.html")).includes(b1.file));
check("slug terdaftar di share-pages.json", JSON.stringify(JSON.parse(await read("scripts/share-pages.json"))) === JSON.stringify(["uput", "uput-dan"]));

const bPage = await read("uput-dan/index.html");
await new Promise((r) => setTimeout(r, 5));
const a2 = await saveBanner({ slug: "uput", title: "Undangan Uput 2", description: "Desc A2", image: jpeg });
check("simpan ulang memakai nama gambar baru", a2.file !== a1.file && await exists(a2.file));
check("gambar lama client yang sama dihapus", !(await exists(a1.file)));
check("client lain TIDAK tersentuh (gambar & halaman)", await exists(b1.file) && (await read("uput-dan/index.html")) === bPage);
check("halaman client yang diubah memakai judul & gambar baru", (await read("uput/index.html")).includes(a2.file) && (await read("uput/index.html")).includes("Undangan Uput 2"));
check("slug tidak terdaftar dua kali", JSON.parse(await read("scripts/share-pages.json")).length === 2);

check("slug cadangan ditolak", await rejects({ slug: "root", title: "x", description: "y", image: jpeg }));
check("slug tidak valid ditolak", await rejects({ slug: "../evil", title: "x", description: "y", image: jpeg }));
check("bukan JPEG ditolak", await rejects({ slug: "baru", title: "x", description: "y", image: "data:image/jpeg;base64," + Buffer.from("bukan gambar".repeat(200)).toString("base64") }));
check("judul kosong ditolak", await rejects({ slug: "baru", title: "", description: "y", image: jpeg }));
check("ditolak tidak meninggalkan halaman", !(await exists("baru/index.html")));

const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const home = await (await fetch(base + "/")).text();
check("GET / menyajikan halaman alat", home.includes("Banner WhatsApp") && home.includes("1200"));
const pages = await (await fetch(base + "/api/pages")).json();
check("/api/pages memuat judul & gambar tiap client", pages.length === 2 && pages.find((p) => p.slug === "uput")?.title === "Undangan Uput 2" && pages.find((p) => p.slug === "uput-dan")?.image === path.basename(b1.file));
const bad = await fetch(base + "/api/save", { method: "POST", body: JSON.stringify({ slug: "x" }) });
check("POST tidak valid → 400 dengan pesan", bad.status === 400 && !!(await bad.json()).error);
/* ── UI sungguhan di browser: unggah → crop → simpan ── */
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
await page.goto(base + "/");
check("tombol simpan nonaktif sebelum ada foto", await page.locator("#save").isDisabled());
await page.setInputFiles("#file", "assets/img/social/og-uput-dan-dany-2.jpg");
await page.waitForSelector("#stage canvas");
await page.fill("#slug", "klien-dan-uji"); await page.locator("#slug").dispatchEvent("change");
check("judul terisi otomatis dari slug", (await page.inputValue("#title")) === "Undangan Pernikahan Klien & Uji", await page.inputValue("#title"));
await page.fill("#title", "Undangan Klien Uji"); await page.fill("#desc", "Deskripsi uji");
check("tombol simpan aktif setelah foto + data lengkap", await page.locator("#save").isEnabled());
const box = await page.locator("#stage").boundingBox();
const before = await page.evaluate(() => document.getElementById("pimg").src.length);
await page.locator("#zoom").fill("2");
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 - 30, { steps: 5 }); await page.mouse.up();
check("zoom & geser mengubah pratinjau", (await page.evaluate(() => document.getElementById("pimg").src.length)) !== before);
await page.click("#save");
await page.waitForFunction(() => /Selesai|Gagal|valid/.test(document.getElementById("msg").textContent), null, { timeout: 15000 });
check("simpan dari UI berhasil", /Selesai/.test(await page.textContent("#msg")), await page.textContent("#msg"));
const uiPage = await read("klien-dan-uji/index.html").catch(() => "");
const uiImg = /og-klien-dan-uji-[a-z0-9]+\.jpg/.exec(uiPage)?.[0];
check("UI menulis halaman + gambar 1200x630", !!uiImg && (await exists("assets/img/social/" + uiImg)));
const buf = await fs.readFile(path.join(tmp, "assets/img/social", uiImg || "x"));
let w = 0, h = 0; for (let i = 2; i < buf.length - 9;) { if (buf[i] !== 0xff) { i++; continue; } const t = buf[i + 1]; if (t >= 0xc0 && t <= 0xc3) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; } i += 2 + buf.readUInt16BE(i + 2); }
check("ukuran gambar hasil crop 1200x630", w === 1200 && h === 630, `${w}x${h}`);
await browser.close();

server.close();
await fs.rm(tmp, { recursive: true, force: true });

if (failed) { console.error("\nFAIL: alat banner"); process.exit(1); }
console.log("\nSemua pemeriksaan alat banner LULUS.");
