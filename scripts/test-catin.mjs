/** Halaman publik /catin: form kirim data undangan (draft).
 *
 *  A. logika murni  — validasi per langkah, slug, bentuk payload.
 *  B. alur browser  — halaman asli di server lokal; RPC Supabase dicegat dan dicatat.
 *     Mengisi ketujuh langkah, memastikan isian wajib benar-benar menahan, data
 *     tersimpan otomatis (muat ulang tidak menghilangkannya), payload yang terkirim
 *     benar, pesan galat server tampil, dan layar sukses muncul.
 *  C. kabel statis  — rute /catin/ ikut build dan tidak bentrok dengan slug tenant.
 */
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

/* ── A. logika murni ───────────────────────────────────────────────────── */
const root = process.cwd();
const catinJs = await fs.readFile("assets/js/catin.js", "utf8");
const sandbox = { window: { WEDDING_CONFIG: { supabase: {} } }, document: { getElementById: () => null } };
new Function("window", "document", catinJs)(sandbox.window, sandbox.document);
const F = sandbox.window.CatinForm;

check("slugify: huruf kecil, tanpa aksen/simbol", F.slugify("  Étienne & Ánh!! ") === "etienne-anh", F.slugify("  Étienne & Ánh!! "));
const base = () => {
  const s = F.defaultState();
  s.contact = { name: "Julia", wa: "0812-3456-7890", email: "julia@mail.com" };
  s.groom = Object.assign(s.groom, { name: "Kevin Alfaro", nickname: "Kevin" });
  s.bride = Object.assign(s.bride, { name: "Julia Haniva", nickname: "Julia", childOrder: "ketiga" });
  s.date = "2027-11-08";
  s.akad = Object.assign(s.akad, { start: "09:00", end: "10:00", venueName: "Gedung Mayang", address: "Jl. Raya 1" });
  s.resepsi.start = "11:00";
  return s;
};
check("slug saran: panggilan wanita-dan-pria", F.suggestSlug(base()) === "julia-dan-kevin", F.suggestSlug(base()));

const empty = F.defaultState();
check("validasi kenal: kosong → 3 galat", F.validate("kenal", empty).length === 3);
check("validasi kenal: lengkap → lolos", F.validate("kenal", base()).length === 0);
{
  const s = base(); s.contact.email = "bukan-email"; s.contact.wa = "123";
  const paths = F.validate("kenal", s).map((e) => e.path).sort().join(",");
  check("validasi kenal: email & WA salah ditandai", paths === "contact.email,contact.wa", paths);
}
check("validasi pengantin: nama & panggilan wajib (4 galat)", F.validate("pengantin", empty).length === 4);
{
  const s = base(); s.slug = "Julia Dan Kevin";
  check("validasi pengantin: slug berspasi/kapital ditolak", F.validate("pengantin", s).some((e) => e.path === "slug"));
  s.slug = "julia-dan-kevin";
  check("validasi pengantin: slug benar lolos", F.validate("pengantin", s).length === 0);
}
check("validasi acara: kosong → galat tanggal, akad, resepsi", F.validate("acara", empty).length >= 5);
check("validasi acara: lengkap (resepsi satu tempat) → lolos", F.validate("acara", base()).length === 0);
{
  const s = base(); s.resepsi.same = false;
  const p = F.validate("acara", s).map((e) => e.path).join(",");
  check("validasi acara: resepsi beda tempat wajib nama & alamat", /resepsi\.venueName/.test(p) && /resepsi\.address/.test(p), p);
}
{
  const s = base(); s.stories = [{ date: "2022", title: "", text: "x" }];
  check("validasi cerita: terisi sebagian tanpa judul ditolak", F.validate("cerita", s).some((e) => e.path === "stories.0.title"));
  s.stories = [{ date: "", title: "", text: "" }];
  check("validasi cerita: baris kosong sama sekali boleh", F.validate("cerita", s).length === 0);
}
{
  const s = base(); s.gifts = [{ bank: "BCA", number: "", holder: "", owner: "cpp" }];
  check("validasi kasih: rekening setengah isi ditolak (nomor & nama)", F.validate("kasih", s).length === 2);
  s.gifts = [{ bank: "", number: "", holder: "", owner: "cpp" }];
  check("validasi kasih: rekening kosong boleh dilewati", F.validate("kasih", s).length === 0);
}
check("validasi kirim: wajib centang setuju", F.validate("kirim", base()).length === 1);

