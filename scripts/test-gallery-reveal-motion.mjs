/**
 * motionFor() di gallery.js menentukan arah slide reveal foto galeri dari
 * POSISI (kiri/kanan) dalam baris berisi dua foto. Bug nyata ditemukan dari
 * data live tenant root (baris 12: sort_order 16="twothirds" lalu
 * 17="third" — urutan KEBALIK dari asumsi umum third-dulu-baru-twothirds):
 * versi lama menentukan arah dari JENIS bentuknya langsung ("third" selalu
 * dianggap kiri, "twothirds" selalu dianggap kanan), jadi salah kalau admin
 * menaruh twothirds duluan. Test ini memakai gallery-layout.js & gallery.js
 * SUNGGUHAN (bukan re-implementasi logikanya di sini) supaya tidak bisa
 * basi diam-diam kalau salah satunya berubah lagi.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const galleryLayoutSource = await fs.readFile("assets/js/gallery-layout.js", "utf8");
const gallerySource = await fs.readFile("assets/js/gallery.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.setContent(`
    <div id="gallery-wrapper"></div>
    <div id="lightbox"><img id="lightbox-img"><button id="lightbox-close"></button></div>
  `);
  await page.evaluate(([galleryLayoutSrc, gallerySrc]) => {
    window.WEDDING_CONFIG = { galleryVideo: {} };
    window.photoUrl = (p) => p;
    window.revealScan = () => {};
    // Baris normal (third lalu twothirds, index 0-1) dan baris KEBALIK
    // (twothirds lalu third, index 2-3) — persis pola data live yang
    // memicu laporan bug ini.
    const photos = [
      { galleryLayout: "third", path: "a.webp" },
      { galleryLayout: "twothirds", path: "b.webp" },
      { galleryLayout: "twothirds", path: "c.webp" },
      { galleryLayout: "third", path: "d.webp" }
    ];
    window.getPhotos = async () => photos;
    // eslint-disable-next-line no-eval
    eval(galleryLayoutSrc);
    // eslint-disable-next-line no-eval
    eval(gallerySrc);
    window.initGallery();
  }, [galleryLayoutSource, gallerySource]);

  await page.waitForSelector(".gallery-item");
  const motions = await page.locator(".gallery-item").evaluateAll((els) => els.map((el) => el.dataset.reveal));

  const expected = [
    "slide-left",  // third, kiri (baris normal)
    "slide-right", // twothirds, kanan (baris normal)
    "slide-left",  // twothirds, kiri (baris kebalik — INI yang dulu salah)
    "slide-right"  // third, kanan (baris kebalik — INI yang dulu salah)
  ];
  if (JSON.stringify(motions) !== JSON.stringify(expected)) {
    throw new Error(`Arah reveal salah. Didapat: ${JSON.stringify(motions)}, harusnya: ${JSON.stringify(expected)}`);
  }

  console.log("PASS: arah reveal third/twothirds benar berdasarkan posisi aslinya, bukan jenis bentuknya (termasuk urutan kebalik).");
} finally {
  await browser.close();
}
