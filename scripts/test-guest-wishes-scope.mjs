/** Ucapan satu undangan tidak boleh memuat ucapan undangan lain.
 *
 * Policy RLS `wishes` mengizinkan anon membaca ucapan undangan aktif mana pun,
 * jadi pembatasan per-undangan sepenuhnya bergantung pada filter
 * `invitation_id=eq.<id>` dari klien. Dua cacat bertemu: klien Supabase ringan
 * membuang filter diam-diam saat nilainya null (query jadi "semua ucapan"), dan
 * jalur cadangan fetchInvitation (RPC gagal/lambat) tidak mengisi
 * TenantContext.invitationId. Hasilnya: halaman client baru menampilkan 29
 * ucapan milik root.
 *
 * Tidak butuh server maupun Supabase sungguhan: request ke host Supabase
 * dicegat dan hanya dicatat URL-nya.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [configJs, clientJs, rsvpJs] = await Promise.all([
  fs.readFile("assets/js/config.js", "utf8"),
  fs.readFile("assets/js/supabase-client.js", "utf8"),
  fs.readFile("assets/js/rsvp.js", "utf8")
]);

const ORIGIN = "http://guest.test";
const SB_HOST = "https://rxqolwczphehbzrzmisa.supabase.co";
const browser = await chromium.launch();

/** Halaman tamu minimal; request ke Supabase dicatat, RPC bisa dibuat gagal. */
async function boot({ rpcFails = false, cached = null, invitationId = undefined }) {
  const page = await browser.newPage();
  const sbCalls = [];
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><body></body>" }));
  await page.route(`${SB_HOST}/**`, (r) => {
    const u = r.request().url();
    sbCalls.push(u);
    if (u.includes("/rpc/get_invitation") && rpcFails) return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) });
    return r.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/0" }, body: "[]" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(({ cached, invitationId }) => {
    if (cached) localStorage.setItem("wedding_invitation_v2_julia-dan-kevin", JSON.stringify(cached));
    window.TenantContext = {
      slug: "julia-dan-kevin",
      invitationId: invitationId === undefined ? null : invitationId,
      setInvitation(i) { this.invitationId = i && i.id ? i.id : null; return this.invitationId; }
    };
  }, { cached, invitationId });
  for (const src of [configJs, clientJs]) await page.addScriptTag({ content: src });
  return { page, sbCalls };
}

// 1. Klien ringan tidak boleh membuang filter ber-nilai null
{
  const { page, sbCalls } = await boot({});
  await page.evaluate(() => window.sb.from("wishes").select("*", { count: "exact" }).eq("invitation_id", null));
  const q = sbCalls.find((u) => u.includes("/rest/v1/wishes")) || "";
  check("eq(null) tetap mengirim filter (gagal-aman), bukan dibuang", /invitation_id=eq\.null/.test(q), q);
  await page.evaluate(() => window.sb.from("wishes").select("*").eq("invitation_id", undefined));
  const q2 = sbCalls.filter((u) => u.includes("/rest/v1/wishes")).pop() || "";
  check("eq(undefined) juga tetap mengirim filter", /invitation_id=eq\.undefined/.test(q2), q2);
  await page.evaluate(() => window.sb.from("wishes").select("*").eq("invitation_id", "16849ab4-b1e7-49ad-b7c9-fc647ac265f5"));
  const q3 = sbCalls.filter((u) => u.includes("/rest/v1/wishes")).pop() || "";
  check("eq(id) normal tetap benar", /invitation_id=eq\.16849ab4-b1e7-49ad-b7c9-fc647ac265f5/.test(q3), q3);
  await page.close();
}

// 2. RPC gagal → pakai cadangan localStorage DAN invitationId terisi
{
  const cached = { invitation: { id: "11111111-1111-4111-8111-111111111111", slug: "julia-dan-kevin" }, content: {}, photos: {} };
  const { page } = await boot({ rpcFails: true, cached });
  const out = await page.evaluate(async () => {
    const data = await window.fetchInvitation();
    return { got: !!(data && data.invitation), id: window.TenantContext.invitationId };
  });
  check("RPC gagal: cadangan localStorage dipakai", out.got);
  check("RPC gagal: TenantContext.invitationId terisi dari cadangan", out.id === "11111111-1111-4111-8111-111111111111", String(out.id));
  await page.close();
}

// 3. rsvp.js: tanpa id undangan, daftar ucapan TIDAK diminta sama sekali
async function rsvpScenario(invitationId) {
  const { page, sbCalls } = await boot({ invitationId });
  await page.evaluate(() => {
    document.body.innerHTML = `<form id="rsvp-form"><input id="rsvp-name"><textarea id="rsvp-message"></textarea>
      <div id="rsvp-attendance"><button type="button" class="rsvp-pill" data-value="hadir">Hadir</button></div><button id="rsvp-submit" type="submit">Kirim</button>
      <p id="rsvp-status"></p></form><div id="wishes-list"></div><div id="wishes-pagination"></div>`;
    window.WEDDING_CONFIG.supabase.wishesTable = window.WEDDING_CONFIG.supabase.wishesTable || "wishes";
  });
  await page.addScriptTag({ content: rsvpJs });
  await page.evaluate(() => window.initRsvp());
  await page.waitForTimeout(150);
  const wishCalls = sbCalls.filter((u) => u.includes("/rest/v1/wishes"));
  await page.close();
  return wishCalls;
}
{
  const none = await rsvpScenario(null);
  check("rsvp: tanpa invitationId tidak ada query ucapan (tidak bocor lintas tenant)", none.length === 0, none.join(" | "));
  const some = await rsvpScenario("16849ab4-b1e7-49ad-b7c9-fc647ac265f5");
  check("rsvp: dengan invitationId, query SELALU memuat filter invitation_id",
    some.length >= 1 && some.every((u) => /invitation_id=eq\.16849ab4-b1e7-49ad-b7c9-fc647ac265f5/.test(u)), some.join(" | "));
}

await browser.close();
process.exit(failed ? 1 : 0);
