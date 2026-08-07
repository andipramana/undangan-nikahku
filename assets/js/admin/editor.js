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
    gallery: 16 / 10,  // pola gallery.js (landscape; portrait 1:2 via toggle)
    quote: 1,          // 1:1
    story: 16 / 10
  };

  let item = null;   // baris photos yang sedang diedit
  let folder = "";
  let ratio = 1;
  let zoom = 1;

  window.PhotoEditor = { open };

  function open(photo, folderName) {
    item = photo;
    folder = folderName;
    ratio = FOLDER_RATIO[folderName] || 1;
    zoom = Number(photo.zoom) || 1;

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
   * Rumusnya: gambar di-cover dengan skala s, sisa yang terpotong = ukuran
   * ter-render − ukuran bingkai. transform: scale(zoom) tidak mengubah ruang
   * potong itu, hanya memperbesar tampilannya di layar — makanya dikali zoom. */
  function panRange() {
    const img = document.getElementById("editor-img");
    const rect = preview.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return { x: 0, y: 0 };
    const s = Math.max(rect.width / nw, rect.height / nh); // skala object-fit: cover
    return {
      x: Math.max(0, nw * s - rect.width) * zoom,
      y: Math.max(0, nh * s - rect.height) * zoom
    };
  }

  preview.addEventListener("pointerdown", (e) => {
    // Jangan menyaring berdasarkan e.target === img: CSS memberi
    // `.editor__preview img { pointer-events: none }`, jadi sasaran pointer
    // SELALU .editor__preview dan tidak pernah <img> — syarat lama membuat
    // seret tidak pernah dimulai sama sekali. Cukup pastikan pointernya
    // mendarat di dalam bingkai pratinjau.
    if (!document.getElementById("editor-img").src) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    preview.setPointerCapture(e.pointerId);
    preview.classList.add("dragging");
    e.preventDefault();
  });

  preview.addEventListener("pointermove", (e) => {
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
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    preview.classList.remove("dragging");
    try {
      preview.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }
  preview.addEventListener("pointerup", endDrag);
  // pointercancel: sentuhan direbut browser (mis. gestur scroll) — tanpa ini
  // status dragging tersangkut menyala dan foto ikut bergerak tanpa disentuh.
  preview.addEventListener("pointercancel", endDrag);

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
