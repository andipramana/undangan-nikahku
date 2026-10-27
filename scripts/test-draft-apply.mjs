/** Draft /catin → client baru (Edge Function provision-invitation).
 *
 * Isi draft adalah INPUT PUBLIK, jadi logika penerapannya (`applyDraft`) harus
 * tahan data buruk. Potongan itu diambil LANGSUNG dari index.ts (tipenya dibuang
 * dengan module.stripTypeScriptTypes) dan dijalankan terhadap klien database
 * tiruan — yang diuji adalah kode sungguhan, bukan salinan.
 */
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const src = await fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8");
const from = src.indexOf("const DRAFT_STATUS");
const to = src.indexOf('if (action === "list_drafts")');
check("potongan applyDraft ditemukan di index.ts", from > 0 && to > from);
const js = stripTypeScriptTypes(src.slice(from, to));
const build = new Function("admin", `${js}\nreturn { applyDraft, str, dotTime, DRAFT_STATUS };`);

/** Klien database tiruan: satu baris site_content, mencatat semua penulisan. */
function fakeAdmin(content, opts = {}) {
  const writes = [];
  const admin = {
    writes,
    from(table) {
      const q = { table, op: "select", patch: null, filters: [] };
      const b = {
        select() { q.op = "select"; return b; },
        update(patch) { q.op = "update"; q.patch = patch; return b; },
        eq(k, v) { q.filters.push([k, v]); return b; },
        single: async () => (table === "site_content" && !opts.noRow ? { data: { content: structuredClone(content) }, error: null } : { data: null, error: { message: "tidak ada" } }),
        then(res, rej) {
          if (q.op === "update") writes.push({ table, patch: q.patch, filters: q.filters });
          return Promise.resolve({ error: opts.writeError && table === opts.writeError ? { message: "gagal tulis" } : null }).then(res, rej);
        }
      };
      return b;
    }
  };
  return admin;
}
const seed = () => ({
  templateId: "klasik", siteTitle: "Undangan — The Wedding",
  couple: { bride: { name: "Mempelai Wanita", nickname: "Mempelai Wanita", father: "", mother: "", instagram: "" }, groom: { name: "Mempelai Pria", nickname: "Mempelai Pria", father: "", mother: "", instagram: "" } },
  event: { dateISO: "", dateLabel: "", dayLabel: "", countdownTarget: "", akad: { label: "Akad Nikah", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } }, resepsi: { label: "Resepsi", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } } },
  loveStory: [], gift: { accounts: [], contactCPP: "", contactCPW: "", address: { recipient: "", phone: "", detail: "" }, note: "" },
  livestream: { youtube: "", instagram: "", tiktok: "" }, templates: {}
});
const payload = () => ({
  couple: {
    groom: { name: "Kevin Alfaro S.Kom.", nickname: "Kevin", father: "H. Dimas", mother: "Hj. Ratna", childOrder: "pertama", instagram: "@kevin.a" },
    bride: { name: "Julia Haniva S.E.", nickname: "Julia", father: "R. Arya", mother: "Ayana", childOrder: "ketiga", instagram: "" }
  },
  event: { date: "2027-11-08", akad: { start: "09:00", end: "10:00", venueName: "Gedung Mayang", address: "Jl. Raya 1", mapsUrl: "https://maps.app.goo.gl/x" }, resepsi: { start: "11:00", end: "14:00", sameVenue: true } },
  loveStory: [{ date: "2022", title: "Kenalan", text: "Halo" }, { date: "x", title: "", text: "tanpa judul" }],
  gift: { accounts: [{ bank: "BCA", number: "123", holder: "Julia", owner: "cpw" }, { bank: "", number: "9", holder: "x" }], address: { recipient: "Julia", phone: "0812", detail: "Jl. Mawar" } },
  livestream: { youtube: "https://youtube.com/live/abc" },
  theme: { presetId: "rose", colors: { bg: "#fff0f0", gold: "#d48a8a" } }
});

