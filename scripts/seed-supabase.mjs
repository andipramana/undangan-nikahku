/**
 * Seed sekali-jalan: isi Supabase (site_content + photos) dari repo ini.
 * Jangan di-deploy — butuh service_role key yang hanya ada di lingkungan lokal.
 *
 * Pemakaian:
 *   1. Buat file .env di root (contoh: .env.example):
 *        SUPABASE_URL=https://rxqolwczphehbzrzmisa.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *      (service_role key dari Dashboard → Settings → API. JANGAN masuk ke repo.)
 *   2. node scripts/seed-supabase.mjs
 *
 * Sifat:
 *   - Idempoten & aman untuk dijalankan ulang: baris photos di-upsert per
 *     storage_path, jadi pan/zoom yang sudah diatur lewat admin TIDAK ditimpa —
 *     hanya sort_order yang disegarkan mengikuti urutan lokal.
 *   - foto_profile dilewati (sudah tidak dirender di mana pun).
 *   - Folder foto lama dimetakan ke enum baru (lihat FOLDER_MAP).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// .env (parse manual — tidak perlu dependency dotenv)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    console.error(
      "File .env tidak ditemukan di root.\n" +
        "Buat dari .env.example: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.\n" +
        "(service role key: Dashboard → Settings → API Keys → service_role)"
    );
    process.exit(1);
  }
  const env = {};
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  return env;
}

// ---------------------------------------------------------------------------
// Baca config.js — dievaluasi dalam konteks dengan stub window, bukan regex
// (file-nya berisi komentar yang tidak bisa diparse sebagai JSON murni).
// ---------------------------------------------------------------------------
function loadConfig() {
  const raw = fs.readFileSync(path.join(ROOT, "assets", "js", "config.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(raw, sandbox, { filename: "config.js" });
  return sandbox.window.WEDDING_CONFIG;
}

// ---------------------------------------------------------------------------
// Susun objek content yang disimpan di site_content — mengikuti persis bentuk
// WEDDING_CONFIG dikurangi field foto/manifest yang tidak relevan lagi
// (lihat §3.1 rencana admin panel).
// ---------------------------------------------------------------------------
function buildContent(cfg) {
  const content = {
    siteTitle: cfg.siteTitle,
    guestParam: cfg.guestParam,
    defaultGuestName: cfg.defaultGuestName,
    couple: {
      bride: {
        name: cfg.couple.bride.name,
        nickname: cfg.couple.bride.nickname,
        father: cfg.couple.bride.father,
        mother: cfg.couple.bride.mother,
        instagram: cfg.couple.bride.instagram || ""
      },
      groom: {
        name: cfg.couple.groom.name,
        nickname: cfg.couple.groom.nickname,
        father: cfg.couple.groom.father,
        mother: cfg.couple.groom.mother,
        instagram: cfg.couple.groom.instagram || ""
      }
    },
    opening: {
      arabicQuote: cfg.opening.arabicQuote,
      quote: cfg.opening.quote,
      source: cfg.opening.source
    },
    event: {
      dateISO: cfg.event.dateISO,
      dateLabel: cfg.event.dateLabel,
      dayLabel: cfg.event.dayLabel,
      countdownTarget: cfg.event.countdownTarget,
      akad: cfg.event.akad,
      resepsi: cfg.event.resepsi,
      venue: cfg.event.venue
    },
    dresscode: {
      text: cfg.dresscode.text,
      colors: cfg.dresscode.colors
    },
    quotePhoto: { quote: cfg.quotePhoto.quote },
    // Foto story disimpan di tabel photos (folder 'story', sort_order = indeks
    // babak) — di sini cukup teksnya saja.
    loveStory: cfg.loveStory.map(({ photo, ...rest }) => rest),
    gift: {
      accounts: cfg.gift.accounts,
      address: cfg.gift.address,
      note: cfg.gift.note || ""
    },
    heroSlideInterval: cfg.heroSlideInterval,
    audio: { src: cfg.audio.src, title: cfg.audio.title },
    closing: { text: cfg.closing.text }
  };
  return content;
}

// ---------------------------------------------------------------------------
// Foto: folder lama → enum + lebar maks unggahan (angka dari TARGETS di
// scripts/compress-images.py — jangan diubah tanpa mengubah dua-duanya)
// ---------------------------------------------------------------------------
const FOLDER_MAP = [
  { dir: "foto_cover", folder: "cover" },
  { dir: "foto_opening", folder: "opening" },
  { dir: "foto_closing", folder: "closing" },
  { dir: "foto_bride", folder: "bride" },
  { dir: "foto_groom", folder: "groom" },
  { dir: "foto_slider_section_1", folder: "wfl" },
  { dir: "foto_slider_section_2", folder: "event" },
  { dir: "foto_gallery", folder: "gallery" }
];

const IMG = path.join(ROOT, "assets", "img");

// List file .webp terurut — sumber kebenaran urutan adalah NAMA FILE (sama
// seperti build-manifests.mjs), bukan isi manifest, supaya foto_quote dan
// foto_story (yang tidak punya manifest) bisa diproses dengan cara yang sama.
function listWebp(dir) {
  const full = path.join(IMG, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith(".webp"))
    .sort();
}

async function main() {
  const env = loadEnv();
  const cfg = loadConfig();
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // 1) Teks
  const content = buildContent(cfg);
  const { error: contentErr } = await sb
    .from("site_content")
    .upsert({ id: 1, content }, { onConflict: "id" });
  if (contentErr) throw new Error(`Gagal upsert site_content: ${contentErr.message}`);
  console.log(`site_content: ok (${Object.keys(content).length} bagian)`);

  // 2) Foto per folder (mapping manifest)
  let total = 0;
  for (const { dir, folder } of FOLDER_MAP) {
    const files = listWebp(dir);
    if (!files.length) {
      console.warn(`SKIP (tidak ada .webp): ${dir}`);
      continue;
    }
    let n = 0;
    for (const [i, file] of files.entries()) {
      const storagePath = `${folder}/${file}`;
      const filePath = path.join(IMG, dir, file);
      const { error: upErr } = await sb.storage
        .from("photos")
        .upload(storagePath, fs.readFileSync(filePath), {
          contentType: "image/webp",
          upsert: true // jalankan ulang aman
        });
      if (upErr) throw new Error(`Gagal upload ${storagePath}: ${upErr.message}`);

      const { error: rowErr } = await sb.from("photos").upsert(
        {
          folder,
          storage_path: storagePath,
          sort_order: i
        },
        { onConflict: "storage_path" }
      );
      if (rowErr) throw new Error(`Gagal upsert baris ${storagePath}: ${rowErr.message}`);
      n++;
    }
    console.log(`photos/${folder}: ${n} foto (dari ${dir})`);
    total += n;
  }

  // 3) Quote — satu foto full-width 1:1
  const quoteFiles = listWebp("foto_quote").filter((f) => f.startsWith("photo"));
  if (quoteFiles.length) {
    const storagePath = `quote/${quoteFiles[0]}`;
    const { error: upErr } = await sb.storage
      .from("photos")
      .upload(storagePath, fs.readFileSync(path.join(IMG, "foto_quote", quoteFiles[0])), {
        contentType: "image/webp",
        upsert: true
      });
    if (upErr) throw new Error(`Gagal upload ${storagePath}: ${upErr.message}`);
    const { error: rowErr } = await sb.from("photos").upsert(
      { folder: "quote", storage_path: storagePath, sort_order: 0 },
      { onConflict: "storage_path" }
    );
    if (rowErr) throw new Error(`Gagal upsert baris ${storagePath}: ${rowErr.message}`);
    console.log("photos/quote: 1 foto");
    total++;
  }

  // 4) Story — sort_order = indeks babak loveStory (01.webp → babak 0, dst).
  //    Kalau jumlah file tidak sama dengan jumlah babak, peringatkan — foto
  //    bisa bergeser ke babak yang salah (jebakan #7 rencana).
  const storyFiles = listWebp("foto_story");
  if (storyFiles.length) {
    if (storyFiles.length !== content.loveStory.length) {
      console.warn(
        `PERINGATAN: foto_story (${storyFiles.length}) != loveStory (${content.loveStory.length}). ` +
          "Urutan foto story mengikuti indeks babak — cek setelah seed."
      );
    }
    for (const [i, file] of storyFiles.entries()) {
      const storagePath = `story/${file}`;
      const { error: upErr } = await sb.storage
        .from("photos")
        .upload(storagePath, fs.readFileSync(path.join(IMG, "foto_story", file)), {
          contentType: "image/webp",
          upsert: true
        });
      if (upErr) throw new Error(`Gagal upload ${storagePath}: ${upErr.message}`);
      const { error: rowErr } = await sb.from("photos").upsert(
        { folder: "story", storage_path: storagePath, sort_order: i },
        { onConflict: "storage_path" }
      );
      if (rowErr) throw new Error(`Gagal upsert baris ${storagePath}: ${rowErr.message}`);
    }
    console.log(`photos/story: ${storyFiles.length} foto`);
    total += storyFiles.length;
  }

  console.log(`\nSelesai — ${total} foto terunggah ke bucket 'photos'.`);
  console.log("Cek Dashboard: baris per folder di tabel photos harus cocok dengan file lokal.");
}

main().catch((err) => {
  console.error("SEED GAGAL:", err.message);
  process.exit(1);
});
