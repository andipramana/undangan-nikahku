/** Section "We Found Love": kertas lipat 3D full-screen (classic-elegance).
 * PORT dari prototipe example/fold/ (SUDAH terverifikasi visual: potongan
 * foto menyatu tanpa gap, rotasi wajar, BLEED/z-index final) — di sini cuma
 * ADAPTASI sumber data & trigger:
 *   - Foto: SATU foto (sort_order awal) dari folder 'wfl' (Supabase,
 *     fallback manifest lokal) DIPOTONG-POTONG menyebar ke semua flap —
 *     trik jigsaw referensi CodePen: tiap flap menampilkan potongan yang
 *     berbeda dari gambar yang sama, dirender di kanvas layar yang sama
 *     (background-size seragam + background-position terhitung), sehingga
 *     begitu semua flap terbuka penuh, potongan-potongannya menyatu jadi
 *     SATU gambar utuh tanpa jahitan.
 *   - Koreografi (CSS transition-delay bertingkat, JS cuma toggle SATU
 *     class): a (statis) -> b/c rotateX atas/bawah jadi strip 1x3 ->
 *     d/e rotateY kanan/kiri jadi 3x3 -> f/g rotateX bawah jadi full 3x9
 *     layar penuh.
 *   - Trigger: IntersectionObserver pada section, SEKALI saja
 *     (disconnect setelah trigger pertama — sekali reveal, selamanya
 *     reveal, tidak reset kalau di-scroll keluar-masuk ulang).
 *   - prefers-reduced-motion: langsung tampilkan state akhir (wash + ayat).
 * Setelah flap terakhir selesai (transitionend), .wfl-wash--revealed +
 * .wfl-quote--revealed menampilkan wash putih + ayat Quran di TENGAH
 * layar. */