{
  const s = base();
  s.groom.instagram = "@kevin.a"; s.resepsi.same = true;
  s.gifts = [{ bank: "BCA", number: "123", holder: "Julia", owner: "cpw" }, { bank: "", number: "", holder: "", owner: "cpp" }];
  s.stories = [{ date: "2022", title: "Kenalan", text: "Halo" }, { date: "", title: "", text: "kosong" }];
  s.agree = true;
  const presets = [{ id: "rose", label: "Rose Blush", colors: { bg: "#fff0f0", gold: "#d48a8a" } }];
  s.presetId = "rose";
  const p = F.buildPayload(s, presets);
  check("payload: kontak dirapikan (WA hanya angka, email huruf kecil)", p.contactWa === "081234567890" && p.contactEmail === "julia@mail.com");
  check("payload: slug dari saran bila kosong", p.preferredSlug === "julia-dan-kevin", p.preferredSlug);
  check("payload: instagram tanpa @", p.couple.groom.instagram === "kevin.a", p.couple.groom.instagram);
  check("payload: urutan anak ikut terkirim", p.couple.bride.childOrder === "ketiga");
  check("payload: resepsi satu tempat menyalin tempat akad", p.event.resepsi.venueName === "Gedung Mayang" && p.event.resepsi.sameVenue === true);
  check("payload: rekening kosong dibuang, pemilik dibaca", p.gift.accounts.length === 1 && p.gift.accounts[0].owner === "cpw");
  check("payload: cerita tanpa judul dibuang", p.loveStory.length === 1 && p.loveStory[0].title === "Kenalan");
  check("payload: warna preset ikut (peta kunci→hex)", p.theme && p.theme.presetId === "rose" && p.theme.colors.bg === "#fff0f0");
  check("payload: template klasik & sumber catin", p.template === "klasik" && p.source === "catin");
  s.groom.name = "x".repeat(500);
  check("payload: teks panjang dipotong (maks 80)", F.buildPayload(s, presets).couple.groom.name.length === 80);
}

