import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const SRC = "C:\\Users\\andi.pramana\\Documents\\MEITU";
const OUT = path.resolve("verification-output");
const TILE = 180;
const COLS = 9;

const files = (await fs.readdir(SRC)).filter((f) => f.toLowerCase().endsWith(".jpg")).sort();
const rows = Math.ceil(files.length / COLS);

const thumbs = [];
for (const f of files) {
  const buf = await sharp(path.join(SRC, f)).rotate().resize(TILE, TILE, { fit: "cover" }).jpeg({ quality: 60 }).toBuffer();
  thumbs.push({ file: f, buf });
}

const composite = thumbs.map((t, i) => ({
  input: t.buf,
  left: (i % COLS) * TILE,
  top: Math.floor(i / COLS) * TILE
}));

await sharp({
  create: { width: COLS * TILE, height: rows * TILE, channels: 3, background: "#222" }
})
  .composite(composite)
  .jpeg({ quality: 70 })
  .toFile(path.join(OUT, "contact-sheet.jpg"));

console.log(files.map((f, i) => `${i}: ${f}`).join("\n"));
console.log(`\nGrid: ${COLS} kolom x ${rows} baris -> contact-sheet.jpg`);
