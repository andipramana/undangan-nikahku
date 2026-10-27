/** Ikon undangan unggahan client: dari satu gambar menjadi ikon yang benar.
 *
 * A. pembuat ikon (panel/app-icon.js) dijalankan sungguhan di browser: ukuran
 *    keempat berkas, potong persegi dari tengah, zona aman maskable, latar iOS
 *    tidak hitam, dan penolakan berkas yang tak layak.
 * B. sisi tamu (pwa.js): ikon tab & manifest memakai unggahan client; tanpa
 *    unggahan, tenant selain root TIDAK mewarisi segel A·M milik root; panel
 *    tidak terpengaruh.
 * C. kabel statis: halaman Pengaturan, admin.html, main.js, provisioning.
 */
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [iconJs, pwaJs] = await Promise.all([
  fs.readFile("assets/js/panel/app-icon.js", "utf8"),
  fs.readFile("assets/js/pwa.js", "utf8")
]);

const browser = await chromium.launch();

/* ── A. pembuat ikon ────────────────────────────────────────────────────── */
{
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({ content: iconJs });

  const res = await page.evaluate(async () => {
    const make = (w, h, draw, type = "image/png") => new Promise((resolve) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      c.toBlob((b) => resolve(new File([b], "x.png", { type })), type);
    });
    const dims = async (blob) => { const b = await createImageBitmap(blob); return `${b.width}x${b.height}`; };
    const px = async (blob, fx, fy) => {
      const b = await createImageBitmap(blob);
      const c = document.createElement("canvas"); c.width = b.width; c.height = b.height;
      const ctx = c.getContext("2d"); ctx.drawImage(b, 0, 0);
      const d = ctx.getImageData(Math.floor(fx * (b.width - 1)), Math.floor(fy * (b.height - 1)), 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    };
    const tryBuild = async (file) => { try { await window.PanelAppIcon.buildSet(file); return "ok"; } catch (e) { return e.message; } };
    const out = {};

    // 1. latar gelap bersudut gelap, dengan bingkai putih tebal di 8.75%–16.25% dari tepi
    const framed = await make(800, 800, (g, w, h) => {
      g.fillStyle = "#14120f"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ffffff"; g.lineWidth = 60; g.strokeRect(100, 100, w - 200, h - 200);
      g.fillStyle = "#c9a668"; g.beginPath(); g.arc(w / 2, h / 2, 200, 0, 7); g.fill();
    });
    const a = await window.PanelAppIcon.buildSet(framed);
    out.names = Object.keys(a);
    out.dims = [await dims(a["icon-192.png"]), await dims(a["icon-512.png"]), await dims(a["icon-maskable-512.png"]), await dims(a["apple-touch-icon.png"])];
    out.anyBand = await px(a["icon-512.png"], 0.125, 0.5);           // "any": bingkai putih tepat di tempatnya (12.5%)
    out.maskWhereBandWas = await px(a["icon-maskable-512.png"], 0.125, 0.5); // maskable: di 12.5% kini latar gelap (isi sudah menyusut)
    out.maskBandMoved = await px(a["icon-maskable-512.png"], 0.215, 0.5);    // ...bingkai pindah ke ~21.5% (12% + 0.76 × 12.5%)
    out.maskEdge = await px(a["icon-maskable-512.png"], 0.03, 0.5);          // tepi luar = warna latar
    out.maskCenter = await px(a["icon-maskable-512.png"], 0.5, 0.5);
    out.maskCorner = await px(a["icon-maskable-512.png"], 0.01, 0.01);

    // 2. lanskap: kiri merah, kanan hijau → dipotong persegi dari TENGAH
    const wide = await make(1200, 600, (g, w, h) => { g.fillStyle = "#ff0000"; g.fillRect(0, 0, w / 2, h); g.fillStyle = "#00ff00"; g.fillRect(w / 2, 0, w / 2, h); });
    const b = await window.PanelAppIcon.buildSet(wide);
    out.cropLeft = await px(b["icon-512.png"], 0.1, 0.5);
    out.cropRight = await px(b["icon-512.png"], 0.9, 0.5);

    // 3. transparan penuh → latar maskable & iOS jadi putih (bukan hitam)
    const transparent = await make(512, 512, (g) => { g.fillStyle = "#c9a668"; g.beginPath(); g.arc(256, 256, 120, 0, 7); g.fill(); });
    const t = await window.PanelAppIcon.buildSet(transparent);
    out.anyTransparent = await px(t["icon-512.png"], 0.02, 0.02);
    out.maskTransparent = await px(t["icon-maskable-512.png"], 0.02, 0.02);
    out.appleTransparent = await px(t["apple-touch-icon.png"], 0.02, 0.02);

    // 4. penolakan
    out.tiny = await tryBuild(await make(64, 64, (g) => { g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64); }));
    out.notImage = await tryBuild(new File(["halo"], "x.txt", { type: "text/plain" }));
    out.svg = await tryBuild(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    out.big = await tryBuild(new File([new Uint8Array(6 * 1024 * 1024)], "x.png", { type: "image/png" }));
    out.garbage = await tryBuild(new File([new Uint8Array(2000)], "x.png", { type: "image/png" }));
    return out;
  });

  check("ikon: empat berkas dengan nama yang dibaca halaman tamu",
    JSON.stringify(res.names) === JSON.stringify(["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]), res.names.join(","));
  check("ikon: ukuran 192, 512, 512 (maskable), 180 (iOS)", res.dims.join(" ") === "192x192 512x512 512x512 180x180", res.dims.join(" "));
  check("ikon 'any': gambar apa adanya (bingkai putih di 12.5%)", res.anyBand[0] > 240 && res.anyBand[3] === 255, JSON.stringify(res.anyBand));
  check("ikon maskable: tepi luar = warna latar sudut (gelap)", res.maskEdge[0] < 40 && res.maskEdge[3] === 255, JSON.stringify(res.maskEdge));
  check("ikon maskable: isi MENYUSUT ke zona aman (di 12.5% kini latar, bukan bingkai)", res.maskWhereBandWas[0] < 40, JSON.stringify(res.maskWhereBandWas));
  check("ikon maskable: bingkai pindah ke dalam (±21.5%)", res.maskBandMoved[0] > 200, JSON.stringify(res.maskBandMoved));
  check("ikon maskable: isi tetap di tengah (emas)", res.maskCenter[0] > 180 && res.maskCenter[2] < 140, JSON.stringify(res.maskCenter));
  check("ikon maskable: sudut penuh warna (tidak transparan)", res.maskCorner[3] === 255, JSON.stringify(res.maskCorner));
  check("potong persegi dari TENGAH (kiri merah)", res.cropLeft[0] > 200 && res.cropLeft[1] < 60, JSON.stringify(res.cropLeft));
  check("potong persegi dari TENGAH (kanan hijau)", res.cropRight[1] > 200 && res.cropRight[0] < 60, JSON.stringify(res.cropRight));
  check("ikon 'any': transparansi dipertahankan", res.anyTransparent[3] === 0, JSON.stringify(res.anyTransparent));
  check("ikon maskable dari gambar transparan: latar PUTIH, bukan hitam", res.maskTransparent[3] === 255 && res.maskTransparent[0] > 240, JSON.stringify(res.maskTransparent));
  check("ikon iOS dari gambar transparan: latar PUTIH, bukan hitam", res.appleTransparent[3] === 255 && res.appleTransparent[0] > 240, JSON.stringify(res.appleTransparent));
  check("tolak gambar terlalu kecil (64×64)", /terlalu kecil/.test(res.tiny), res.tiny);
  check("tolak berkas bukan gambar", /PNG, JPG, atau WebP/.test(res.notImage), res.notImage);
  check("tolak SVG (tidak diizinkan)", /PNG, JPG, atau WebP/.test(res.svg), res.svg);
  check("tolak berkas > 5 MB", /5 MB/.test(res.big), res.big);
  check("tolak gambar rusak dengan pesan jelas", /tidak bisa dibaca/.test(res.garbage), res.garbage);
  await page.close();
}

/* ── B. sisi tamu ───────────────────────────────────────────────────────── */
const ORIGIN = "https://guest.test";
async function guest(slug, surface) {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.route(`${ORIGIN}/**`, (r) => r.fulfill({
    contentType: "text/html",
    body: `<!doctype html><head><title>Undangan Pernikahan</title>
      <link rel="icon" href="assets/img/favicon.png" type="image/png">
      <link rel="apple-touch-icon" href="assets/icons/inv-apple-touch-icon.png"></head><body></body>`
  }));
  await page.goto(`${ORIGIN}/`);
  await page.evaluate(({ slug, surface }) => {
    window.photoUrl = (p) => "https://store.test/storage/v1/object/public/photos/" + p;
    window.TenantContext = {
      slug, surface,
      path(kind) {
        const base = slug === "root" ? "/" : `/${slug}/`;
        if (kind === "invitation") return base;
        return slug === "root" ? `/${kind}/` : `/${slug}/${kind}/`;
      }
    };
  }, { slug, surface });
  await page.addScriptTag({ content: pwaJs });
  const read = () => page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const m = link ? await (await fetch(link.href)).json() : null;
    return {
      fav: document.querySelector('link[rel="icon"]').href,
      apple: document.querySelector('link[rel="apple-touch-icon"]').href,
      icons: m ? m.icons.map((i) => i.src) : []
    };
  });
  return { page, ctx, read };
}

{
  const g = await guest("julia-dan-kevin", "invitation");
  const before = await g.read();
  check("tamu tanpa unggahan: ikon tab NETRAL, bukan segel A·M milik root", /\/assets\/icons\/inv-192\.png$/.test(before.fav), before.fav);
  check("tamu tanpa unggahan: manifest memakai ikon undangan bawaan", before.icons.every((s) => /\/assets\/icons\/inv-/.test(s)), before.icons.join(" | "));

  await g.page.evaluate(() => window.WeddingPwa.setAppIcon({ path: "julia-dan-kevin/icons", version: 123 }));
  const after = await g.read();
  const store = "https://store.test/storage/v1/object/public/photos/julia-dan-kevin/icons/";
  check("tamu + unggahan: ikon tab = unggahan client (bernomor versi)", after.fav === `${store}icon-192.png?v=123`, after.fav);
  check("tamu + unggahan: apple-touch-icon = unggahan client", after.apple === `${store}apple-touch-icon.png?v=123`, after.apple);
  check("tamu + unggahan: manifest 192/512/maskable dari Storage publik (URL absolut)",
    after.icons.length === 3 && after.icons.every((s) => s.startsWith(store) && s.endsWith("?v=123")), after.icons.join(" | "));
  check("tamu + unggahan: ikon tiap tenant berbeda (path berawalan slug-nya sendiri)", after.icons.every((s) => s.includes("/julia-dan-kevin/icons/")));

  await g.page.evaluate(() => window.WeddingPwa.setAppIcon(null));
  const reset = await g.read();
  check("hapus unggahan: kembali ke ikon bawaan", /\/assets\/icons\/inv-192\.png$/.test(reset.fav) && reset.icons.every((s) => /\/assets\/icons\/inv-/.test(s)), reset.fav);

  await g.page.evaluate(() => window.WeddingPwa.setAppIcon({ path: "x/icons" }));
  const noVersion = await g.read();
  check("unggahan tanpa versi diabaikan (tidak membuat URL setengah jadi)", /\/assets\/icons\/inv-192\.png$/.test(noVersion.fav), noVersion.fav);
  await g.ctx.close();
}
{
  const g = await guest("root", "invitation");
  const before = await g.read();
  check("root tanpa unggahan: ikon tab tetap segel miliknya", /\/assets\/img\/favicon\.png$/.test(before.fav), before.fav);
  await g.ctx.close();
}
{
  const g = await guest("julia-dan-kevin", "admin");
  await g.page.evaluate(() => window.WeddingPwa.setAppIcon({ path: "julia-dan-kevin/icons", version: 9 }));
  const r = await g.read();
  check("panel TIDAK memakai ikon unggahan undangan (tetap ikon panel)", r.icons.every((s) => /\/assets\/icons\/icon-/.test(s)), r.icons.join(" | "));
  await g.ctx.close();
}

await browser.close();

/* ── C. kabel statis ────────────────────────────────────────────────────── */
const [pengaturan, adminHtml, mainJs, fn] = await Promise.all([
  fs.readFile("assets/js/panel/pages/pengaturan.js", "utf8"),
  fs.readFile("admin.html", "utf8"),
  fs.readFile("assets/js/main.js", "utf8"),
  fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8")
]);
check("Pengaturan: ada kartu Ikon undangan dengan input berkas", /card\("Ikon undangan"/.test(pengaturan) && /id="st-icon-file"/.test(pengaturan));
check("Pengaturan: appIcon ikut disimpan lewat satu pintu (PanelStore.save)", /PanelStore\.save\(\[[^\]]*"appIcon"/.test(pengaturan));
check("Pengaturan: berkas diunggah lewat PanelAppIcon.upload saat Simpan", /PanelAppIcon\.upload\(pendingIconSet\)/.test(pengaturan));
check("admin.html: app-icon.js dimuat sebelum halaman-halaman",
  adminHtml.indexOf("assets/js/panel/app-icon.js") > 0 && adminHtml.indexOf("assets/js/panel/app-icon.js") < adminHtml.indexOf("assets/js/panel/pages/pengaturan.js"));
check("main.js: memberi tahu pwa.js soal appIcon setelah data tiba", /WeddingPwa\.setAppIcon\(cfg\.appIcon\)/.test(mainJs));
check("provisioning: ikon unggahan root TIDAK tersalin ke client baru", /delete content\.appIcon/.test(fn));

process.exit(failed ? 1 : 0);