/* ── B. alur browser ───────────────────────────────────────────────────── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    let st = await fs.stat(f).catch(() => null);
    if (st && st.isDirectory()) { f = path.join(f, "index.html"); st = await fs.stat(f).catch(() => null); }
    if (!st) { res.writeHead(404); return res.end("x"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(await fs.readFile(f));
  } catch (err) { res.writeHead(500); res.end(String(err)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();

async function openForm(rpc) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const calls = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request();
    calls.push({ url: req.url(), body: req.postData() });
    const r = rpc || { status: 200, body: { id: "11111111-2222-3333-4444-555555555555", code: "ABCD1234", editToken: "e".repeat(64) } };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  await page.goto(`${BASE}/catin/`, { waitUntil: "load" });
  return { ctx, page, calls, errors };
}
const fill = (page, p, v) => page.fill(`[data-p="${p}"]`, v);
const next = (page) => page.click("#next");
const stepTitle = (page) => page.locator("#step h2").innerText();

{
  const { ctx, page, calls, errors } = await openForm();
  check("halaman: judul langkah 1 tampil", (await stepTitle(page)) === "Kenalan dulu");
  check("halaman: tombol Kembali tersembunyi di langkah 1", await page.locator("#back").isHidden());

  await next(page);
  check("langkah 1 kosong: tertahan di langkah 1", (await stepTitle(page)) === "Kenalan dulu");
  check("langkah 1 kosong: tiga kolom ditandai merah", (await page.locator(".field.bad").count()) === 3, String(await page.locator(".field.bad").count()));
  check("langkah 1 kosong: ada pesan ringkas", await page.locator("#error").isVisible());

  await fill(page, "contact.name", "Julia");
  await fill(page, "contact.wa", "0812-3456-7890");
  await fill(page, "contact.email", "julia@mail.com");
  await next(page);
  check("langkah 1 lengkap: lanjut ke 'Calon pengantin'", (await stepTitle(page)) === "Calon pengantin");

  await fill(page, "groom.name", "Kevin Alfaro S.Kom."); await fill(page, "groom.nickname", "Kevin");
  await fill(page, "bride.name", "Julia Haniva S.E."); await fill(page, "bride.nickname", "Julia");
  await page.selectOption('[data-p="bride.childOrder"]', "ketiga");
  await fill(page, "groom.father", "H. Dimas"); await fill(page, "groom.mother", "Hj. Ratna");
  check("slug terisi otomatis dari panggilan", (await page.inputValue("#slug")) === "julia-dan-kevin", await page.inputValue("#slug"));
  check("pratinjau link ikut berubah", (await page.locator("#slugPreview").innerText()) === "willcome.my.id/julia-dan-kevin");

  // simpan otomatis: muat ulang tidak menghilangkan isian & langkah
  await page.reload({ waitUntil: "load" });
  check("simpan otomatis: setelah muat ulang masih di langkah 'Calon pengantin'", (await stepTitle(page)) === "Calon pengantin");
  check("simpan otomatis: isian pengantin kembali", (await page.inputValue('[data-p="groom.nickname"]')) === "Kevin" && (await page.inputValue('[data-p="bride.childOrder"]')) === "ketiga");

  await next(page);
  check("langkah 2 lengkap: lanjut ke 'Acara'", (await stepTitle(page)) === "Acara");
  await fill(page, "date", "2027-11-08");
  await fill(page, "akad.start", "09:00"); await fill(page, "akad.end", "10:00");
  await fill(page, "akad.venueName", "Gedung Mayang Arum"); await fill(page, "akad.address", "Jl. Raya Ciwidey Km 27");
  await fill(page, "resepsi.start", "11:00"); await fill(page, "resepsi.end", "14:00");
  check("resepsi 'sama dengan akad' menyembunyikan kolom tempat", (await page.locator('[data-p="resepsi.venueName"]').count()) === 0);
  await page.uncheck('[data-p="resepsi.same"]');
  check("tidak dicentang → kolom tempat resepsi muncul", (await page.locator('[data-p="resepsi.venueName"]').count()) === 1);
  await page.check('[data-p="resepsi.same"]');
  await next(page);
  check("langkah 3 lengkap: lanjut ke 'Cerita kalian'", (await stepTitle(page)) === "Cerita kalian");

  check("cerita: langkah ini ditandai boleh dilewati", /boleh dilewati/i.test(await page.locator(".skip").innerText()));
  check("cerita: terlipat secara bawaan (kolom tak terlihat)", (await page.locator('details[data-opt="cerita"]').getAttribute("open")) === null && await page.locator('[data-act="add-story"]').isHidden());
  check("cerita: tombol Lanjut menonjol selama terlipat", await page.locator("#next.glow").count() === 1);
  await page.click('details[data-opt="cerita"] summary');
  check("cerita: diketuk → terbuka & kolom terlihat", await page.locator('[data-act="add-story"]').isVisible());
  const glowOff = await page.waitForFunction(() => !document.querySelector("#next.glow"), null, { timeout: 2000 }).then(() => true, () => false);
  check("cerita: terbuka → sorotan tombol Lanjut mati (event toggle tiba sesaat kemudian)", glowOff);
  await page.click('[data-act="add-story"]');
  await fill(page, "stories.0.date", "2022"); await fill(page, "stories.0.title", "Awal perkenalan"); await fill(page, "stories.0.text", "Dipertemukan teman.");
  check("cerita: bisa ditambah", (await page.locator(".item").count()) === 1);
  await page.click('[data-act="add-story"]'); await page.click('[data-act="del-story"][data-i="1"]');
  check("cerita: bisa dihapus", (await page.locator(".item").count()) === 1);
  check("cerita: tetap terbuka setelah tampilan dirender ulang (tambah/hapus)", (await page.locator('details[data-opt="cerita"]').getAttribute("open")) !== null);
  await next(page);
  check("langkah 4 → 'Tanda kasih'", (await stepTitle(page)) === "Tanda kasih");

  check("kasih: terlipat secara bawaan", (await page.locator('details[data-opt="kasih"]').getAttribute("open")) === null && await page.locator('[data-p="gifts.0.bank"]').isHidden());
  await page.click('details[data-opt="kasih"] summary');
  await fill(page, "gifts.0.bank", "BCA"); await fill(page, "gifts.0.number", "1234567890"); await fill(page, "gifts.0.holder", "Julia Haniva");
  await page.selectOption('[data-p="gifts.0.owner"]', "cpw");
  await fill(page, "giftAddress.recipient", "Julia"); await fill(page, "giftAddress.phone", "0812"); await fill(page, "giftAddress.detail", "Jl. Mawar 1");
  await next(page);
  check("langkah 5 → 'Tampilan'", (await stepTitle(page)) === "Tampilan");

  check("tampilan: terlipat secara bawaan", (await page.locator('details[data-opt="tampilan"]').getAttribute("open")) === null);
  await page.click('details[data-opt="tampilan"] summary');
  await page.waitForSelector(".sw", { timeout: 8000 });
  const nPresets = await page.locator(".sw").count();
  check("tampilan: 12 paduan warna dari template klasik", nPresets === 12, String(nPresets));
  await page.locator(".sw").nth(1).click();
  check("tampilan: paduan terpilih bertanda", (await page.locator('.sw[aria-pressed="true"]').count()) === 1);
  await fill(page, "photoLink", "https://drive.google.com/drive/folders/abc");
  await fill(page, "song", "Perfect — Ed Sheeran");
  await next(page);
  check("langkah 6 → 'Cek & kirim'", (await stepTitle(page)) === "Cek & kirim");
  check("ringkasan memuat link & nama", /willcome\.my\.id\/julia-dan-kevin/.test(await page.locator(".summary").innerText()));
  check("tombol berubah jadi Kirim", /Kirim/.test(await page.locator("#next").innerText()));

  await next(page);
  check("kirim tanpa centang setuju ditahan", calls.length === 0 && (await page.locator(".field.bad").count()) === 1);
  await page.check('[data-p="agree"]');
  await next(page);
  await page.waitForSelector("#done:not([hidden])", { timeout: 8000 });

  check("sukses: tepat satu panggilan RPC", calls.length === 1, String(calls.length));
  const call = calls[0];
  check("sukses: ke fungsi publik submit_client_draft", /\/rest\/v1\/rpc\/submit_client_draft$/.test(call.url), call.url);
  const body = JSON.parse(call.body);
  const p = body.p_payload;
  check("payload terkirim: perangkat bertoken", typeof body.p_device_token === "string" && body.p_device_token.length > 8);
  check("payload terkirim: kontak & slug", p.contactName === "Julia" && p.contactWa === "081234567890" && p.preferredSlug === "julia-dan-kevin");
  check("payload terkirim: pengantin & urutan anak", p.couple.bride.childOrder === "ketiga" && p.couple.groom.name === "Kevin Alfaro S.Kom.");
  check("payload terkirim: acara", p.event.date === "2027-11-08" && p.event.akad.start === "09:00" && p.event.resepsi.venueName === "Gedung Mayang Arum");
  check("payload terkirim: cerita, rekening, alamat kado", p.loveStory.length === 1 && p.gift.accounts[0].owner === "cpw" && p.gift.address.detail === "Jl. Mawar 1");
  check("payload terkirim: warna preset berisi peta kunci→hex", p.theme && Object.keys(p.theme.colors).length > 3 && Object.values(p.theme.colors).every((v) => /^#[0-9a-f]{6}$/i.test(v)));
  check("payload terkirim: kolom jebakan kosong", p.website === "");
  check("sukses: kode ditampilkan", (await page.locator("#code").innerText()) === "ABCD1234");
  check("sukses: link pribadi memuat kode rahasia 64 karakter", (await page.inputValue("#privLink")) === `${BASE}/catin/?edit=${"e".repeat(64)}`, await page.inputValue("#privLink"));
  check("sukses: kode rahasia tersimpan di browser untuk dibuka lagi",
    JSON.parse(await page.evaluate(() => localStorage.getItem("catin_submitted_v1"))).token === "e".repeat(64));
  check("sukses: formulir disembunyikan", await page.locator("#app").isHidden());
  check("sukses: data tersimpan otomatis dibersihkan", (await page.evaluate(() => localStorage.getItem("catin_draft_v1"))) === null);
  check("tidak ada galat JavaScript selama alur", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

{
  // galat dari server (mis. batas laju) tampil jelas dan formulir tetap ada
  const { ctx, page } = await openForm({ status: 400, body: { code: "P0001", message: "Terlalu banyak pengiriman. Coba lagi nanti ya." } });
  await page.evaluate(() => {
    const F = window.CatinForm; const s = F.defaultState();
    s.contact = { name: "Julia", wa: "08123456789", email: "j@mail.com" };
    s.groom.name = "Kevin"; s.groom.nickname = "Kevin"; s.bride.name = "Julia"; s.bride.nickname = "Julia";
    s.date = "2027-11-08"; s.akad = Object.assign(s.akad, { start: "09:00", venueName: "G", address: "A" }); s.resepsi.start = "11:00";
    localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 6, state: s }));
  });
  await page.reload({ waitUntil: "load" });
  await page.check('[data-p="agree"]'); await next(page);
  await page.waitForSelector("#error:not([hidden])", { timeout: 8000 });
  check("galat server tampil apa adanya", /Terlalu banyak pengiriman/.test(await page.locator("#error").innerText()));
  check("galat server: formulir tetap ada, tidak ke layar sukses", (await page.locator("#done").isHidden()) && (await page.locator("#app").isVisible()));
  check("galat server: tombol bisa dipakai lagi", await page.locator("#next").isEnabled());
  await ctx.close();
}

{
  const { ctx, page, calls } = await openForm();
  await page.evaluate(() => {
    const F = window.CatinForm; const s = F.defaultState();
    s.contact = { name: "Bot", wa: "08123456789", email: "b@mail.com" };
    s.groom.name = "K"; s.groom.nickname = "K"; s.bride.name = "J"; s.bride.nickname = "J";
    s.date = "2027-11-08"; s.akad = Object.assign(s.akad, { start: "09:00", venueName: "G", address: "A" }); s.resepsi.start = "11:00";
    localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 6, state: s }));
  });
  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => { document.getElementById("hp").value = "http://spam.example"; });
  await page.check('[data-p="agree"]'); await next(page);
  await page.waitForSelector("#done:not([hidden])", { timeout: 8000 });
  check("kolom jebakan terisi (bot) ikut terkirim agar ditolak server", JSON.parse(calls[0].body).p_payload.website === "http://spam.example");
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/catin/`, { waitUntil: "load" });
  const vis = await page.evaluate(() => { const r = document.querySelector(".hp").getBoundingClientRect(); return r.right < 0 || r.left < -1000; });
  check("kolom jebakan berada di luar layar", vis);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("390px: halaman tidak scroll ke samping", overflow <= 0, `lebih ${overflow}px`);
  await ctx.close();
}


{
  // jalan pintas: ketiga langkah opsional dilewati hanya dengan menekan Lanjut
  const { ctx, page, calls, errors } = await openForm();
  await page.evaluate(() => {
    const F = window.CatinForm; const s = F.defaultState();
    s.contact = { name: "Julia", wa: "08123456789", email: "j@mail.com" };
    s.groom.name = "Kevin"; s.groom.nickname = "Kevin"; s.bride.name = "Julia"; s.bride.nickname = "Julia";
    s.date = "2027-11-08"; s.akad = Object.assign(s.akad, { start: "09:00", venueName: "G", address: "A" }); s.resepsi.start = "11:00";
    s.gifts = [{ bank: "", number: "", holder: "", owner: "cpp" }];
    localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 3, state: s }));
  });
  await page.reload({ waitUntil: "load" });
  for (const [id, title] of [["cerita", "Cerita kalian"], ["kasih", "Tanda kasih"], ["tampilan", "Tampilan"]]) {
    check(`lewati ${id}: langkah '${title}' tampil dengan catatan & lipatan tertutup`, (await stepTitle(page)) === title && await page.locator(".skip").isVisible() && (await page.locator(`details[data-opt="${id}"]`).getAttribute("open")) === null);
    check(`lewati ${id}: tombol Lanjut menonjol`, await page.locator("#next.glow").count() === 1);
    await next(page);
  }
  check("melewati ketiganya: sampai 'Cek & kirim' tanpa galat", (await stepTitle(page)) === "Cek & kirim" && (await page.locator(".field.bad").count()) === 0);
  check("di langkah wajib/terakhir: tombol tidak menyala", await page.locator("#next.glow").count() === 0);
  await page.check('[data-p="agree"]'); await next(page);
  await page.waitForSelector("#done:not([hidden])", { timeout: 8000 });
  const p = JSON.parse(calls[0].body).p_payload;
  check("terkirim tanpa cerita/rekening/warna (bukan data kosong yang dikarang)", p.loveStory.length === 0 && p.gift.accounts.length === 0 && p.theme === null);
  check("melewati: tidak ada galat JavaScript", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
{
  // terisi sebagian lalu terlipat/terbuka: galat memaksa lipatan terbuka; data yang ada membuka otomatis
  const { ctx, page } = await openForm();
  await page.evaluate(() => {
    const F = window.CatinForm; const s = F.defaultState();
    s.stories = [{ date: "2022", title: "", text: "tanpa judul" }];
    localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 3, state: s }));
  });
  await page.reload({ waitUntil: "load" });
  check("ada isian tersimpan → lipatan terbuka otomatis (tidak menyembunyikan datamu)", (await page.locator('details[data-opt="cerita"]').getAttribute("open")) !== null);
  await page.click('details[data-opt="cerita"] summary');          // tutup
  check("bisa ditutup lagi oleh pengguna", (await page.locator('details[data-opt="cerita"]').getAttribute("open")) === null);
  await next(page);
  check("galat di dalam lipatan tertutup: lipatan dibuka & kolom bermasalah terlihat", (await page.locator('details[data-opt="cerita"]').getAttribute("open")) !== null && (await page.locator(".field.bad").count()) === 1 && await page.locator('[data-p="stories.0.title"]').isVisible());
  await ctx.close();
}

/* ── D. membaca ulang & mengubah draft ──────────────────────────────────── */
const manifest = JSON.parse(await fs.readFile("templates/klasik/template.json", "utf8"));
const realPreset = manifest.editor.presets[2];
const SAMPLE = (() => {
  const st = base();
  st.slug = "julia-dan-kevin"; st.slugTouched = true;
  st.stories = [{ date: "2022", title: "Awal perkenalan", text: "Dipertemukan teman." }];
  st.gifts = [{ bank: "BCA", number: "1234567890", holder: "Julia Haniva", owner: "cpw" }];
  st.giftAddress = { recipient: "Julia", phone: "0812", detail: "Jl. Mawar 1" };
  st.presetId = realPreset.id; st.photoLink = "https://drive.google.com/x"; st.song = "Perfect"; st.notes = "Mohon cepat";
  return F.buildPayload(st, [realPreset]);
})();
const TOKEN = "t".repeat(64);

