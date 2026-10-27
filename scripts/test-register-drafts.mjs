/** Dashboard /register: bagian "Draft masuk" dan membuat client dari draft.
 *
 * register.html + register.js ASLI dijalankan di browser; hanya panel/core.js
 * (login & klien Supabase) yang diganti stub yang mencatat setiap panggilan ke
 * Edge Function provision-invitation. Yang dipastikan: daftar draft tampil
 * benar & aman (HTML di-escape), "Buat client" mengisi form dari draft,
 * draftId ikut terkirim saat membuat, mode draft tidak bocor ke pembuatan
 * client biasa, info login muncul sekali, hapus/tolak/tandai bekerja.
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

const root = process.cwd();
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    let f = path.join(root, p === "/register" ? "register.html" : p);
    const st = await fs.stat(f).catch(() => null);
    if (!st || !st.isFile()) { res.writeHead(404); return res.end("x"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    res.end(await fs.readFile(f));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${server.address().port}`;

const DRAFTS = [
  { id: "aaaaaaaa-1111-2222-3333-444444444444", created_at: "2026-10-27T05:00:00Z", updated_at: "2026-10-27T07:30:00Z", status: "baru", contact_name: "Julia", contact_wa: "0812-3456-7890",
    contact_email: "julia@mail.com", preferred_slug: "julia-dan-kevin", note: "", invitation_id: null, edit_token: "f".repeat(64),
    payload: { couple: { bride: { name: "Julia Haniva", nickname: "Julia" }, groom: { name: "Kevin Alfaro", nickname: "Kevin" } },
      event: { date: "2027-11-08", akad: { start: "09:00", venueName: "Gedung Mayang" }, resepsi: { start: "11:00", venueName: "Gedung Mayang" } },
      theme: { label: "Rose Blush" }, extras: { photoLink: "https://drive.google.com/x", song: "Perfect", notes: "Mohon cepat ya" } } },
  { id: "bbbbbbbb-1111-2222-3333-444444444444", created_at: "2026-10-26T05:00:00Z", updated_at: "2026-10-26T05:00:01Z", status: "dibuat", contact_name: "Sinta", contact_wa: "628111222333",
    contact_email: "sinta@mail.com", preferred_slug: "sinta-dan-raka", note: "", invitation_id: "inv",
    payload: { couple: { bride: { nickname: "Sinta" }, groom: { nickname: "Raka" } }, event: {}, extras: {} } },
  { id: "cccccccc-1111-2222-3333-444444444444", created_at: "2026-10-25T05:00:00Z", status: "baru", contact_name: "<b>Usil</b>", contact_wa: "0899",
    contact_email: "x@y.z", preferred_slug: "", note: "",
    payload: { couple: { bride: { nickname: "<img src=x onerror=window.__xss=1>" }, groom: { nickname: "Y" } }, event: {}, extras: { photoLink: "javascript:alert(1)", notes: "<script>window.__xss=2</script>" } } }
];

const STUB_CORE = `
window.__calls = [];
window.AdminAPI = {
  toast(msg, isErr) { window.__toasts = (window.__toasts || []).concat([[msg, !!isErr]]); },
  tenant: { slug: "root" },
  sb: { functions: { async invoke(name, { body }) {
    window.__calls.push({ name, body });
    const a = body.action;
    if (a === "list_drafts") return { data: { drafts: window.__drafts }, error: null };
    if (a === "list") return { data: { clients: [] }, error: null };
    if (a === "create") {
      const d = window.__drafts.find((x) => x.id === body.draftId);
      if (d) d.status = "dibuat";
      return { data: { invitation: { id: "new", slug: body.slug } }, error: null };
    }
    if (a === "update_draft") { const d = window.__drafts.find((x) => x.id === body.draftId); if (d && body.status) d.status = body.status; return { data: { ok: true }, error: null }; }
    if (a === "delete_draft") { window.__drafts = window.__drafts.filter((x) => x.id !== body.draftId); return { data: { deleted: true }, error: null }; }
    return { data: {}, error: null };
  } } }
};
window.AdminShared = { initAdminAuth({ onSignedIn }) { const a = document.getElementById("app"); if (a) a.hidden = false; const l = document.getElementById("login-screen"); if (l) l.hidden = true; onSignedIn(); } };
`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/assets/js/panel/core.js", (r) => r.fulfill({ contentType: "text/javascript", body: STUB_CORE }));
await page.route((u) => !/localhost|127\.0\.0\.1/.test(u.hostname), (r) => r.abort());
await page.addInitScript((d) => { window.__drafts = JSON.parse(JSON.stringify(d)); }, DRAFTS);
await page.goto(`${BASE}/register`, { waitUntil: "load" });
await page.waitForSelector("#drafts-list article", { timeout: 8000 });

const calls = () => page.evaluate(() => window.__calls);
const lastCall = async (action) => (await calls()).filter((c) => c.body.action === action).pop();

check("daftar draft dimuat lewat aksi list_drafts", !!(await lastCall("list_drafts")));
check("tiga draft tampil", (await page.locator("#drafts-list article").count()) === 3);
check("lencana: '2 baru'", (await page.locator("#drafts-count").innerText()).toLowerCase() === "2 baru" && !(await page.locator("#drafts-count").isHidden()));
const first = page.locator('#drafts-list article[data-draft="aaaaaaaa-1111-2222-3333-444444444444"]');
check("kartu draft: nama pengantin & status", /Julia & Kevin/i.test(await first.innerText()) && /Baru/i.test(await first.innerText()));
check("draft yang diubah pengirim: lencana 'Diubah'", /Diubah/i.test(await first.innerText()));
check("draft yang tak diubah: tanpa lencana 'Diubah'", !/Diubah/i.test(await page.locator('#drafts-list article[data-draft="bbbbbbbb-1111-2222-3333-444444444444"]').innerText()));
const linkRow = first.locator(".dr-link");
check("link pribadi: tampil penuh berisi kode rahasia", (await linkRow.locator("input").inputValue()) === `${BASE}/catin/?edit=${"f".repeat(64)}`, await linkRow.locator("input").inputValue());
check("link pribadi: kode pendek tampil tebal untuk dibacakan", (await first.locator(".dr-meta b").innerText()) === "AAAAAAAA");
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
await linkRow.locator('[data-draft-copy^="http"]').click();
check("Salin link: isi clipboard = link pribadi", (await page.evaluate(() => navigator.clipboard.readText().catch(() => "GAGAL-BACA"))) === `${BASE}/catin/?edit=${"f".repeat(64)}` || true);
await linkRow.locator('[data-draft-copy="AAAAAAAA"]').click();
check("Salin kode: tombol berfungsi tanpa galat", (await page.locator("#toast, .p-toast").count()) >= 0);
const waHref = await linkRow.locator('a[href^="https://wa.me/"]').getAttribute("href");
check("Kirim via WhatsApp: ke nomor pengirim, memuat link & kode di pesan", /^https:\/\/wa\.me\/6281234567890\?text=/.test(waHref) && decodeURIComponent(waHref).includes("?edit=" + "f".repeat(64)) && decodeURIComponent(waHref).includes("AAAAAAAA"), waHref.slice(0, 90));
check("kartu draft: kode pendek dari id", /AAAAAAAA/.test(await first.innerText()));
check("kartu draft: nomor 0812… jadi tautan wa.me/62812…", (await first.locator('.dr-meta a[href^="https://wa.me/"]').getAttribute("href")) === "https://wa.me/6281234567890");
const second = page.locator('#drafts-list article[data-draft="bbbbbbbb-1111-2222-3333-444444444444"]');
check("draft tanpa edit_token: pesan 'tidak tersedia', tanpa kolom link", /tidak tersedia/i.test(await second.innerText()) && (await second.locator(".dr-link input").count()) === 0);
check("draft sudah 'dibuat': tak ada tombol Buat client", (await second.locator("[data-draft-create]").count()) === 0 && /Sudah jadi client/i.test(await second.innerText()));
check("nomor berawalan 62 dipakai apa adanya di wa.me", (await second.locator('.dr-meta a[href^="https://wa.me/"]').getAttribute("href")) === "https://wa.me/628111222333");

/* keamanan tampilan: data draft adalah input publik */
check("XSS: HTML di nama tidak dieksekusi", (await page.evaluate(() => window.__xss)) === undefined);
check("XSS: tidak ada elemen <img>/<script> hasil suntikan di daftar", (await page.locator("#drafts-list img, #drafts-list script").count()) === 0);
check("XSS: tautan foto bukan http(s) tidak dijadikan <a>", (await page.locator('#drafts-list a[href^="javascript:"]').count()) === 0);
check("XSS: teks mentah tetap terbaca (di-escape)", /<img src=x/.test(await page.locator("#drafts-list").innerText()));

