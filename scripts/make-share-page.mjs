// Halaman statis /<slug>/index.html supaya link undangan client punya banner
// (preview WhatsApp/FB). GitHub Pages melayani /<slug>/ sebagai 404.html tanpa tag OG,
// dan crawler tidak menjalankan JS — jadi tiap client yang butuh banner dibuatkan
// salinan cangkang index.html dengan tag OG miliknya.
//
//   node scripts/make-share-page.mjs <slug> "<Judul>" "<deskripsi>" <gambar-di-assets/img/social>
import { readFile, writeFile, mkdir } from "node:fs/promises";

const [slug, title, description, image] = process.argv.slice(2);
if (!slug || !title || !description || !image) {
  console.error('Pakai: node scripts/make-share-page.mjs <slug> "<judul>" "<deskripsi>" <berkas-gambar>');
  process.exit(1);
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
let html = await readFile("index.html", "utf8");
const origin = "https://willcome.my.id";
const swap = (re, val) => {
  if (!re.test(html)) throw new Error(`Tag tidak ditemukan: ${re}`);
  html = html.replace(re, val);
};
swap(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
swap(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
swap(/<meta property="og:site_name" content="[^"]*">/, `<meta property="og:site_name" content="${esc(title)}">`);
swap(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${origin}/${slug}/">`);
swap(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
swap(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
swap(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${origin}/assets/img/social/${image}">`);
await mkdir(slug, { recursive: true });
await writeFile(`${slug}/index.html`, html);
console.log(`ok: ${slug}/index.html`);