async function openWith(handler, url = "/catin/", seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const calls = []; const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request();
    const name = new URL(req.url()).pathname.split("/").pop();
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    calls.push({ name, body });
    const r = handler(name, body) || { status: 200, body: {} };
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  if (seed) await page.addInitScript(seed);
  await page.goto(BASE + url, { waitUntil: "load" });
  return { ctx, page, calls, errors };
}
const draftOf = (over = {}) => Object.assign({ code: "ABCD1234", status: "baru", editable: true, createdAt: "2026-10-27T05:00:00Z", updatedAt: "2026-10-27T05:00:00Z", payload: SAMPLE }, over);

{
  // pure: fromPayload ↔ buildPayload, describe, niceDate
  const back = F.buildPayload(F.fromPayload(SAMPLE), [realPreset]);
  check("fromPayload → buildPayload mengembalikan payload yang sama", JSON.stringify(back) === JSON.stringify({ ...SAMPLE, consent: false }), "berbeda");
  const noPresets = F.buildPayload(F.fromPayload(SAMPLE), null);
  check("warna pilihan TIDAK hilang saat preset belum dimuat (themeRaw)", noPresets.theme && noPresets.theme.presetId === realPreset.id && Object.keys(noPresets.theme.colors).length > 3);
  check("fromPayload: payload rusak/kosong tidak melempar", (() => { try { F.fromPayload(null); F.fromPayload("x"); F.fromPayload({ couple: 5, event: [] }); return true; } catch (_) { return false; } })());
  check("fromPayload: urutan anak tak dikenal jatuh ke 'pertama'", F.fromPayload({ couple: { groom: { childOrder: "hack" } } }).groom.childOrder === "pertama");
  check("fromPayload: resepsi satu tempat → kolom tempat resepsi kosong", F.fromPayload(SAMPLE).resepsi.same === true && F.fromPayload(SAMPLE).resepsi.venueName === "");
  check("niceDate: 2027-11-08 → 'Senin, 08 November 2027'", F.niceDate("2027-11-08") === "Senin, 08 November 2027", F.niceDate("2027-11-08"));
  check("niceDate: sampah → ''", F.niceDate("abc") === "" && F.niceDate(null) === "");
  const flat = F.describe(SAMPLE).map((g) => g.t + "|" + g.rows.map((r) => r.join(":")).join(";")).join("\n");
  check("describe: memuat nama, tanggal, akad, rekening, alamat kado, warna", /Kevin Alfaro/.test(flat) && /Senin, 08 November 2027/.test(flat) && /Gedung Mayang/.test(flat) && /BCA 1234567890 a\.n\. Julia Haniva \(wanita\)/.test(flat) && /Jl\. Mawar 1/.test(flat) && new RegExp(realPreset.label).test(flat));
  check("describe: payload kosong tidak melempar", (() => { try { return F.describe(null).length > 0; } catch (_) { return false; } })());
}

