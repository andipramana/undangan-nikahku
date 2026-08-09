/** Layout Galeri — satu source-of-truth untuk guest, Tab Foto, dan modal pan/zoom.
 * Layout disimpan per foto sebagai `gallery_layout`: full / half / third / twothirds.
 * Invitation lama tanpa nilai tetap memakai pola legacy berdasarkan indeks. */
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
  function shapeAt(index, photo) { return normalize(photo?.galleryLayout || photo?.gallery_layout) || LEGACY_PATTERN[index] || "full"; }
  function ratioAt(index, photo) {
    const span = SPAN[shapeAt(index, photo)];
    return (span * COL + (span - 1) * GAP) / ROW_HEIGHT;
  }
  function rowAt(index, photo) {
    const explicit = Number(photo?.galleryRow || photo?.gallery_row);
    if (Number.isInteger(explicit) && explicit >= 1) return explicit;
    // Invitation lama: turunkan baris dari pola legacy yang mengisi 12 kolom.
    let row = 1, used = 0;
    for (let i = 0; i <= index; i++) {
      const span = SPAN[shapeAt(i)];
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
    labelAt: (index, photo) => LABEL[shapeAt(index, photo)],
    choices: Object.entries(LABEL).map(([value, label]) => ({ value, label }))
  };
})();
