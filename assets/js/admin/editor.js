/**
 * Editor pan/zoom satu foto. Pratinjau memakai RASIO BINGKAI SAMA PERSIS
 * dengan tempat foto itu dipakai di undangan (lihat rasio per folder di
 * FOLDER_RATIO) — yang dilihat admin di sini sama dengan yang dilihat tamu.
 *
 * Seret untuk menggeser (focalX/focalY), slider untuk zoom. Nilai baru hanya
 * ditulis ke DB saat tombol "Simpan" ditekan.
 *
 * Catatan matematika pan: object-position x% berarti titik x% gambar
 * disejajarkan ke x% bingkai. Pergeseran objek di layar per 1% focal =
 * (lebar tampil × (zoom − 1)) / 100 piksel — itulah yang dipakai drag supaya
 * jari mengikuti foto, bukan mengikuti angka.
 */
(function () {
  const { sb, photoUrl, toast } = window.AdminAPI;

  // Rasio bingkai pratinjau — harus menyamai pemakaian asli di undangan:
  const FOLDER_RATIO = {
    cover: 9 / 19.5,   // layar HP penuh
    opening: 9 / 19.5,
    closing: 9 / 19.5,
    bride: 2 / 3,      // lebar layar × 75vh
    groom: 2 / 3,
    wfl: 1,            // 1:1
    // Kartu event: lebar min(96%, 720px), tinggi 90vh, slidernya 40% tinggi
    // kartu. Di HP 412x915 -> 396 / (0.4 x 0.9 x 915) = 396/329 ~= 1.2.
    // (9/4 = 2.25 yang dipakai sebelumnya membuat pratinjau jauh lebih pipih
    // dari tampilan sebenarnya, jadi hasil crop-nya menyesatkan.)
    event: 1.2,
    // gallery TIDAK dipakai dari sini — bentuk kotaknya berbeda-beda per posisi
    // (selebar grid / 3-4 / 1-2 / 1-4), lihat ratioFor() di bawah. Nilai ini
    // hanya cadangan kalau indeksnya tidak diketahui.
    gallery: 16 / 10,
    quote: 1,          // 1:1
    story: 16 / 10,
    gift_item: 1       // kartu kado 1:1
  };

  let item = null;   // baris photos yang sedang diedit
  let folder = "";
  let ratio = 1;
  let zoom = 1;

  window.PhotoEditor = { open };

  /** Rasio bingkai pratinjau. Semua folder punya satu bentuk tetap, KECUALI
   * galeri: di sana tiap foto menempati kotak yang berbeda tergantung
   * posisinya dalam grid — foto di kotak 1/4 itu sempit dan tinggi, jadi
   * pemotongan kiri-kanannya justru paling parah dan paling perlu digeser.
   * Memakai satu rasio 16/10 untuk semuanya membuat pratinjau di sini tidak
   * ada hubungannya dengan yang benar-benar tampil di undangan. */
  function ratioFor(folderName, index) {
    if (folderName === "gallery" && window.GalleryLayout && Number.isInteger(index)) {
      return window.GalleryLayout.ratioAt(index);
    }
    return FOLDER_RATIO[folderName] || 1;
  }

  function open(photo, folderName, index) {
    item = photo;
    folder = folderName;
    ratio = ratioFor(folderName, index);
    zoom = Number(photo.zoom) || 1;

    // Beri tahu bentuk kotak yang sedang diatur — di galeri, bentuk ini ikut
    // berubah kalau urutan fotonya diubah.
    const shape =
      folderName === "gallery" && window.GalleryLayout && Number.isInteger(index)
        ? ` — kotak ${window.GalleryLayout.labelAt(index)}`
        : "";
    const hint = document.querySelector(".editor__hint");
    if (hint) hint.textContent = `Seret foto untuk menggeser (pan)${shape}`;

    const overlay = document.getElementById("editor");
    const img = document.getElementById("editor-img");
    img.src = photoUrl(photo.storage_path);
    img.alt = photo.alt || "";
    applyFocal(Number(photo.focal_x) || 50, Number(photo.focal_y) || 50);

    const slider = document.getElementById("editor-zoom");
    slider.value = String(zoom);
    document.getElementById("editor-zoom-value").textContent = zoom.toFixed(2) + "×";

    // Urutan penting: tampilkan DULU, baru ukur. Selagi overlay masih
    // display:none, panel.clientWidth bernilai 0 sehingga fitPreview()
    // menghasilkan lebar negatif dan bingkainya kolaps jadi segaris.
    overlay.hidden = false;
    fitPreview();
  }

  /** Ukur pratinjau agar rasio folder pas di layar tanpa overflow: lebar
   * dibatasi panel, tinggi dibatasi viewport. */
  function fitPreview() {
    const preview = document.getElementById("editor-preview");
    const panel = document.querySelector(".editor__panel");
    const maxW = panel.clientWidth - 32;
    const maxH = window.innerHeight * 0.55;
    const w = Math.min(maxW, maxH * ratio);
    const h = w / ratio;
    preview.style.width = w + "px";
    preview.style.height = h + "px";
  }

  function applyFocal(fx, fy) {
    const img = document.getElementById("editor-img");
    img.style.objectPosition = `${fx}% ${fy}%`;
    img.dataset.fx = String(fx);
    img.dataset.fy = String(fy);
  }

  // -------------------------------------------------------------------------
  // Zoom slider
  // -------------------------------------------------------------------------
  document.getElementById("editor-zoom").addEventListener("input", (e) => {
    zoom = Number(e.target.value);
    document.getElementById("editor-img").style.transform = `scale(${zoom})`;
    document.getElementById("editor-zoom-value").textContent = zoom.toFixed(2) + "×";
  });

  // -------------------------------------------------------------------------
  // Drag untuk pan (mouse + sentuh via pointer events)
  // -------------------------------------------------------------------------
  const preview = document.getElementById("editor-preview");
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  /** Berapa piksel LAYAR yang tergeser untuk tiap 1% perubahan focal, per sumbu.
   *
   * object-fit: cover sudah memotong gambar bahkan saat zoom = 1 — jadi ruang
   * geser ADA sejak zoom 1, dan itu justru kebutuhan paling umum (memilih bagian
   * wajah yang tampil). Versi sebelumnya memakai rect × (zoom − 1) sehingga
   * ruangnya nol di zoom 1: seret tidak melakukan apa pun sampai admin
   * menaikkan zoom lebih dulu.
   *
   * Rumusnya: gambar di-cover dengan skala s lalu diperbesar lagi oleh
   * transform: scale(zoom) — ukuran ter-render sebenarnya jadi nw*s*zoom
   * dan nh*s*zoom, BUKAN (slack di zoom 1) × zoom. Bedanya penting: kalau
   * satu sumbu pas persis dengan bingkai di zoom 1 (slack = 0, sumbu itu
   * tidak bisa digeser sama sekali), mengalikan slack-nol itu dengan zoom
   * tetap menghasilkan nol untuk selamanya — sumbu itu terkunci walau sudah
   * di-zoom. Menghitung ukuran ter-render dulu (nw*s*zoom) baru dikurangi
   * bingkai membuat KEDUA sumbu ikut melebar begitu zoom naik, sesuai yang
   * terlihat di layar. */
  function panRange() {
    const img = document.getElementById("editor-img");
    const rect = preview.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return { x: 0, y: 0 };
    const s = Math.max(rect.width / nw, rect.height / nh); // skala object-fit: cover
    return {
      x: Math.max(0, nw * s * zoom - rect.width),
      y: Math.max(0, nh * s * zoom - rect.height)
    };
  }

  function onDragMove(e) {
    if (!dragging) return;
    // Selisih dihitung sendiri dari clientX/clientY, bukan e.movementX —
    // movementX tidak terisi untuk pointer sentuh di iOS Safari, jadi seret di
    // HP tidak akan menggerakkan apa pun.
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    const img = document.getElementById("editor-img");
    const range = panRange();
    let fx = Number(img.dataset.fx);
    let fy = Number(img.dataset.fy);
    // TANDA MINUS: object-position 100% menampilkan sisi KANAN gambar, jadi
    // menyeret foto ke kanan (dx positif) berarti ingin melihat sisi KIRI —
    // nilai focal harus TURUN. Tanpa minus, foto bergerak melawan jari.
    // Tiap sumbu dihitung sendiri: foto potret punya ruang geser vertikal
    // walau horizontalnya nol, dan sebaliknya.
    if (range.x > 0) fx = clamp(fx - (dx / range.x) * 100, 0, 100);
    if (range.y > 0) fy = clamp(fy - (dy / range.y) * 100, 0, 100);
    applyFocal(fx, fy);
  }

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    preview.classList.remove("dragging");
    try {
      preview.releasePointerCapture(e.pointerId);
    } catch (_) {}
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }

  preview.addEventListener("pointerdown", (e) => {
    // Jangan menyaring berdasarkan e.target === img: CSS memberi
    // `.editor__preview img { pointer-events: none }`, jadi sasaran pointer
    // SELALU .editor__preview dan tidak pernah <img> — syarat lama membuat
    // seret tidak pernah dimulai sama sekali.
    const img = document.getElementById("editor-img");
    // Gambar belum selesai dimuat: naturalWidth = 0 membuat panRange()
    // mengembalikan {0, 0} dan seret diam tanpa sebab yang terlihat —
    // di HP jaringan lambat, admin yang langsung menyeret segera mengira
    // seretnya rusak. Tunggu fotonya benar-benar tampil.
    if (!img.complete || !img.naturalWidth) return;
    // Foto yang pas persis dengan bingkai (tidak terpotong sama sekali di
    // zoom 1) memang tidak punya ruang geser — jelaskan lewat hint,
    // jangan membiarkan seret diam begitu saja.
    const range = panRange();
    if (!range.x && !range.y) {
      const hint = document.querySelector(".editor__hint");
      if (hint) hint.textContent = "Foto pas dengan bingkai — naikkan zoom dulu untuk bisa menggeser.";
      return;
    }
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      preview.setPointerCapture(e.pointerId);
    } catch (_) {}
    preview.classList.add("dragging");
    e.preventDefault();
    // pointermove dibaca dari WINDOW, bukan dari preview: dengan pointer
    // capture, sebagian browser (terutama WebView HP) berhenti meneruskan
    // event gerakan ke elemen asal — sementara event SELALU membubble ke
    // window. Mendengarkan di window membuat seret jalan apa pun quirk-nya.
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", endDrag);
    // pointercancel: sentuhan direbut browser (mis. gestur scroll) — tanpa
    // ini status dragging tersangkut menyala dan foto ikut bergerak tanpa
    // disentuh.
    window.addEventListener("pointercancel", endDrag);
  });

  // -------------------------------------------------------------------------
  // Reset & simpan
  // -------------------------------------------------------------------------
  document.getElementById("editor-reset").addEventListener("click", () => {
    zoom = 1;
    document.getElementById("editor-zoom").value = "1";
    document.getElementById("editor-zoom-value").textContent = "1.00×";
    document.getElementById("editor-img").style.transform = "scale(1)";
    applyFocal(50, 50);
  });

  document.getElementById("editor-save").addEventListener("click", async () => {
    const img = document.getElementById("editor-img");
    const btn = document.getElementById("editor-save");
    btn.disabled = true;
    const { error } = await sb
      .from("photos")
      .update({
        focal_x: Number(img.dataset.fx),
        focal_y: Number(img.dataset.fy),
        zoom
      })
      .eq("id", item.id);
    btn.disabled = false;
    if (error) {
      toast("Gagal menyimpan: " + error.message, true);
      return;
    }
    toast("Pan & zoom tersimpan ✓");
    document.getElementById("editor").hidden = true;
    if (window.PhotosPanel) window.PhotosPanel.load();
  });

  document.getElementById("editor-close").addEventListener("click", () => {
    document.getElementById("editor").hidden = true;
  });

  window.addEventListener("resize", () => {
    if (!document.getElementById("editor").hidden) fitPreview();
  });

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
})();
