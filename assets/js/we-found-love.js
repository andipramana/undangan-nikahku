/** Section "We Found Love": kertas lipat 3D full-screen (classic-elegance).
 * Foto dari payload Supabase (folder 'wfl'), cadangan manifest lokal kalau
 * payload tidak tersedia.
 *
 * Tampilan: SATU foto (sort_order awal dari folder wfl) DIPOTONG-POTONG
 * menyebar ke 7 flap — trik jigsaw referensi CodePen: tiap flap menampilkan
 * potongan yang berbeda dari gambar yang sama, dirender di kanvas layar yang
 * sama (background-size seragam + background-position terhitung), sehingga
 * begitu semua flap terbuka penuh, potongan-potongannya menyatu jadi SATU
 * gambar utuh tanpa jahitan.
 *
 * Koreografi (CSS transition-delay bertingkat, JS cuma toggle SATU class):
 *   Tahap 1 (rotateX, "buka jadi kotak"): flap1 (cover) lipat turun ke bawah,
 *     flap2 (2 baris) turun dari lipatan atas menempati baris 0-1.
 *   Tahap 2 (rotateY, "melebar jadi persegi panjang"): pintu ganda kiri-kanan
 *     (flap3/flap4, engsel kiri/kanan) berayun ke belakang, menampakkan panel
 *     tengah (flap5, baris 2-3).
 *   Tahap 3 (rotateX, lanjut turun): flap6/flap7 membuka akordeon ke bawah
 *     sampai memenuhi TINGGI PENUH layar.
 *
 * Setelah flap terakhir selesai (transitionend), .wfl-quote--revealed
 * menampilkan ayat Quran di TENGAH layar. prefers-reduced-motion: langsung
 * state akhir. */
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

  // --- Definisi flap: baris yang ditempati (0-5), kelas gerak, posisi DOM ---
  // Urutan array = urutan tumpukan (z): flap yang menutupi dipasang BELAKANG
  // (flap1 di atas flap2; flap5 di belakang pintu flap3/flap4).
  const DEFS = [
    { rows: [0], cls: "wfl-fold-panel--f1", half: false }, // cover, buka lipat ke bawah
    { rows: [0, 1], cls: "wfl-fold-panel--f2", half: false, title: true }, // kotak, turun dari atas
    { rows: [2, 3], cls: "wfl-fold-panel--f5", half: false }, // panel tengah (di belakang pintu)
    { rows: [2, 3], cls: "wfl-fold-panel--f3", half: true }, // pintu kiri
    { rows: [2, 3], cls: "wfl-fold-panel--f4", half: true }, // pintu kanan
    { rows: [4], cls: "wfl-fold-panel--f6", half: false }, // akordeon 1
    { rows: [5], cls: "wfl-fold-panel--f7", half: false } // akordeon 2 (terakhir)
  ];

  // --- Geometri jigsaw: gambar dirender ke kanvas layar dengan cover ---
  // scale s = max(Wv/W, Hv/H); gambar ter-render (Sw x Sh); offset centering
  // (xOff, yOff). Tiap flap menampilkan window gambar [x-xOff, y-yOff, w, h]
  // via background-size seragam + background-position px — konsisten antar
  // panel, jadi potongan menyambung persis tanpa gap/tumpang-tindih.
  const layout = () => {
    const Wv = fold.clientWidth;
    const Hv = fold.clientHeight;
    const h = Hv / 6;
    const s = Math.max(Wv / W, Hv / H);
    const Sw = W * s;
    const Sh = H * s;
    return { Wv, Hv, h, Sw, Sh, xOff: (Wv - Sw) / 2, yOff: (Hv - Sh) / 2 };
  };

  const applyPanel = (el, rows, half, L) => {
    const y = rows[0] * L.h;
    const ph = rows.length * L.h;
    const w = half ? L.Wv / 2 : L.Wv;
    const x = half ? L.Wv / 2 : 0; // pintu kanan; pintu kiri di-override di bawah
    el.style.left = (half && el.dataset.side === "left" ? 0 : x) + "px";
    el.style.top = y + "px";
    el.style.width = (half && el.dataset.side === "left" ? L.Wv / 2 : w) + "px";
    el.style.height = ph + "px";
    el.style.backgroundSize = L.Sw + "px " + L.Sh + "px";
    const px = half && el.dataset.side === "left" ? 0 : x;
    // Semantik background-position: Xpx => tepi kiri gambar di koordinat X
    // elemen. Window gambar yang diinginkan mulai di (px - xOff) dalam ruang
    // gambar ter-scale, jadi X = xOff - px (bukan px - xOff).
    el.style.backgroundPosition = (L.xOff - px) + "px " + (L.yOff - y) + "px";
  };

  const buildPanels = () => {
    fold.innerHTML = "";
    const L = layout();
    DEFS.forEach((d) => {
      const el = document.createElement("div");
      el.className = "wfl-fold-panel " + d.cls;
      el.dataset.rows = d.rows.join(",");
      el.dataset.half = d.half ? "1" : "0";
      if (d.half && d.cls.includes("f3")) el.dataset.side = "left";
      el.style.backgroundImage = 'url("' + src + '")';
      el.style.backgroundRepeat = "no-repeat";
      applyPanel(el, d.rows, d.half, L);
      if (d.title) {
        const title = document.createElement("span");
        title.className = "wfl-fold-title";
        title.textContent = "We Found Love";
        el.appendChild(title);
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
    fold.querySelectorAll(".wfl-fold-panel").forEach((el) => {
      const rows = el.dataset.rows.split(",").map(Number);
      applyPanel(el, rows, el.dataset.half === "1", L);
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

  const quoteWrap = document.getElementById("wfl-quote-wrap");

  // prefers-reduced-motion: langsung posisi akhir + teks ayat tanpa animasi.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    fold.classList.add("wfl-fold--no-anim", "wfl-fold--open");
    if (quoteWrap) quoteWrap.classList.add("wfl-quote--revealed");
    return;
  }

  // Ayat muncul SETELAH lipatan terakhir selesai — ditunggu lewat
  // transitionend transform di flap terakhir, bukan timer tebakan.
  const lastPanel = fold.querySelector(".wfl-fold-panel--f7");
  let revealed = false;
  const revealQuote = () => {
    if (revealed || !quoteWrap) return;
    revealed = true;
    quoteWrap.classList.add("wfl-quote--revealed");
  };
  if (lastPanel) {
    lastPanel.addEventListener("transitionend", (e) => {
      if (e.propertyName === "transform") revealQuote();
    });
  }

  const section = document.getElementById("we-found-love");
  if (!section) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect(); // sekali terbuka, selamanya terbuka
        fold.classList.add("wfl-fold--open");
      }
    },
    { threshold: 0.25 }
  );
  observer.observe(section);
};
