/** Layout Galeri — satu source-of-truth untuk guest, Tab Foto, dan modal pan/zoom.
 * Lebar tiap foto dipilih admin ("Lebar": full/half/third/twothirds, disimpan
 * `gallery_layout`) — foto lama tanpa nilai memakai pola legacy berdasarkan
 * indeks. BARIS TIDAK LAGI diinput manual (kolom `gallery_row` sudah tidak
 * dibaca) — baris SELALU dihitung otomatis dari urutan (posisi/index, diatur
 * lewat drag/arrow di Tab Foto, sama seperti folder lain) + lebar tiap foto,
 * dipaketkan berurutan mengisi 12 kolom persis seperti pola legacy, hanya
 * saja sekarang memakai lebar ASLI tiap foto alih-alih pola hardcode. */
(function () {
  const LEGACY_PATTERN = [
    "full", "half", "half", "full", "third", "twothirds", "full",
    "half", "half", "full", "full", "half", "half", "full",
    "third", "twothirds", "full", "half", "half", "full"
  ];
  const SPAN = { full: 12, twothirds: 8, half: 6, third: 4 };
  const LABEL = {
    full: "1/1 — selebar grid", half: "1/2 lebar", third: "1/3 lebar", twothirds: "2/3 lebar"
  };
  const COLUMNS = 12, GAP = 8, MAX_WIDTH = 720, ROW_HEIGHT = 450;
  const COL = (MAX_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;
  function normalize(value) { return SPAN[value] ? value : ""; }
  // `list` = array LENGKAP foto dalam urutan tampil (sort_order) — index harus
  // selaras dengan posisinya di array itu, dipakai rowAt untuk memaketkan
  // kumulatif dari foto ke-0 sampai ke-index.
  function shapeAt(index, list) {
    const photo = Array.isArray(list) ? list[index] : list;
    return normalize(photo?.galleryLayout || photo?.gallery_layout) || LEGACY_PATTERN[index] || "full";
  }
  function ratioAt(index, list) {
    const span = SPAN[shapeAt(index, list)];
    return (span * COL + (span - 1) * GAP) / ROW_HEIGHT;
  }
  function rowAt(index, list) {
    const arr = Array.isArray(list) ? list : [list];
    let row = 1, used = 0;
    for (let i = 0; i <= index; i++) {
      const span = SPAN[shapeAt(i, arr)];
      if (used && used + span > COLUMNS) { row++; used = 0; }
      if (i === index) return row;
      used += span;
      if (used === COLUMNS) { row++; used = 0; }
    }
    return row;
  }
  window.GalleryLayout = {
    // Alias legacy: gallery.js/reveal motion versi lama masih membacanya.
    PATTERN: LEGACY_PATTERN,
    LEGACY_PATTERN, SPAN, shapeAt, ratioAt, rowAt,
    labelAt: (index, list) => LABEL[shapeAt(index, list)],
    choices: Object.entries(LABEL).map(([value, label]) => ({ value, label }))
  };
})();
