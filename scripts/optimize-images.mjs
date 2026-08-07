// Dev-only tooling: resize & compress source photos from MEITU folder into
// assets/img (hero + gallery). Not shipped as part of the deployed site.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = "C:\\Users\\andi.pramana\\Documents\\MEITU";
const ENGAGEMENT_DIR = "C:\\Users\\andi.pramana\\Documents\\ENGAGAMENT";
const ENGAGEMENT_HERO = { "DSC08356.jpg": "lamaran" };
const ENGAGEMENT_GALLERY = ["DSC08199.jpg", "DSC08043.jpg", "DSC08453.jpg", "DSC01197.jpg"];
const HERO_DIR = path.join(ROOT, "assets", "img", "hero");
const GALLERY_DIR = path.join(ROOT, "assets", "img", "gallery");

// Bukan foto individual — proof-sheet/kolase pilihan dari fotografer.
const EXCLUDE = new Set(["MEITU_20260713_101515880.jpg"]);

const HERO_MAP = {
  "MEITU_20260712_164724722.jpg": "cover-1",
  "MEITU_20260713_114441326.jpg": "cover-2",
  "MEITU_20260713_105702763.jpg": "opening-1",
  "MEITU_20260713_225723351.jpg": "opening-2",
  "MEITU_20260713_110302698.jpg": "closing-1",
  "MEITU_20260713_103228322.jpg": "closing-2",
  "MEITU_20260713_224704838.jpg": "profile-groom",
  "MEITU_20260713_230102888.jpg": "profile-bride"
};

// Foto ini punya orang lain di sisi kiri frame — potong dulu (fraksi dari lebar/tinggi asli)
// sebelum di-resize, supaya crop akhir fokus ke mempelai, bukan mengandalkan object-position
// (yang percuma kalau aspect ratio target lebih lebar dari sumber -> browser motong atas/bawah, bukan kiri/kanan).
const EXTRACT_CROP = {
  "profile-bride": { left: 0.4, top: 0, width: 0.6, height: 1 }
};

async function processOne(srcPath, destBase, maxSize, jpgQuality, cropKey) {
  const buf = await fs.readFile(srcPath);
  const crop = cropKey && EXTRACT_CROP[cropKey];

  const pipeline = () => {
    let img = sharp(buf).rotate();
    if (crop) {
      img = img.clone();
    }
    return img;
  };

  async function withExtract(img) {
    if (!crop) return img;
    const meta = await img.metadata();
    return img.extract({
      left: Math.round(meta.width * crop.left),
      top: Math.round(meta.height * crop.top),
      width: Math.round(meta.width * crop.width),
      height: Math.round(meta.height * crop.height)
    });
  }

  const resizeOpts = crop
    ? { width: 640, height: 800, fit: "cover" }
    : { width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true };

  const img1 = await withExtract(pipeline());
  await img1.resize(resizeOpts).jpeg({ quality: jpgQuality, mozjpeg: true }).toFile(`${destBase}.jpg`);
  const img2 = await withExtract(pipeline());
  await img2.resize(resizeOpts).webp({ quality: jpgQuality }).toFile(`${destBase}.webp`);

  const stat = await fs.stat(`${destBase}.jpg`);
  return stat.size;
}

async function main() {
  await fs.mkdir(HERO_DIR, { recursive: true });
  await fs.mkdir(GALLERY_DIR, { recursive: true });

  const files = (await fs.readdir(SOURCE_DIR)).filter((f) =>
    f.toLowerCase().endsWith(".jpg")
  );

  console.log(`Ditemukan ${files.length} foto sumber di ${SOURCE_DIR}`);

  let heroCount = 0;
  const galleryManifest = [];
  let galleryIndex = 1;

  for (const file of files) {
    const srcPath = path.join(SOURCE_DIR, file);

    if (EXCLUDE.has(file)) continue;

    if (HERO_MAP[file]) {
      const destBase = path.join(HERO_DIR, HERO_MAP[file]);
      const size = await processOne(srcPath, destBase, 1600, 80, HERO_MAP[file]);
      console.log(`[hero] ${HERO_MAP[file]} <- ${file} (${(size / 1024).toFixed(0)}KB)`);
      heroCount++;
      continue;
    }

    const name = `gallery-${String(galleryIndex).padStart(3, "0")}`;
    const destBase = path.join(GALLERY_DIR, name);
    const size = await processOne(srcPath, destBase, 1000, 75);
    galleryManifest.push({
      jpg: `assets/img/gallery/${name}.jpg`,
      webp: `assets/img/gallery/${name}.webp`
    });
    galleryIndex++;
  }

  for (const [file, key] of Object.entries(ENGAGEMENT_HERO)) {
    const srcPath = path.join(ENGAGEMENT_DIR, file);
    const destBase = path.join(HERO_DIR, key);
    const size = await processOne(srcPath, destBase, 1400, 80);
    console.log(`[hero] ${key} <- ENGAGAMENT/${file} (${(size / 1024).toFixed(0)}KB)`);
    heroCount++;
  }

  for (const file of ENGAGEMENT_GALLERY) {
    const srcPath = path.join(ENGAGEMENT_DIR, file);
    const name = `gallery-${String(galleryIndex).padStart(3, "0")}`;
    const destBase = path.join(GALLERY_DIR, name);
    await processOne(srcPath, destBase, 1000, 75);
    galleryManifest.push({
      jpg: `assets/img/gallery/${name}.jpg`,
      webp: `assets/img/gallery/${name}.webp`
    });
    galleryIndex++;
  }

  await fs.writeFile(
    path.join(GALLERY_DIR, "manifest.json"),
    JSON.stringify(galleryManifest, null, 2)
  );

  console.log(`Selesai. Hero: ${heroCount}, Galeri: ${galleryManifest.length} foto.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