{
  // sukses → layar baca bisa dibuka dari layar sukses
  const { ctx, page, calls } = await openWith((name) => name === "submit_client_draft"
    ? { status: 200, body: { id: "x", code: "ZZZZ9999", editToken: "k".repeat(64) } }
    : { status: 200, body: draftOf({ code: "ZZZZ9999" }) },
  "/catin/");
  await page.evaluate((payload) => {
    const F = window.CatinForm; const s = F.fromPayload(payload); s.agree = false;
    localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 6, state: s }));
  }, SAMPLE);
  await page.reload({ waitUntil: "load" });
  await page.check('[data-p="agree"]'); await next(page);
  await page.waitForSelector("#done:not([hidden])", { timeout: 8000 });
  check("layar sukses: tombol 'Lihat data yang kukirim' tersedia", await page.locator("#doneView").isVisible());
  await page.click("#doneView");
  await page.waitForSelector("#view:not([hidden])");
  const got = calls.find((c) => c.name === "get_client_draft");
  check("lihat dari layar sukses: membaca dengan kode rahasia dari pengiriman tadi", got && got.body.p_token === "k".repeat(64), JSON.stringify(got));
  await ctx.close();
}

{
  // buka link pribadi
  const { ctx, page, calls, errors } = await openWith((name) => name === "get_client_draft" ? { status: 200, body: draftOf() } : { status: 200, body: {} }, `/catin/?edit=${TOKEN}`);
  await page.waitForSelector("#view:not([hidden]) .vgroup", { timeout: 8000 });
  check("link pribadi: kode dikirim ke get_client_draft", calls[0].name === "get_client_draft" && calls[0].body.p_token === TOKEN);
  check("link pribadi: kode dibersihkan dari alamat (tidak ikut tersebar)", !/edit=/.test(page.url()), page.url());
  check("link pribadi: formulir & hero tersembunyi", await page.locator("#app").isHidden());
  const viewText = await page.locator("#view").innerText();
  check("layar baca: judul, status, dan kode", /Data yang kamu kirim/i.test(viewText) && /Menunggu kami proses/i.test(viewText) && /ABCD1234/.test(viewText));
  check("layar baca: semua isian tampil (nama, tanggal, tempat, rekening, alamat kado, warna, foto, lagu)",
    ["Kevin Alfaro", "Julia Haniva", "Senin, 08 November 2027", "Gedung Mayang", "BCA 1234567890", "Jl. Mawar 1", realPreset.label, "drive.google.com/x", "Perfect", "Awal perkenalan"].every((x) => viewText.includes(x)),
    ["Kevin Alfaro", "Senin, 08 November 2027", "BCA 1234567890", realPreset.label].filter((x) => !viewText.includes(x)).join(","));
  check("layar baca: tombol Ubah data tersedia (status baru)", await page.locator("#viewEdit").isVisible());
  check("layar baca: tidak ada galat JavaScript", errors.length === 0, errors.join(" | "));

  // ubah
  await page.click("#viewEdit");
  check("mode ubah: formulir terbuka di langkah 1", (await stepTitle(page)) === "Kenalan dulu" && await page.locator("#app").isVisible());
  check("mode ubah: tombol kiri bertuliskan 'Batal'", (await page.locator("#back").innerText()) === "Batal" && await page.locator("#back").isVisible());
  check("mode ubah: isian terisi dari data yang dikirim", (await page.inputValue('[data-p="contact.name"]')) === "Julia" && (await page.inputValue('[data-p="contact.email"]')) === "julia@mail.com");
  await fill(page, "contact.name", "Julia Baru");
  for (let i = 0; i < 6; i++) { await next(page); await page.waitForTimeout(60); }
  check("mode ubah: sampai langkah terakhir dengan data lama yang sudah valid", (await stepTitle(page)) === "Cek & kirim");
  check("mode ubah: tombol terakhir 'Simpan perubahan'", /Simpan perubahan/.test(await page.locator("#next").innerText()));
  await page.check('[data-p="agree"]');
  await next(page);
  await page.waitForSelector("#view:not([hidden]) .ok", { timeout: 8000 });
  const upd = calls.find((c) => c.name === "update_client_draft");
  check("simpan perubahan: memanggil update_client_draft dengan kode rahasia", upd && upd.body.p_token === TOKEN);
  check("simpan perubahan: isian baru terkirim, sisanya tetap", upd.body.p_payload.contactName === "Julia Baru" && upd.body.p_payload.couple.bride.childOrder === "ketiga" && upd.body.p_payload.gift.accounts.length === 1);
  check("simpan perubahan: warna pilihan tetap utuh", upd.body.p_payload.theme && upd.body.p_payload.theme.presetId === realPreset.id && Object.keys(upd.body.p_payload.theme.colors).length > 3);
  check("simpan perubahan: kembali ke layar baca dengan konfirmasi", /Perubahan tersimpan/.test(await page.locator("#view").innerText()));
  check("simpan perubahan: data dibaca ulang dari server", calls.filter((c) => c.name === "get_client_draft").length >= 2);
  check("mengubah: tidak ada galat JavaScript", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

{
  // batal tidak menyentuh konsep formulir baru
  const seed = () => localStorage.setItem("catin_draft_v1", JSON.stringify({ step: 1, state: { contact: { name: "KONSEP BARU", wa: "", email: "" } } }));
  const { ctx, page } = await openWith((name) => name === "get_client_draft" ? { status: 200, body: draftOf() } : { status: 200, body: {} }, `/catin/?edit=${TOKEN}`, seed);
  await page.waitForSelector("#view:not([hidden]) .vgroup");
  await page.click("#viewEdit");
  await fill(page, "contact.name", "DIUBAH TAPI DIBATALKAN");
  await page.click("#back");
  await page.waitForSelector("#view:not([hidden])");
  check("batal: kembali ke layar baca", await page.locator("#app").isHidden());
  const kept = JSON.parse(await page.evaluate(() => localStorage.getItem("catin_draft_v1")));
  check("batal: konsep formulir baru di browser tidak tertimpa", kept.state.contact.name === "KONSEP BARU", JSON.stringify(kept.state.contact));
  await ctx.close();
}

{
  // sudah jadi client → hanya baca
  const { ctx, page } = await openWith((name) => name === "get_client_draft" ? { status: 200, body: draftOf({ status: "dibuat", editable: false }) } : { status: 200, body: {} }, `/catin/?edit=${TOKEN}`);
  await page.waitForSelector("#view:not([hidden]) .vgroup");
  const vt = await page.locator("#view").innerText();
  check("sudah dibuat: lencana 'Undangan sudah dibuat'", /Undangan sudah dibuat/i.test(vt));
  check("sudah dibuat: tombol Ubah data TIDAK ada", await page.locator("#viewEdit").isHidden());
  check("sudah dibuat: ada penjelasan & data tetap bisa dibaca", /tidak bisa diubah dari sini/.test(vt) && /Kevin Alfaro/.test(vt));
  await ctx.close();
}
{
  // kode tidak dikenal
  const { ctx, page } = await openWith((name) => name === "get_client_draft" ? { status: 200, body: null } : { status: 200, body: {} }, `/catin/?edit=${"x".repeat(64)}`);
  await page.waitForSelector("#view:not([hidden])");
  await page.waitForFunction(() => /tidak dikenali/i.test(document.getElementById("viewHead").innerText));
  check("kode tidak dikenal: pesan ramah, tanpa tombol Ubah", await page.locator("#viewEdit").isHidden());
  check("kode tidak dikenal: bisa kirim data baru", await page.locator("#viewNew").isVisible());
  await page.click("#viewNew");
  check("kirim data baru: kembali ke formulir", await page.locator("#app").isVisible() && (await stepTitle(page)) === "Kenalan dulu");
  await ctx.close();
}
{
  // gangguan server saat membaca
  const { ctx, page } = await openWith((name) => name === "get_client_draft" ? { status: 500, body: { message: "Terjadi gangguan" } } : { status: 200, body: {} }, `/catin/?edit=${TOKEN}`);
  await page.waitForFunction(() => /Terjadi gangguan/.test(document.getElementById("viewHead").innerText), null, { timeout: 8000 });
  check("gangguan server saat membaca: pesan tampil, tidak crash", true);
  await ctx.close();
}
{
  // pengingat bagi yang pernah mengirim
  const seed = () => localStorage.setItem("catin_submitted_v1", JSON.stringify({ token: "t".repeat(64), code: "ABCD1234" }));
  const { ctx, page, calls } = await openWith((name) => name === "get_client_draft" ? { status: 200, body: draftOf() } : { status: 200, body: {} }, "/catin/", seed);
  check("pengingat: tampil untuk yang pernah mengirim", await page.locator("#again").isVisible());
  check("pengingat: formulir baru tetap tersedia", await page.locator("#app").isVisible());
  await page.click("#againOpen");
  await page.waitForSelector("#view:not([hidden]) .vgroup");
  check("pengingat: membuka data yang dulu dikirim", calls.some((c) => c.name === "get_client_draft" && c.body.p_token === "t".repeat(64)));
  await ctx.close();
}
{
  // tanpa riwayat: tidak ada pengingat
  const { ctx, page } = await openWith(() => ({ status: 200, body: {} }));
  check("tanpa riwayat: pengingat tersembunyi", await page.locator("#again").isHidden());
  check("halaman membatasi referrer (kode rahasia tak bocor lewat Referer)", await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.content === "no-referrer"));
  await ctx.close();
}

await browser.close();
server.close();

/* ── C. kabel statis ────────────────────────────────────────────────────── */
const [html, build, distTest, fn, sw] = await Promise.all([
  fs.readFile("catin/index.html", "utf8"), fs.readFile("scripts/build-pages-dist.mjs", "utf8"),
  fs.readFile("scripts/test-pages-dist.mjs", "utf8"), fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8"),
  fs.readFile("sw.js", "utf8")
]);
check("catin/index.html: base href '/' (jalur /catin/ memuat aset dari akar)", /<base href="\/">/.test(html));
check("catin/index.html: noindex", /name="robots" content="noindex"/.test(html));
const pdfHead = (await fs.readFile("assets/docs/Undangan-Digital-WillCome.pdf")).subarray(0, 5).toString();
check("catin: ada tombol unduh PDF brosur (hero dan layar sukses)", (html.match(/assets\/docs\/Undangan-Digital-WillCome\.pdf/g) || []).length === 2);
check("brosur PDF ada di situs dan benar-benar PDF", pdfHead === "%PDF-", pdfHead);
check("brosur PDF tidak kegedean (<= 4 MB)", (await fs.stat("assets/docs/Undangan-Digital-WillCome.pdf")).size <= 4 * 1024 * 1024);
check("build: catin/index.html ikut ke dist", /"catin\/index\.html"/.test(build));
check("test dist: catin/index.html diwajibkan", /catin\/index\.html/.test(distTest));
check("provisioning: 'catin' dicadangkan, bukan slug tenant", /slug === "catin"/.test(fn));
check("sw.js: 'catin' bukan slug undangan", /"catin"/.test(sw));

process.exit(failed ? 1 : 0);
