/** Tata letak grid galeri — SATU sumber kebenaran, dipakai dua halaman:
 *  - index.html (gallery.js) untuk merender grid,
 *  - admin.html (editor.js) untuk menentukan rasio bingkai pratinjau pan/zoom.
 *
 * Sebelumnya polanya terkunci di dalam gallery.js, sehingga panel admin tidak
 * bisa tahu bentuk kotak tiap foto dan memakai 16/10 untuk semuanya. Foto di
 * kotak 1/4 yang sempit-tinggi jadi dipratinjau sebagai kotak lebar, dan
 * hasil crop-nya meleset jauh dari yang sebenarnya tampil.
 *
 * PENTING: bentuk kotak ditentukan POSISI foto dalam folder, bukan sifat
 * fotonya. Mengubah urutan foto di panel admin otomatis mengubah bentuk kotak
 * yang ditempatinya — pan/zoom yang sudah diatur perlu ditinjau ulang. */
(function () {
  // Pola baris (20 foto): pola 7 baris diulang 2x, baris terakhir landscape penutup.
  const PATTERN = [
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "quarter",
    "threequarter",
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "landscape",
    "portrait",
    "portrait",
    "landscape",
    "quarter",
    "threequarter",
    "landscape",
    "portrait",
    "portrait",
    "landscape"
  ];

  // Berapa kolom (dari 4) yang ditempati tiap bentuk — sesuai .gallery-item--*
  // di style.css.
  const SPAN = { landscape: 4, threequarter: 3, portrait: 2, quarter: 1 };

  // Tetapan geometri grid, disalin dari .gallery-grid di style.css. Rasio
  // dihitung dari sini (bukan angka rasio yang ditulis tangan) supaya kalau
  // salah satu tetapan berubah, keempat rasionya ikut benar sendiri.
  const COLUMNS = 4;
  const GAP = 8; // .5rem
  const MAX_WIDTH = 720; // max-width .gallery-grid
  const ROW_HEIGHT = 450; // grid-auto-rows: min(450px, 60vw)

  const COL = (MAX_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;

  const LABEL = {
    landscape: "selebar grid",
    threequarter: "3/4 lebar",
    portrait: "1/2 lebar",
    quarter: "1/4 lebar — sempit & tinggi"
  };

  /** Bentuk kotak untuk foto ke-i (0-based) dalam folder galeri. */
  function shapeAt(i) {
    return PATTERN[i] || "landscape";
  }

  /** Rasio lebar:tinggi kotak yang benar-benar ditempati foto ke-i. */
  function ratioAt(i) {
    const span = SPAN[shapeAt(i)] || SPAN.landscape;
    return (span * COL + (span - 1) * GAP) / ROW_HEIGHT;
  }

  window.GalleryLayout = {
    PATTERN,
    shapeAt,
    ratioAt,
    labelAt: (i) => LABEL[shapeAt(i)] || ""
  };
})();