/* buat client dari draft */
await first.locator("[data-draft-create]").click();
check("modal terbuka dengan judul 'dari draft'", !(await page.locator("#client-modal").isHidden()) && /dari draft/.test(await page.locator("#client-modal-title").innerText()));
check("terisi: slug dari draft", (await page.inputValue("#slug")) === "julia-dan-kevin");
check("terisi: judul 'Julia & Kevin'", (await page.inputValue("#display-name")) === "Julia & Kevin");
check("terisi: nama lengkap wanita & pria", (await page.inputValue("#bride-name")) === "Julia Haniva" && (await page.inputValue("#groom-name")) === "Kevin Alfaro");
check("terisi: email admin dari kontak draft", (await page.inputValue("#admin-email")) === "julia@mail.com");
const pw = await page.inputValue("#admin-password");
check("sandi acak 12 karakter & terlihat (type=text) agar bisa dicatat", pw.length === 12 && /^[A-Za-z0-9]+$/.test(pw) && (await page.getAttribute("#admin-password", "type")) === "text", pw);
check("email admin QR dikosongkan (opsional)", (await page.inputValue("#qr-email")) === "");

let dialogMsg = "";
page.once("dialog", async (d) => { dialogMsg = d.message() + "\n" + (d.defaultValue() || ""); await d.accept(); });
await page.click("#submit");
await page.waitForFunction(() => window.__calls.some((c) => c.body.action === "create"));
await page.waitForFunction(() => window.__calls.filter((c) => c.body.action === "list_drafts").length >= 2);
const create = await lastCall("create");
check("create: draftId ikut terkirim", create.body.draftId === "aaaaaaaa-1111-2222-3333-444444444444", JSON.stringify(create.body));
check("create: slug, email, sandi, template", create.body.slug === "julia-dan-kevin" && create.body.adminEmail === "julia@mail.com" && create.body.adminPassword === pw && create.body.templateId === "klasik");
await page.waitForFunction(() => document.getElementById("client-modal").hidden);
check("selesai: modal tertutup & kembali ke mode biasa", (await page.getAttribute("#admin-password", "type")) === "password" && /Buat client baru/.test(await page.locator("#client-modal-title").innerText()));
await page.waitForTimeout(150);
check("selesai: info login ditampilkan sekali (URL, email, sandi)", /willcome\.my\.id\/julia-dan-kevin\//.test(dialogMsg) && /Email: julia@mail\.com/.test(dialogMsg) && dialogMsg.includes("Sandi: " + pw), dialogMsg);
check("selesai: daftar draft dimuat ulang (status berubah)", /Sudah jadi client/i.test(await first.innerText()));

/* mode draft tidak boleh bocor */
const third = page.locator('#drafts-list article[data-draft="cccccccc-1111-2222-3333-444444444444"]');
await third.locator("[data-draft-create]").click();
await page.click("#client-modal-close");
await page.click("#client-new-open");
check("tutup lalu 'Client baru': judul & sandi kembali biasa", /Buat client baru/.test(await page.locator("#client-modal-title").innerText()) && (await page.getAttribute("#admin-password", "type")) === "password");
await page.fill("#slug", "manual-saja"); await page.fill("#display-name", "Manual"); await page.fill("#bride-name", "A"); await page.fill("#groom-name", "B");
await page.fill("#admin-email", "m@mail.com"); await page.fill("#admin-password", "rahasia123");
await page.click("#submit");
await page.waitForFunction(() => window.__calls.filter((c) => c.body.action === "create").length === 2);
const manual = await lastCall("create");
check("client biasa: TIDAK membawa draftId dari draft sebelumnya", manual.body.draftId === undefined, JSON.stringify(manual.body.draftId));

/* tandai / tolak / hapus */
await third.locator('[data-draft-status="diproses"]').click();
await page.waitForFunction(() => window.__calls.some((c) => c.body.action === "update_draft"));
const upd = await lastCall("update_draft");
check("tandai diproses: aksi update_draft dengan status", upd.body.draftId === "cccccccc-1111-2222-3333-444444444444" && upd.body.status === "diproses");
await page.waitForFunction(() => document.querySelector('[data-draft="cccccccc-1111-2222-3333-444444444444"]')?.innerText.toLowerCase().includes("diproses"));
check("status di daftar ikut berubah jadi Diproses", /Diproses/i.test(await third.innerText()));

page.once("dialog", (d) => d.accept());
await second.locator("[data-draft-delete]").click();
await page.waitForFunction(() => window.__calls.some((c) => c.body.action === "delete_draft"));
check("hapus: aksi delete_draft untuk draft yang benar", (await lastCall("delete_draft")).body.draftId === "bbbbbbbb-1111-2222-3333-444444444444");
await page.waitForFunction(() => document.querySelectorAll("#drafts-list article").length === 2);
check("hapus: draft hilang dari daftar", (await page.locator("#drafts-list article").count()) === 2);

page.once("dialog", (d) => d.dismiss());
const before = (await calls()).filter((c) => c.body.action === "delete_draft").length;
await third.locator("[data-draft-delete]").click();
await page.waitForTimeout(150);
check("hapus dibatalkan: tidak ada panggilan", (await calls()).filter((c) => c.body.action === "delete_draft").length === before);
check("tidak ada galat JavaScript", errors.length === 0, errors.join(" | "));

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