async function run(p, contentOverride, opts) {
  const content = contentOverride || seed();
  const admin = fakeAdmin(content, opts);
  const { applyDraft } = build(admin);
  let error = null;
  try { await applyDraft("inv-1", { id: "draft-1", payload: p }); } catch (e) { error = e; }
  const site = admin.writes.find((w) => w.table === "site_content");
  const mark = admin.writes.find((w) => w.table === "client_drafts");
  return { error, c: site && site.patch.content, site, mark, admin };
}

{
  const { error, c, site, mark } = await run(payload());
  check("terapkan: tanpa galat", !error, error && error.message);
  check("terapkan: nama & panggilan mempelai", c.couple.groom.name === "Kevin Alfaro S.Kom." && c.couple.bride.nickname === "Julia");
  check("terapkan: urutan anak (childOrder) dan orang tua", c.couple.bride.childOrder === "ketiga" && c.couple.groom.father === "H. Dimas");
  check("terapkan: instagram tanpa @", c.couple.groom.instagram === "kevin.a");
  check("terapkan: judul situs dari panggilan (wanita & pria)", c.siteTitle === "Julia & Kevin — The Wedding", c.siteTitle);
  check("terapkan: label tanggal dihitung server ('08 November 2027')", c.event.dateLabel === "08 November 2027", c.event.dateLabel);
  check("terapkan: hari dihitung benar (8 Nov 2027 = Senin)", c.event.dayLabel === "Senin", c.event.dayLabel);
  check("terapkan: countdown akad +07:00", c.event.countdownTarget === "2027-11-08T09:00:00+07:00", c.event.countdownTarget);
  check("terapkan: jam memakai format titik ('09.00')", c.event.akad.start === "09.00" && c.event.resepsi.end === "14.00");
  check("terapkan: resepsi satu tempat menyalin tempat akad", c.event.resepsi.venue.name === "Gedung Mayang" && c.event.resepsi.venue.mapsUrl === "https://maps.app.goo.gl/x");
  check("terapkan: cerita tanpa judul dibuang", c.loveStory.length === 1 && c.loveStory[0].title === "Kenalan");
  check("terapkan: rekening tak lengkap dibuang, pemilik terbaca", c.gift.accounts.length === 1 && c.gift.accounts[0].owner === "cpw");
  check("terapkan: alamat kado & live streaming", c.gift.address.detail === "Jl. Mawar" && c.livestream.youtube === "https://youtube.com/live/abc");
  check("terapkan: warna masuk ke templates.klasik.theme.colors (kontrak per-template)",
    c.templates.klasik.theme.colors.bg === "#fff0f0" && c.templates.klasik.theme.colors.gold === "#d48a8a");
  check("terapkan: data yang tak disentuh tetap utuh (livestream.instagram)", c.livestream.instagram === "");
  check("terapkan: konten ditulis ke client yang benar", site.filters.some(([k, v]) => k === "invitation_id" && v === "inv-1"));
  check("terapkan: draft ditandai 'dibuat' dan terhubung ke client", mark && mark.patch.status === "dibuat" && mark.patch.invitation_id === "inv-1" && mark.filters.some(([k, v]) => k === "id" && v === "draft-1"));
}
{
  const bad = payload();
  bad.event.date = "2027-02-30";
  const { c } = await run(bad);
  check("tanggal mustahil (30 Feb) diabaikan, acara lama tetap", c.event.dateISO === "" && c.event.akad.start === "");
}
{
  const bad = payload(); bad.event.date = "bukan tanggal";
  const { c } = await run(bad);
  check("tanggal bukan format ISO diabaikan", c.event.dateISO === "");
}
{
  const bad = payload();
  bad.couple.groom.name = "x".repeat(500);
  bad.couple.bride.father = "y".repeat(500);
  bad.gift.address.detail = "z".repeat(5000);
  const { c } = await run(bad);
  check("input panjang dipotong (nama 80, ayah 80, alamat 300)", c.couple.groom.name.length === 80 && c.couple.bride.father.length === 80 && c.gift.address.detail.length === 300);
}
{
  const bad = payload();
  bad.theme.colors = { bg: "#fff0f0", "__proto__": "#000000", "a b": "#111111", evil: "url(javascript:x)", short: "#fff", ok_2: "#AbCdEf" };
  const { c } = await run(bad);
  const colors = c.templates.klasik.theme.colors;
  check("warna: hanya key sederhana + hex 6 digit yang diterima", Object.keys(colors).sort().join(",") === "bg,ok_2", Object.keys(colors).join(","));
  check("warna: tidak ada polusi prototype", ({}).polluted === undefined && Object.getPrototypeOf(colors) === Object.prototype && !Object.prototype.hasOwnProperty.call(colors, "__proto__"));
}
{
  const bad = payload();
  bad.loveStory = Array.from({ length: 30 }, (_, i) => ({ title: "T" + i }));
  bad.gift.accounts = Array.from({ length: 30 }, () => ({ bank: "B", number: "1", holder: "H" }));
  const { c } = await run(bad);
  check("batas jumlah: cerita maks 4, rekening maks 4", c.loveStory.length === 4 && c.gift.accounts.length === 4);
}
{
  const { c } = await run({});
  check("payload kosong: tidak merusak konten (nama bawaan tetap)", c.couple.groom.name === "Mempelai Pria" && c.event.dateISO === "");
}
{
  const { c } = await run(null);
  check("payload null: tidak melempar & konten tetap", !!c && c.couple.bride.name === "Mempelai Wanita");
}
{
  const existing = seed();
  existing.templates = { klasik: { theme: { colors: { bg: "#000000", old: "#111111" } }, extras: { a: 1 } } };
  const p = payload(); p.theme.colors = { bg: "#fff0f0" };
  const { c } = await run(p, existing);
  check("warna digabung: milik template yang ada tidak hilang", c.templates.klasik.theme.colors.old === "#111111" && c.templates.klasik.theme.colors.bg === "#fff0f0" && c.templates.klasik.extras.a === 1);
}
{
  const { error, mark } = await run(payload(), null, { noRow: true });
  check("konten client belum ada → galat jelas, draft TIDAK ditandai dibuat", !!error && /belum siap/.test(error.message) && !mark, error && error.message);
}
{
  const { error } = await run(payload(), null, { writeError: "site_content" });
  check("gagal menulis konten → galat dilempar (agar provisioning di-rollback)", !!error && /gagal tulis/.test(error.message));
}

