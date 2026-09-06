/** Akses foto yang sadar-template.
 *
 * Tabel `photos` tetap KUMPULAN FILE BERSAMA: satu kali unggah, dipakai
 * template mana pun. Yang disimpan per-template adalah *foto mana dipakai di
 * slot mana beserta crop-nya* (content.templates[<id>].photos[<slot>]) —
 * karena tiap template butuh rasio & komposisi berbeda, crop yang pas untuk
 * cover potret template A belum tentu pas untuk cover lanskap template B.
 *
 * Kalau blok per-template belum ada (client baru, atau template yang belum
 * pernah disetel), fungsi ini jatuh ke urutan & crop bawaan dari tabel photos —
 * jadi template baru langsung tampil wajar tanpa admin menyetel apa pun dulu.
 */
(function () {
  "use strict";

  function baseList(slot) {
    const payload = window.__PHOTO_PAYLOAD;
    const arr = payload && Array.isArray(payload[slot]) ? payload[slot] : [];
    return arr;
  }

  /** Gabungkan foto dasar dengan override per-template (dicocokkan lewat id).
   * Override hanya membawa crop & urutan — url/alt tetap dari tabel photos,
   * supaya mengganti file foto di admin otomatis terbawa ke semua template. */
  function forSlot(slot, tplBlock) {
    const base = baseList(slot);
    const byId = new Map(base.map((p) => [String(p.id), p]));
    const overrides = tplBlock && tplBlock.photos && Array.isArray(tplBlock.photos[slot])
      ? tplBlock.photos[slot]
      : null;

    const source = overrides
      // Override menentukan urutan DAN mana yang dipakai; entri yang fotonya
      // sudah dihapus di admin dilewati begitu saja (bukan error).
      ? overrides.map((o) => {
          const p = byId.get(String(o.id));
          return p ? { ...p, ...o } : null;
        }).filter(Boolean)
      : base;

    return source.map((p) => ({
      id: p.id,
      path: p.path,
      url: window.photoUrl ? window.photoUrl(p.path) : p.path,
      alt: p.alt || "",
      focalX: p.focalX ?? 50,
      focalY: p.focalY ?? 50,
      zoom: p.zoom ?? 1,
      layout: p.layout || p.galleryLayout || "full",
      row: p.row || p.galleryRow || 1,
      width: p.width || null,
      height: p.height || null
    }));
  }

  /** Style inline pan/zoom — dipakai template lewat ctx, supaya rumus
   * --fx/--fy/--zoom-nya sama di semua template dan tidak salin-tempel. */
  function panStyle(photo) {
    if (!photo) return "";
    return `--fx:${photo.focalX}%; --fy:${photo.focalY}%; --zoom:${photo.zoom}`;
  }

  window.WeddingPhotos = { forSlot, panStyle };
})();
