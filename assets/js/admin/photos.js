/**
 * Tab Foto: daftar foto per folder dengan unggah, hapus, dan urutkan.
 *
 * - Unggahan dikonversi ke WebP di browser (canvas) sebelum dikirim, dan
 *   di-resize ke lebar maks per folder — angka dari TARGETS di
 *   scripts/compress-images.py (jangan diubah tanpa mengubah dua-duanya).
 * - Urutan disimpan EKSPLISIT (tombol "Simpan urutan") — drag/tombol di
 *   daftar hanya mengubah urutan DOM, belum menyentuh DB sampai disimpan.
 * - Folder slider Swiper loop (bride/groom/event/wfl) butuh >= 6 foto —
 *   tampilkan peringatan di bawah ambang itu (Swiper loop macet bila slide
 *   kurang dari jumlah yang dibutuhkan loop).
 */
(function () {
  const { sb, photoUrl, toast } = window.AdminAPI;

  const FOLDERS = [
    ["cover", "Cover (hero layar penuh)"],
    ["opening", "Opening / Save The Date"],
    ["closing", "Closing (penutup)"],
    ["bride", "Mempelai wanita"],
    ["groom", "Mempelai pria"],
    ["wfl", "We Found Love (1:1)"],
    ["event", "Slider kartu event"],
    ["gallery", "Galeri foto"],
    ["quote", "Quote foto (1:1)"],
    ["story", "Our Story (16:10)"]
  ];

  // Lebar maks unggahan per folder — sama dengan TARGETS di compress-images.py
  const MAX_WIDTH = {
    cover: 1280, opening: 1280, closing: 1280,
    bride: 1280, groom: 1280,
    event: 1200, gallery: 1200,
    story: 960,
    wfl: 560,
    quote: 1280
  };

  // Folder yang ditaruh di slider Swiper dengan loop: true
  const LOOP_FOLDERS = new Set(["bride", "groom", "event", "wfl"]);
  const MIN_LOOP_PHOTOS = 6;

  let currentFolder = "cover";
  let photos = [];

  window.PhotosPanel = { load };

  function load() {
    const sel = document.getElementById("photo-folder");
    if (sel.options.length === 0) {
      sel.innerHTML = FOLDERS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    }
    sel.value = currentFolder;
    render();
  }

  async function render() {
    const grid = document.getElementById("photo-grid");
    grid.innerHTML = "<p class='muted'>Memuat foto…</p>";

    const { data, error } = await window.AdminAPI.query(
      sb
        .from("photos")
        .select("*")
        .eq("folder", currentFolder)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      "Permintaan foto"
    );

    if (error) {
      // Jangan mengosongkan grid tanpa jejak — toast lenyap dalam 2,5 detik dan
      // yang tersisa cuma layar kosong tanpa cara mencoba lagi.
      grid.innerHTML =
        `<p class="warning">Gagal memuat foto: ${esc(error.message)}</p>` +
        `<button type="button" class="btn btn--primary" id="photos-retry">Coba lagi</button>`;
      document.getElementById("photos-retry").addEventListener("click", render);
      toast("Gagal memuat foto: " + error.message, true);
      return;
    }
    photos = data || [];
    paintGrid();
  }

  function paintGrid() {
    const grid = document.getElementById("photo-grid");
    const warning = document.getElementById("photo-warning");

    // Peringatan ambang Swiper loop
    if (LOOP_FOLDERS.has(currentFolder) && photos.length < MIN_LOOP_PHOTOS) {
      warning.hidden = false;
      warning.textContent =
        `Folder ini dipakai slider dengan loop — butuh minimal ${MIN_LOOP_PHOTOS} foto agar ` +
        `loop Swiper mulus (sekarang ${photos.length}). Tambahkan lebih dulu.`;
    } else {
      warning.hidden = true;
    }

    grid.innerHTML = photos
      .map(
        (p, i) => `
      <div class="photo-card" draggable="true" data-id="${p.id}">
        <div class="photo-card__thumb">
          <img src="${photoUrl(p.storage_path)}" alt="${esc(p.alt)}" loading="lazy">
        </div>
        <div class="photo-card__meta">
          <span class="photo-card__name">${esc(p.storage_path.split("/").pop())}</span>
          <span class="photo-card__focal">pan ${p.focal_x}% ${p.focal_y}% · zoom ${p.zoom}×</span>
        </div>
        <div class="photo-card__actions">
          <button type="button" class="btn btn--tiny" data-edit="${i}">Atur</button>
          <button type="button" class="btn btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
          <button type="button" class="btn btn--tiny" data-move="${i}" data-dir="1" ${i === photos.length - 1 ? "disabled" : ""}>&#9660;</button>
          <button type="button" class="btn btn--tiny btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
        </div>
      </div>`
      )
      .join("") +
      `<div class="photo-grid__actions">
        <button type="button" class="btn btn--primary" id="btn-save-order" ${photos.length < 2 ? "disabled" : ""}>Simpan urutan</button>
      </div>`;

    bindGridEvents();
  }

  function bindGridEvents() {
    const grid = document.getElementById("photo-grid");

    // Urutkan sementara lewat ▲▼ (juga fallback HP — drag susah dipakai di layar sentuh)
    grid.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const from = Number(btn.dataset.move);
        const to = from + Number(btn.dataset.dir);
        if (to < 0 || to >= photos.length) return;
        [photos[from], photos[to]] = [photos[to], photos[from]];
        paintGrid();
      });
    });

    grid.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const item = photos[Number(btn.dataset.del)];
        if (!confirm(`Hapus foto ${item.storage_path}?`)) return;
        const { error: rowErr } = await sb.from("photos").delete().eq("id", item.id);
        if (rowErr) return toast("Gagal menghapus baris: " + rowErr.message, true);
        const { error: stErr } = await sb.storage.from("photos").remove([item.storage_path]);
        if (stErr) return toast("Baris terhapus, tapi objek storage gagal: " + stErr.message, true);
        toast("Foto dihapus.");
        render();
      });
    });

    grid.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.PhotoEditor.open(photos[Number(btn.dataset.edit)], currentFolder);
      });
    });

    document.getElementById("btn-save-order").addEventListener("click", async () => {
      const btn = document.getElementById("btn-save-order");
      btn.disabled = true;
      // Update berurutan — sort_order ditulis ulang dari indeks DOM.
      for (const [i, p] of photos.entries()) {
        if (p.sort_order === i) continue;
        const { error } = await sb.from("photos").update({ sort_order: i }).eq("id", p.id);
        if (error) {
          toast("Gagal menyimpan urutan: " + error.message, true);
          btn.disabled = false;
          return;
        }
      }
      toast("Urutan tersimpan ✓");
      btn.disabled = false;
    });

  }

  // Drag & drop (desktop). Dipasang SEKALI di #photo-grid yang memang tidak
  // pernah diganti — kalau dipasang di dalam paintGrid(), tiap render ulang
  // menumpuk satu set listener lagi di elemen yang sama, dan sekali seret akan
  // menjalankan logika pemindahan sebanyak jumlah render.
  //
  // Pemindahan dikerjakan saat `drop`, bukan `dragover`: dragover menyala
  // terus-menerus selama kursor bergerak, dan paintGrid() di dalamnya
  // memusnahkan elemen yang sedang diseret sehingga seretannya putus.
  (function bindDragAndDrop() {
    const grid = document.getElementById("photo-grid");
    let dragId = null;

    grid.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".photo-card");
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    grid.addEventListener("dragend", () => {
      grid.querySelectorAll(".photo-card").forEach((c) => c.classList.remove("dragging"));
      dragId = null;
    });

    grid.addEventListener("dragover", (e) => {
      if (dragId && e.target.closest(".photo-card")) e.preventDefault(); // izinkan drop
    });

    grid.addEventListener("drop", (e) => {
      const card = e.target.closest(".photo-card");
      if (!card || !dragId) return;
      e.preventDefault();
      const from = photos.findIndex((p) => p.id === dragId);
      const over = photos.findIndex((p) => p.id === card.dataset.id);
      if (from === -1 || over === -1 || from === over) return;
      // Jatuh di paruh bawah kartu = sisipkan SESUDAHnya.
      const rect = card.getBoundingClientRect();
      let to = e.clientY > rect.top + rect.height / 2 ? over + 1 : over;
      const moved = photos.splice(from, 1)[0];
      if (from < to) to -= 1; // indeks bergeser setelah elemen sumber dicabut
      photos.splice(clamp(to, 0, photos.length), 0, moved);
      dragId = null;
      paintGrid();
    });
  })();

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  // -------------------------------------------------------------------------
  // Unggah: WebP + resize di browser
  // -------------------------------------------------------------------------
  document.addEventListener("change", (e) => {
    if (e.target.id !== "photo-upload") return;
    const files = Array.from(e.target.files);
    e.target.value = "";
    if (!files.length) return;
    uploadAll(files);
  });

  async function uploadAll(files) {
    // Dihitung SEKALI lalu dinaikkan sendiri tiap file. Kalau maxOrder dihitung
    // ulang dari `photos` di dalam loop, seluruh file dalam satu unggahan dapat
    // sort_order yang sama — `photos` baru menyegar setelah render() di akhir —
    // dan urutannya jadi ditentukan tiebreaker id, bukan urutan pilih pengguna.
    let nextOrder = photos.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
    const folder = currentFolder; // kunci: pengguna bisa berganti folder saat unggah berjalan

    for (const file of files) {
      try {
        const blob = await convertToWebp(file, MAX_WIDTH[folder]);
        const name = `${folder}/${uuid()}.webp`;
        const { error: upErr } = await sb.storage.from("photos").upload(name, blob, {
          contentType: "image/webp"
        });
        if (upErr) throw new Error(upErr.message);
        const { error: rowErr } = await sb
          .from("photos")
          .insert({ folder, storage_path: name, sort_order: nextOrder });
        if (rowErr) throw new Error(rowErr.message);
        nextOrder += 1;
        toast(`${file.name} → terunggah ✓`);
      } catch (err) {
        toast(`Gagal unggah ${file.name}: ${err.message}`, true);
      }
    }
    render();
  }

  /** Konversi file gambar apa pun (jpg/png/heic/webp…) menjadi WebP,
   * di-downscale ke lebar maks folder. Kualitas 0.8 (sama dengan rencana §4). */
  function convertToWebp(file, maxWidth) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Konversi WebP gagal"))), "image/webp", 0.8);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Gambar tidak bisa dibaca"));
      };
      img.src = url;
    });
  }

  function uuid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `f${Date.now()}${Math.random().toString(16).slice(2)}`;
  }

  document.getElementById("photo-folder").addEventListener("change", (e) => {
    currentFolder = e.target.value;
    render();
  });

  function esc(v) {
    return String(v ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
})();
