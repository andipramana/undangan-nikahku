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

    const out = await compose((ctx, n, inset) => drawCover(ctx, bmp, n, inset), cornerColor(bmp));
    bmp.close && bmp.close();
    return out;
  }

  /** Empat ukuran dari satu fungsi gambar. `draw(ctx, n, inset)` melukis ke
   * kanvas n×n memakai `inset` (bagian sisi yang dipakai; 1 = penuh). */
  async function compose(draw, bg) {
    const any = (n) => { const c = canvas(n); draw(c.getContext("2d"), n, 1); return c; };

    const maskable = canvas(512);
    { const ctx = maskable.getContext("2d"); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 512); draw(ctx, 512, SAFE_ZONE); }

    const apple = canvas(180);
    { const ctx = apple.getContext("2d"); ctx.fillStyle = bg; ctx.fillRect(0, 0, 180, 180); draw(ctx, 180, 1); }

    return {
      "icon-192.png": await toBlob(any(192)),
      "icon-512.png": await toBlob(any(512)),
      "icon-maskable-512.png": await toBlob(maskable),
      "apple-touch-icon.png": await toBlob(apple)
    };
  }

  /* ── Ikon monogram dari inisial (templat: assets/icons/monogram-template.svg) ──
     Desain ada di satu berkas SVG yang bisa diedit; di sini hanya dua huruf yang
     diganti. SVG dirender sebagai gambar, dan gambar semacam itu TIDAK bisa
     memuat font dari berkas lain — jadi fontnya disematkan (data URL) supaya
     huruf tampil sama di semua perangkat, bukan "Georgia kalau ada". */
  const TEMPLATE_URL = "assets/icons/monogram-template.svg";
  const FONT_URL = "assets/fonts/eb-garamond/eb-garamond-600.woff2";
  let templateP = null;
  let fontP = null;

  function templateText() {
    return (templateP = templateP || fetch(TEMPLATE_URL).then((r) => {
      if (!r.ok) throw new Error("Templat ikon tidak ditemukan.");
      return r.text();
    }));
  }
  function fontBase64() {
    return (fontP = fontP || fetch(FONT_URL).then((r) => {
      if (!r.ok) throw new Error("Font ikon tidak ditemukan.");
      return r.arrayBuffer();
    }).then((buf) => {
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }));
  }

  /** Huruf pertama (huruf/angka) sebuah nama, kapital; null kalau tak ada. */
  function firstLetter(name) {
    const m = String(name || "").trim().match(/[\p{L}\p{N}]/u);
    return m ? m[0].toLocaleUpperCase("id") : null;
  }
  const PLACEHOLDER = /^Mempelai (Pria|Wanita)$/i;

  /** Huruf ikon bawaan: huruf depan nama panggilan CPP lalu CPW, mis. "AM"
   * untuk Andi & Mita. null kalau salah satu nama belum diisi (masih bawaan
   * "Mempelai Pria/Wanita") — ikon netral lebih baik daripada huruf "MM". */
  function deriveLetters(content) {
    const c = content || (window.PanelStore && window.PanelStore.getContent()) || {};
    const pick = (p) => {
      const nm = String((p && (p.nickname || p.name)) || "").trim();
      return !nm || PLACEHOLDER.test(nm) ? null : firstLetter(nm);
    };
    const groom = pick(c.couple && c.couple.groom);
    const bride = pick(c.couple && c.couple.bride);
    return groom && bride ? groom + bride : null;
  }

  /** Dua huruf → empat berkas ikon. Melempar Error kalau huruf tak valid. */
  async function buildMonogramSet(letters) {
    const chars = Array.from(String(letters || ""));
    if (chars.length !== 2 || !chars.every((ch) => /[\p{L}\p{N}]/u.test(ch))) {
      throw new Error("Isi satu huruf untuk CPP dan satu huruf untuk CPW.");
    }
    const [svgText, font] = await Promise.all([templateText(), fontBase64()]);
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const texts = doc.querySelectorAll("text");
    if (texts.length < 2) throw new Error("Templat ikon tidak valid.");
    texts[0].textContent = chars[0].toLocaleUpperCase("id");
    texts[1].textContent = chars[1].toLocaleUpperCase("id");
    texts[0].parentNode.setAttribute("font-family", "'WC Serif', serif");
    const style = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = "@font-face{font-family:'WC Serif';font-weight:700;src:url(data:font/woff2;base64," + font + ") format('woff2')}";
    doc.documentElement.insertBefore(style, doc.documentElement.firstChild);

    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(doc));
    await img.decode();
    const bgEl = doc.querySelector("rect");
    const bg = (bgEl && bgEl.getAttribute("fill")) || "#ffffff";
    return compose((ctx, n, inset) => {
      const size = n * inset;
      const off = (n - size) / 2;
      ctx.drawImage(img, off, off, size, size);
    }, bg);
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

  /** Jaga ikon bawaan tetap sesuai nama. Dipanggil saat panel dibuka dan setiap
   * kali data mempelai tersimpan. Hanya menyentuh ikon yang kita buat sendiri
   * (source "auto") dan belum diatur manual (custom); ikon unggahan client atau
   * hurufnya yang sudah diubah tangan tidak pernah ditimpa. Gagal diam-diam:
   * ini perawatan latar belakang, bukan aksi yang diminta pengguna. */
  let syncing = false;
  async function syncAuto() {
    if (syncing || !window.PanelStore || !window.AdminAPI || !window.AdminAPI.tenant.invitationId) return;
    const letters = deriveLetters();
    if (!letters) return;
    const cur = window.PanelStore.getContent().appIcon;
    if (cur && (cur.source === "upload" || cur.custom)) return;
    if (cur && cur.source === "auto" && cur.letters === letters) return;
    syncing = true;
    try {
      const set = await buildMonogramSet(letters);
      const up = await upload(set);
      if (up.error) throw up.error;
      window.PanelStore.set("appIcon", { path: up.path, version: up.version, source: "auto", letters, custom: false });
      const { error } = await window.PanelStore.save(["appIcon"]);
      if (error) throw error;
    } catch (err) {
      console.warn("Ikon otomatis dari inisial tidak dibuat:", err && err.message ? err.message : err);
    } finally { syncing = false; }
  }

  window.PanelAppIcon = { buildSet, buildMonogramSet, deriveLetters, firstLetter, syncAuto, upload, removeAll, FILES, MIN_SIDE, MAX_BYTES };
})();