window.initWeFoundLove = async function () {
  const fold = document.getElementById("wfl-fold");
  if (!fold) return;

  const photos = (await window.getPhotos("wfl")) || [];
  if (!photos.length) return;

  // --- SATU foto (sort_order awal) untuk semua flap ---
  const photo = photos[0];
  const src = photo.path && !photo.webp ? window.photoUrl(photo.path) : photo.webp || photo.jpg;
  const probe = new Image();
  probe.src = src;
  await probe.decode().catch(() => {});
  const W = probe.naturalWidth;
  const H = probe.naturalHeight;
  if (!W || !H) return;

  const wash = document.getElementById("wfl-wash");
  const quoteWrap = document.getElementById("wfl-quote-wrap");

  // --- Grid 3 kolom x 9 baris (PERSIS prototipe, jangan redesign) ---
  const COLS = 3, ROWS = 9;

  // col/row 0-indexed (col: 0=kiri,1=tengah,2=kanan; row: 0-8 atas-bawah).
  // hinge/axis/sign menentukan transform-origin + arah rotasi (folded -> flat).
  const DEFS = [
    // state awal: statis, selalu terlihat, TIDAK animasi.
    { id: "a", col: 1, row: 1, cspan: 1, rspan: 1, static: true },
    // fold1: atas dari state awal — engsel di bawah (nempel ke "a").
    { id: "b", col: 1, row: 0, cspan: 1, rspan: 1, axis: "X", origin: "bottom", from: -180 },
    // fold2: bawah dari state awal — engsel di atas.
    { id: "c", col: 1, row: 2, cspan: 1, rspan: 1, axis: "X", origin: "top", from: 180 },
    // fold3: kolom kanan, baris 1-3 — engsel di kiri (nempel strip tengah).
    { id: "d", col: 2, row: 0, cspan: 1, rspan: 3, axis: "Y", origin: "left", from: 180 },
    // fold4: kolom kiri, baris 1-3 — engsel di kanan.
    { id: "e", col: 0, row: 0, cspan: 1, rspan: 3, axis: "Y", origin: "right", from: -180 },
    // fold5: baris 4-6, lebar penuh — engsel di atas.
    { id: "f", col: 0, row: 3, cspan: 3, rspan: 3, axis: "X", origin: "top", from: 180 },
    // fold6: baris 7-9, lebar penuh — engsel di atas.
    { id: "g", col: 0, row: 6, cspan: 3, rspan: 3, axis: "X", origin: "top", from: 180 }
  ];

  // --- Geometri jigsaw: gambar dirender ke kanvas layar dengan cover ---
  // scale s = max(Wv/W, Hv/H); gambar ter-render (Sw x Sh); offset centering
  // (xOff, yOff). Tiap flap menampilkan window gambar [x-xOff, y-yOff, w, h]
  // via background-size seragam + background-position px — konsisten antar
  // panel, jadi potongan menyambung persis tanpa gap/tumpang-tindih.
  const layout = () => {
    const Wv = fold.clientWidth;
    const Hv = fold.clientHeight;
    const colW = Wv / COLS;
    const rowH = Hv / ROWS;
    const s = Math.max(Wv / W, Hv / H);
    const Sw = W * s;
    const Sh = H * s;
    return { Wv, Hv, colW, rowH, Sw, Sh, xOff: (Wv - Sw) / 2, yOff: (Hv - Sh) / 2 };
  };

  // Overlap tipis (px) di tepi kanan/bawah tiap panel — colW/rowH jarang
  // pas bilangan bulat (mis. viewport 390px / 3 = 130 pas, tapi /9 = 43.33),
  // dan browser membulatkan tiap elemen SENDIRI-SENDIRI ke pixel fisik
  // terdekat, jadi tanpa ini bisa muncul garis rambut kosong di antara
  // panel. left/top TETAP presisi (tidak dibulatkan) supaya potongan
  // gambar (background-position) tetap akurat; cuma width/height yang
  // sedikit dilebihkan menutupi celah.
  const BLEED = 2;

  const applyPanel = (el, d, L) => {
    const x = d.col * L.colW;
    const y = d.row * L.rowH;
    const w = d.cspan * L.colW;
    const h = d.rspan * L.rowH;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = (w + BLEED) + "px";
    el.style.height = (h + BLEED) + "px";
    el.style.backgroundSize = L.Sw + "px " + L.Sh + "px";
    // Semantik background-position: Xpx => tepi kiri gambar di koordinat X
    // elemen. Window gambar yang diinginkan mulai di (x - xOff) dalam ruang
    // gambar ter-scale, jadi X = xOff - x (bukan x - xOff).
    el.style.backgroundPosition = (L.xOff - x) + "px " + (L.yOff - y) + "px";
  };

  const buildPanels = () => {
    fold.innerHTML = "";
    const L = layout();
    DEFS.forEach((d) => {
      const el = document.createElement("div");
      el.className = "wfl-fold-panel wfl-fold-panel--" + d.id;
      el.style.backgroundImage = 'url("' + src + '")';
      applyPanel(el, d, L);
      if (!d.static) {
        el.style.transformOrigin =
          d.origin === "left" ? "left center" :
          d.origin === "right" ? "right center" :
          d.origin; // "top" / "bottom"
        // Custom property berisi FUNGSI transform lengkap (bukan cuma
        // angka) — CSS tidak bisa memilih rotateX/rotateY secara dinamis
        // dari satu var, jadi ditulis utuh dari sini.
        el.style.setProperty("--rot-from", "rotate" + d.axis + "(" + d.from + "deg)");
        el.style.setProperty("--rot-to", "rotate" + d.axis + "(0deg)");
      }
      fold.appendChild(el);
    });
  };

  buildPanels();

  // Resize (rotasi HP / resize window): perbarui geometri jigsaw tanpa
  // mereset koreografi yang sudah berjalan.
  let resizeTimer = null;
  const relayout = () => {
    const L = layout();
    if (L.Wv === 0 || L.Hv === 0) return; // belum di-layout, jangan timpa nilai nyata
    DEFS.forEach((d) => {
      const el = fold.querySelector(".wfl-fold-panel--" + d.id);
      if (el) applyPanel(el, d, L);
    });
  };
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 150);
  });

  // Konten di balik cover (is-locked) belum di-layout saat init: fold bisa
  // terukur 0x0 sehingga panel ikut 0x0. Begitu halaman terbuka (ukuran nyata
  // tersedia), terapkan geometri jigsaw yang sebenarnya.
  const ensureSize = () => {
    if (fold.clientWidth > 0 && fold.clientHeight > 0) {
      relayout();
      return;
    }
    requestAnimationFrame(ensureSize);
  };
  requestAnimationFrame(ensureSize);

  // prefers-reduced-motion: langsung posisi akhir + wash + ayat tanpa
  // animasi/observer (CSS media query menonaktifkan transition).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    fold.classList.add("wfl-fold--open");
    if (wash) wash.classList.add("wfl-wash--revealed");
    if (quoteWrap) quoteWrap.classList.add("wfl-quote--revealed");
    return;
  }

  // Koreografi: toggle SATU class .wfl-fold--open; wash + ayat muncul
  // SETELAH lipatan terakhir selesai — ditunggu lewat transitionend
  // transform di flap terakhir (g), bukan timer tebakan.
  const play = () => {
    if (wash) wash.classList.remove("wfl-wash--revealed");
    if (quoteWrap) quoteWrap.classList.remove("wfl-quote--revealed");
    // Matikan transisi sementara saat menutup: tanpa ini, panel dengan
    // transition-delay > 0 masih "flat" saat class --open dihapus (delay
    // menunda gerakannya), sehingga Chrome tidak melihat perubahan state
    // dan replay melompat instan. Render dulu state folded TANPA transisi,
    // pulihkan transisi, baru buka.
    const panels = fold.querySelectorAll(".wfl-fold-panel");
    panels.forEach((p) => (p.style.transition = "none"));
    fold.classList.remove("wfl-fold--open");
    void fold.offsetHeight; // force reflow: state folded ter-render penuh
    panels.forEach((p) => (p.style.transition = ""));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fold.classList.add("wfl-fold--open");
        const last = fold.querySelector(".wfl-fold-panel--g");
        const onEnd = (e) => {
          if (e.propertyName !== "transform") return;
          last.removeEventListener("transitionend", onEnd);
          if (wash) wash.classList.add("wfl-wash--revealed");
          if (quoteWrap) quoteWrap.classList.add("wfl-quote--revealed");
        };
        last.addEventListener("transitionend", onEnd);
      });
    });
  };

  // Trigger: begitu section masuk layar (threshold 0.25), buka SEKALI saja —
  // observer di-disconnect (pola reveal.js: sekali reveal, selamanya reveal).
  const section = document.getElementById("we-found-love");
  if (!section) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        play();
      }
    },
    { threshold: 0.25 }
  );
  observer.observe(section);
};
