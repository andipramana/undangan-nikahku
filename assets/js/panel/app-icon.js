/* Ikon aplikasi undangan — dari satu gambar unggahan client menjadi empat
 * ukuran, lalu diunggah ke Storage.
 *
 * Dipakai halaman Pengaturan. Hasilnya dibaca halaman tamu (assets/js/pwa.js)
 * untuk ikon tab browser dan ikon saat undangan dipasang ke layar utama HP.
 *
 * Kenapa empat berkas, bukan satu:
 *  - icon-192 / icon-512  → "any": gambar apa adanya, transparansi dipertahankan.
 *  - icon-maskable-512    → Android memotong ikon jadi lingkaran/squircle. Isinya
 *                           dikecilkan ke zona aman di atas warna latar, kalau
 *                           tidak sisi gambar ikut terpotong.
 *  - apple-touch-icon     → iOS mengisi area transparan dengan HITAM, jadi dilukis
 *                           di atas warna latar penuh.
 *
 * Berkas harus URL publik sungguhan (bukan blob/data): Chrome Android meminta
 * server WebAPK mengunduh ikon dari URL-nya saat undangan dipasang.
 */
(function () {
  "use strict";

  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
  const MIN_SIDE = 192;
  const SAFE_ZONE = 0.76;      // isi ikon maskable ≤ 80% tengah (spesifikasi), sedikit di bawahnya
  const FILES = ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

  function canvas(n) {
    const c = document.createElement("canvas");
    c.width = c.height = n;
    return c;
  }
  function toBlob(c) {
    return new Promise((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar ikon."))), "image/png"));
  }

  /** Lukis gambar ke kanvas n×n, dipotong persegi dari tengah. `inset` = bagian
   * sisi yang dipakai gambar (1 = penuh, 0.76 = zona aman maskable). */
  function drawCover(ctx, bmp, n, inset) {
    const side = Math.min(bmp.width, bmp.height);
    const sx = (bmp.width - side) / 2;
    const sy = (bmp.height - side) / 2;
    const size = n * inset;
    const off = (n - size) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, sx, sy, side, side, off, off, size, size);
  }

  /** Warna latar: rata-rata empat sudut gambar yang tidak transparan; kalau
   * semuanya transparan, putih. */
  function cornerColor(bmp) {
    const probe = canvas(32);
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    drawCover(ctx, bmp, 32, 1);
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of [[1, 1], [30, 1], [1, 30], [30, 30]]) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[3] < 128) continue;
      r += d[0]; g += d[1]; b += d[2]; n++;
    }
    return n ? `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : "#ffffff";
  }

  async function decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_) {
      // Safari lama: createImageBitmap tanpa opsi / format tak dikenali.
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return await createImageBitmap(img);
      } finally { URL.revokeObjectURL(url); }
    }
  }

  /** File gambar → { "icon-192.png": Blob, ... }. Melempar Error berpesan
   * Indonesia kalau file tak layak (tipe, ukuran, terlalu kecil). */
  async function buildSet(file) {
    if (!file || !ALLOWED.includes(file.type)) throw new Error("Ikon harus berupa gambar PNG, JPG, atau WebP.");
    if (file.size > MAX_BYTES) throw new Error("Ukuran ikon maksimal 5 MB.");
    let bmp;
    try { bmp = await decode(file); } catch (_) { throw new Error("Gambar tidak bisa dibaca. Coba berkas lain."); }
    if (Math.min(bmp.width, bmp.height) < MIN_SIDE) {
      throw new Error(`Gambar terlalu kecil (${bmp.width}×${bmp.height}). Minimal ${MIN_SIDE}×${MIN_SIDE}, idealnya 512×512 atau lebih.`);
    }

    const bg = cornerColor(bmp);
    const any = (n) => { const c = canvas(n); drawCover(c.getContext("2d"), bmp, n, 1); return c; };

    const maskable = canvas(512);
    { const ctx = maskable.getContext("2d"); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 512); drawCover(ctx, bmp, 512, SAFE_ZONE); }

    const apple = canvas(180);
    { const ctx = apple.getContext("2d"); ctx.fillStyle = bg; ctx.fillRect(0, 0, 180, 180); drawCover(ctx, bmp, 180, 1); }

    const out = {
      "icon-192.png": await toBlob(any(192)),
      "icon-512.png": await toBlob(any(512)),
      "icon-maskable-512.png": await toBlob(maskable),
      "apple-touch-icon.png": await toBlob(apple)
    };
    bmp.close && bmp.close();
    return out;
  }

  function dir() { return `${window.AdminAPI.tenant.slug}/icons`; }

  /** Unggah keempat berkas ke <slug>/icons/ (menimpa yang lama). Nama berkas
   * tetap supaya tak ada sampah menumpuk; versi di URL yang membuang cache. */
  async function upload(set) {
    const sb = window.AdminAPI.sb;
    for (const name of FILES) {
      const { error } = await sb.storage.from("photos").upload(`${dir()}/${name}`, set[name], {
        contentType: "image/png", upsert: true, cacheControl: "3600"
      });
      if (error) return { error };
    }
    return { error: null, path: dir(), version: Date.now() };
  }

  /** Hapus ikon unggahan (best-effort; gagal tidak menggagalkan penyimpanan). */
  async function removeAll() {
    try { await window.AdminAPI.sb.storage.from("photos").remove(FILES.map((n) => `${dir()}/${n}`)); } catch (_) { /* abaikan */ }
  }

  window.PanelAppIcon = { buildSet, upload, removeAll, FILES, MIN_SIDE, MAX_BYTES };
})();
