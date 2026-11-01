// Alat lokal untuk mengubah banner preview WhatsApp tiap client — tanpa bantuan AI.
//
//   npm run banner        lalu buka http://localhost:5177
//
// Di halaman itu: pilih client (slug), unggah foto, atur crop 1,91:1 (1200x630), klik
// "Simpan & push". Server di sini menulis gambar + halaman <slug>/index.html, lalu
// git commit & push HANYA berkas client itu. Hanya mendengarkan 127.0.0.1.
//
// Tiap penyimpanan memakai nama gambar baru (og-<slug>-<versi>.jpg): banner client lain
// tidak pernah tertimpa, dan cache preview WhatsApp tidak menahan gambar lama.
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.BANNER_ROOT || path.join(here, ".."));
const PORT = Number(process.env.PORT || 5177);
const NO_GIT = process.env.BANNER_NO_GIT === "1";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(["root", "demo", "catin", "home", "admin", "admin-qr", "assets", "templates", "scripts", "supabase"]);
const MAX_IMAGE = 4 * 1024 * 1024;

const listFile = () => path.join(ROOT, "scripts", "share-pages.json");
const readList = async () => JSON.parse(await readFile(listFile(), "utf8"));
const meta = (html, prop) => {
  const m = new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html);
  return m ? m[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&") : "";
};
const pageInfo = async (slug) => {
  try {
    const html = await readFile(path.join(ROOT, slug, "index.html"), "utf8");
    const image = meta(html, "og:image").split("/assets/img/social/")[1] || "";
    return { slug, title: meta(html, "og:title"), description: meta(html, "og:description"), image };
  } catch { return { slug, title: "", description: "", image: "" }; }
};

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on("data", (c) => { size += c.length; if (size > MAX_IMAGE * 1.6) { reject(new Error("Gambar terlalu besar")); req.destroy(); } else chunks.push(c); });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});
const git = (args) => run("git", args, { cwd: ROOT, windowsHide: true });

export async function saveBanner({ slug, title, description, image }) {
  slug = String(slug || "").trim().toLowerCase();
  title = String(title || "").trim(); description = String(description || "").trim();
  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) throw new Error("Slug tidak valid (huruf kecil, angka, tanda hubung).");
  if (!title || !description) throw new Error("Judul dan deskripsi wajib diisi.");
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ""));
  if (!m) throw new Error("Gambar tidak valid.");
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length < 1000 || bytes.length > MAX_IMAGE || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Gambar JPEG tidak valid atau terlalu besar.");

  const before = await pageInfo(slug);
  const version = Date.now().toString(36);
  const fileName = `og-${slug}-${version}.jpg`;
  const imgRel = `assets/img/social/${fileName}`;
  await mkdir(path.join(ROOT, "assets", "img", "social"), { recursive: true });
  await writeFile(path.join(ROOT, imgRel), bytes);
  await run(process.execPath, [path.join(here, "make-share-page.mjs"), slug, title, description, fileName], { cwd: ROOT, windowsHide: true });

  // Hapus gambar lama MILIK client ini saja — dan hanya jika tidak dipakai halaman lain.
  const paths = [`${slug}/index.html`, imgRel, "scripts/share-pages.json"];
  if (before.image && before.image !== fileName) {
    let shared = false;
    for (const other of await readList()) {
      if (other !== slug && (await pageInfo(other)).image === before.image) shared = true;
    }
    if (!shared) { try { await unlink(path.join(ROOT, "assets/img/social", before.image)); paths.push(`assets/img/social/${before.image}`); } catch { /* sudah tidak ada */ } }
  }

  let message = "Berkas disimpan (mode uji, tanpa git).";
  if (!NO_GIT) {
    await git(["add", "-A", "--", ...paths]);
    await git(["commit", "-m", `chore(share): banner WhatsApp ${slug}`, "--", ...paths]);
    try { await git(["push", "origin", "HEAD"]); message = "Sudah di-commit dan di-push ke GitHub."; }
    catch (e) { throw new Error(`Commit berhasil, tapi push gagal — jalankan "git push" sendiri.\n${(e.stderr || e.message || "").toString().trim()}`); }
  }
  return { slug, file: imgRel, version, url: `https://willcome.my.id/${slug}/`, message };
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(await readFile(path.join(here, "banner-tool.html"), "utf8"));
      }
      if (req.method === "GET" && url.pathname === "/api/pages") {
        return json(res, 200, await Promise.all((await readList()).map(pageInfo)));
      }
      if (req.method === "POST" && url.pathname === "/api/save") {
        return json(res, 200, await saveBanner(JSON.parse(await readBody(req))));
      }
      json(res, 404, { error: "Tidak ditemukan" });
    } catch (e) { json(res, 400, { error: e.message || String(e) }); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, "127.0.0.1", () => {
    console.log(`Alat banner WhatsApp siap: http://localhost:${PORT}`);
    console.log("Tekan Ctrl+C untuk berhenti.");
  });
}