/* ── pembantu murni ── */
{
  const { str, dotTime, DRAFT_STATUS } = build(fakeAdmin(seed()));
  check("dotTime: '9:05' → '09.05', sampah → ''", dotTime("9:05") === "09.05" && dotTime("abc") === "" && dotTime(null) === "");
  check("str: memangkas spasi & memotong", str("  hai  ", 10) === "hai" && str("abcdef", 3) === "abc" && str(null, 5) === "");
  check("status draft yang dikenal", JSON.stringify(DRAFT_STATUS) === JSON.stringify(["baru", "diproses", "dibuat", "ditolak"]));
}

/* ── kabel: create + aksi admin ── */
check("create: draft diperiksa SEBELUM apa pun dibuat (tolak yang sudah dipakai)", /d\.status === "dibuat"\) return fail/.test(src));
check("create: applyDraft dipanggil di dalam blok try (kegagalan → rollback)", /await applyTemplate\([^\n]*\n\s*if \(draft\) await applyDraft/.test(src));
check("aksi list_drafts / update_draft / delete_draft ada", ["list_drafts", "update_draft", "delete_draft"].every((a) => src.includes(`action === "${a}"`)));
check("aksi draft berada SETELAH gerbang root_owner", src.indexOf('app_metadata?.role !== "root_owner"') < src.indexOf('action === "list_drafts"'));

process.exit(failed ? 1 : 0);
