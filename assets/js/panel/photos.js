/**
 * Komponen foto reusable — dipasang SATU KALI PER FOLDER di dalam halaman
 * yang memilikinya (mis. Mempelai memasangnya dua kali: bride & groom).
 * Beda dari tab Foto lama (satu dropdown 11 folder): sekarang teks & foto
 * satu halaman, jadi komponen ini tidak lagi butuh pemilih folder sendiri.
 *
 * Perilaku dipertahankan dari assets/js/admin/photos.js + editor.js lama:
 * konversi WebP + resize per folder (MAX_WIDTH, harus sama dengan TARGETS di
 * scripts/compress-images.py), peringatan folder Swiper loop (LOOP_FOLDERS,
 * MIN_LOOP_PHOTOS), tata letak galeri lewat assets/js/gallery-layout.js
 * (TIDAK diduplikasi), pemasangan rekomendasi kado by-index untuk folder
 * gift_item (sekarang lewat PanelStore, bukan upsert sendiri — satu pintu),
 * editor pan/zoom dengan rasio bingkai sama persis dengan tampilan tamu,
 * urutan disimpan otomatis tiap kali posisi berubah (arrow/drag).
 */
(function () {
  const MAX_WIDTH = {
    cover: 1280, opening: 1280, std2: 1280, subcover: 1280, closing: 1280,
    bride: 1280, groom: 1280,
    event: 1200, gallery: 1200,
    story: 960,
    wfl: 560,
    quote: 1280,
    gift_item: 800
  };
  const FOLDER_RATIO = {
    cover: 9 / 19.5, opening: 9 / 19.5, std2: 9 / 19.5, subcover: 9 / 19.5, closing: 9 / 19.5,
    bride: 2 / 3, groom: 2 / 3,
    wfl: 1,
    event: 1.2,
    gallery: 16 / 10,
    quote: 1,
    story: 16 / 10,
    gift_item: 1
  };
  const HERO_FOLDERS = new Set(["cover", "opening", "std2", "closing", "subcover"]);
  const LOOP_FOLDERS = new Set(["bride", "groom", "event", "wfl"]);
  const MIN_LOOP_PHOTOS = 6;

  function esc(v) { return window.PanelUI.esc(v); }
  function uuid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `f${Date.now()}${Math.random().toString(16).slice(2)}`;
  }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // -------------------------------------------------------------------------
  // Editor pan/zoom (overlay statis di admin.html, #p-editor) — satu instance
  // dipakai bergantian oleh semua komponen foto di halaman mana pun.
  // -------------------------------------------------------------------------
  const Editor = (function () {
    const { sb, photoUrl, toast } = window.AdminAPI;
    let item = null, folder = "", ratio = 1, zoom = 1, allPhotos = [], onSaved = null;

    function ratioFor(folderName, index) {
      if (folderName === "gallery" && window.GalleryLayout && Number.isInteger(index)) {
        return window.GalleryLayout.ratioAt(index, allPhotos);
      }
      return FOLDER_RATIO[folderName] || 1;
    }

    function applyFocal(fx, fy) {
      const img = document.getElementById("p-editor-img");
      img.style.objectPosition = `${fx}% ${fy}%`;
      img.style.transformOrigin = `${fx}% ${fy}%`;
      img.dataset.fx = String(fx);
      img.dataset.fy = String(fy);
    }

    function fitPreview() {
      const preview = document.getElementById("p-editor-preview");
      const panel = document.querySelector(".p-editor__panel");
      const maxW = panel.clientWidth - 32;
      const maxH = window.innerHeight * 0.55;
      const w = Math.min(maxW, maxH * ratio);
      const h = w / ratio;
      preview.style.width = w + "px";
      preview.style.height = h + "px";
    }

    function renderedImageSize() {
      const img = document.getElementById("p-editor-img");
      const preview = document.getElementById("p-editor-preview");
      const rect = preview.getBoundingClientRect();
      const nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return { width: 0, height: 0, frameWidth: rect.width, frameHeight: rect.height };
      const coverScale = Math.max(rect.width / nw, rect.height / nh);
      return { width: nw * coverScale * zoom, height: nh * coverScale * zoom, frameWidth: rect.width, frameHeight: rect.height };
    }

    function panRange() {
      const size = renderedImageSize();
      return { x: Math.max(0, size.width - size.frameWidth), y: Math.max(0, size.height - size.frameHeight) };
    }

    function open(photo, folderName, index, photosList, savedCb) {
      item = photo; folder = folderName; allPhotos = photosList || [photo]; onSaved = savedCb || null;
      ratio = ratioFor(folderName, index);
      zoom = Number(photo.zoom) || 1;
      const shape = folderName === "gallery" && window.GalleryLayout && Number.isInteger(index)
        ? ` — ${window.GalleryLayout.labelAt(index, allPhotos)}, baris ${window.GalleryLayout.rowAt(index, allPhotos)}`
        : "";
      const hint = document.querySelector(".p-editor__hint");
      if (hint) hint.textContent = `Seret foto untuk menggeser (pan)${shape}`;
      const img = document.getElementById("p-editor-img");
      img.src = photoUrl(photo.storage_path);
      img.alt = photo.alt || "";
      img.style.transform = `scale(${zoom})`;
      applyFocal(Number(photo.focal_x) || 50, Number(photo.focal_y) || 50);
      const slider = document.getElementById("p-editor-zoom");
      slider.value = String(zoom);
      document.getElementById("p-editor-zoom-value").textContent = zoom.toFixed(2) + "×";
      window.PanelUI.openModal(document.getElementById("p-editor"));
      fitPreview();
    }

    document.getElementById("p-editor-zoom").addEventListener("input", (e) => {
      zoom = Number(e.target.value);
      document.getElementById("p-editor-img").style.transform = `scale(${zoom})`;
      document.getElementById("p-editor-zoom-value").textContent = zoom.toFixed(2) + "×";
    });

    let dragging = false, lastX = 0, lastY = 0;
    const preview = document.getElementById("p-editor-preview");
    function onDragMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      const img = document.getElementById("p-editor-img");
      const range = panRange();
      let fx = Number(img.dataset.fx), fy = Number(img.dataset.fy);
      if (range.x > 0) fx = clamp(fx - (dx / range.x) * 100, 0, 100);
      if (range.y > 0) fy = clamp(fy - (dy / range.y) * 100, 0, 100);
      applyFocal(fx, fy);
    }
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      preview.classList.remove("dragging");
      try { preview.releasePointerCapture(e.pointerId); } catch (_) {}
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    }
    preview.addEventListener("pointerdown", (e) => {
      const img = document.getElementById("p-editor-img");
      if (!img.complete || !img.naturalWidth) return;
      const range = panRange();
      if (!range.x && !range.y) {
        const hint = document.querySelector(".p-editor__hint");
        if (hint) hint.textContent = "Foto pas dengan bingkai — naikkan zoom dulu untuk bisa menggeser.";
        return;
      }
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      try { preview.setPointerCapture(e.pointerId); } catch (_) {}
      preview.classList.add("dragging");
      e.preventDefault();
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    });

    document.getElementById("p-editor-reset").addEventListener("click", () => {
      zoom = 1;
      document.getElementById("p-editor-zoom").value = "1";
      document.getElementById("p-editor-zoom-value").textContent = "1.00×";
      document.getElementById("p-editor-img").style.transform = "scale(1)";
      applyFocal(50, 50);
    });

    document.getElementById("p-editor-save").addEventListener("click", async () => {
      const img = document.getElementById("p-editor-img");
      const btn = document.getElementById("p-editor-save");
      btn.disabled = true;
      const { error } = await sb.from("photos")
        .update({ focal_x: Number(img.dataset.fx), focal_y: Number(img.dataset.fy), zoom })
        .eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", item.id);
      btn.disabled = false;
      if (error) { toast("Gagal menyimpan: " + error.message, true); return; }
      toast("Pan & zoom tersimpan ✓");
      window.PanelUI.closeModal(document.getElementById("p-editor"));
      if (onSaved) onSaved();
    });
    document.getElementById("p-editor-close").addEventListener("click", () => { window.PanelUI.closeModal(document.getElementById("p-editor")); });
    window.addEventListener("resize", () => { if (!document.getElementById("p-editor").hidden) fitPreview(); });

    return { open };
  })();

  // -------------------------------------------------------------------------
  // Konversi WebP + resize di browser
  // -------------------------------------------------------------------------
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
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
      img.src = url;
    });
  }

  // -------------------------------------------------------------------------
  // Instance per folder
  // -------------------------------------------------------------------------
  function mount(container, folder, opts = {}) {
    const { sb, photoUrl, toast } = window.AdminAPI;
    let photos = [];
    let destroyed = false;

    container.innerHTML = `
      <label class="p-upload-wrap p-upload-zone">
        <span class="p-upload-zone__title">Klik untuk memilih foto, atau seret ke sini</span>
        <span class="p-upload-zone__hint">JPG/PNG — dikonversi otomatis ke WebP</span>
        <input type="file" accept="image/*" multiple hidden class="p-photo-input">
      </label>
      <p class="p-warning" hidden></p>
      <div class="p-photo-grid"></div>
    `;
    const zoneEl = container.querySelector(".p-upload-zone");
    const warningEl = container.querySelector(".p-warning");
    const gridEl = container.querySelector(".p-photo-grid");
    const inputEl = container.querySelector(".p-photo-input");

    function cardLayout(index) {
      if (folder === "gallery" && window.GalleryLayout) {
        const shape = window.GalleryLayout.shapeAt(index, photos);
        return { className: `p-photo-card--${shape}`, ratio: window.GalleryLayout.ratioAt(index, photos), gridRow: window.GalleryLayout.rowAt(index, photos) };
      }
      return { className: HERO_FOLDERS.has(folder) ? "p-photo-card--hero" : "", ratio: FOLDER_RATIO[folder] || 1 };
    }

    function giftRecs() {
      return window.PanelStore.get("giftRecommendations", []);
    }

    async function saveGiftRecs(recs) {
      window.PanelStore.set("giftRecommendations", recs);
      const { error } = await window.PanelStore.save(["giftRecommendations"]);
      if (error) toast("Gagal menyimpan rekomendasi: " + error.message, true);
      return !error;
    }

    async function load() {
      if (destroyed) return;
      gridEl.innerHTML = `<p class="p-empty">Memuat foto…</p>`;
      const { data, error } = await window.AdminAPI.query(
        sb.from("photos").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("folder", folder)
          .order("sort_order", { ascending: true }).order("id", { ascending: true }),
        "Permintaan foto"
      );
      if (destroyed) return;
      if (error) {
        gridEl.innerHTML = `<p class="p-warning p-warning--danger">Gagal memuat foto: ${esc(error.message)}</p><button type="button" class="p-btn p-btn--primary" data-retry>Coba lagi</button>`;
        gridEl.querySelector("[data-retry]").addEventListener("click", load);
        return;
      }
      photos = data || [];
      paint();
    }

    function paint() {
      gridEl.className = `p-photo-grid ${folder === "gallery" ? "p-photo-grid--gallery" : ""}`;
      if (LOOP_FOLDERS.has(folder) && photos.length < MIN_LOOP_PHOTOS) {
        warningEl.hidden = false;
        warningEl.className = "p-warning";
        warningEl.textContent = `Slider ini butuh minimal ${MIN_LOOP_PHOTOS} foto agar loop berjalan mulus (sekarang ${photos.length}).`;
      } else if (folder === "gift_item") {
        const recs = giftRecs();
        warningEl.hidden = false;
        warningEl.className = "p-warning";
        warningEl.textContent = recs.length === photos.length
          ? `Foto kado: ${photos.length} — jumlah & urutan sinkron dengan rekomendasi kado.`
          : `Foto kado: ${photos.length}, rekomendasi kado: ${recs.length}. Foto ke-i tampil untuk rekomendasi ke-i — sesuaikan urutan/jumlah agar berpasangan.`;
      } else {
        warningEl.hidden = true;
      }

      if (!photos.length) {
        gridEl.innerHTML = `<p class="p-empty">Belum ada foto di bagian ini.</p>`;
        return;
      }

      const recs = folder === "gift_item" ? giftRecs() : null;
      gridEl.innerHTML = photos.map((p, i) => {
        const layout = cardLayout(i);
        const style = folder === "gallery"
          ? `--photo-ratio:${layout.ratio};grid-row:${layout.gridRow}`
          : `--photo-ratio:${layout.ratio}`;
        const r = recs ? (recs[i] || {}) : null;
        return `
        <div class="p-photo-card ${layout.className}" draggable="true" data-id="${p.id}" style="${style}">
          <div class="p-photo-card__thumb">
            <img src="${photoUrl(p.storage_path)}" alt="${esc(p.alt)}" loading="lazy" draggable="false"
                 style="object-position:${Number(p.focal_x) || 50}% ${Number(p.focal_y) || 50}%;transform-origin:${Number(p.focal_x) || 50}% ${Number(p.focal_y) || 50}%;transform:scale(${Number(p.zoom) || 1})">
          </div>
          <div class="p-photo-card__meta">
            <span class="p-photo-card__name">${esc(p.storage_path.split("/").pop())}</span>
            <span>pan ${p.focal_x}% ${p.focal_y}% · zoom ${p.zoom}×</span>
            ${folder === "gallery" ? `<label class="p-field"><span>Lebar</span><select class="p-select" data-gallery-layout="${i}">${window.GalleryLayout.choices.map((c) => `<option value="${c.value}" ${c.value === window.GalleryLayout.shapeAt(i, photos) ? "selected" : ""}>${c.label}</option>`).join("")}</select></label>` : ""}
            ${folder === "gift_item" ? `
              <label class="p-field"><span>Nama</span><input class="p-input" data-gift-rec="name" data-gift-i="${i}" value="${esc(r.name || "")}" placeholder="Nama kado"></label>
              <label class="p-field"><span>Harga</span><input class="p-input" data-gift-rec="price" data-gift-i="${i}" value="${esc(r.price || "")}" placeholder="Rp 250.000"></label>
              <label class="p-field"><span>Link</span><input class="p-input" type="url" data-gift-rec="link" data-gift-i="${i}" value="${esc(r.link || "")}" placeholder="https://…"></label>
            ` : ""}
          </div>
          <div class="p-photo-card__actions">
            <button type="button" class="p-btn p-btn--tiny" data-edit="${i}">Atur</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>&#9650;</button>
            <button type="button" class="p-btn p-btn--tiny" data-move="${i}" data-dir="1" ${i === photos.length - 1 ? "disabled" : ""}>&#9660;</button>
            <button type="button" class="p-btn p-btn--tiny p-btn--danger" data-del="${i}" aria-label="Hapus">&times;</button>
          </div>
        </div>`;
      }).join("");

      bindGrid();
    }

    function bindGrid() {
      gridEl.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const from = Number(btn.dataset.move), to = from + Number(btn.dataset.dir);
          if (to < 0 || to >= photos.length) return;
          [photos[from], photos[to]] = [photos[to], photos[from]];
          if (folder === "gift_item") {
            const recs = giftRecs();
            [recs[from], recs[to]] = [recs[to], recs[from]];
            saveGiftRecs(recs);
          }
          paint();
          saveOrder();
        });
      });
      gridEl.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const i = Number(btn.dataset.del);
          const item = photos[i];
          if (!confirm(`Hapus foto ${item.storage_path}?`)) return;
          const { error: rowErr } = await sb.from("photos").delete().eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", item.id);
          if (rowErr) return toast("Gagal menghapus baris: " + rowErr.message, true);
          if (item.storage_path.startsWith(`${window.AdminAPI.tenant.slug}/`)) {
            const { error: stErr } = await sb.storage.from("photos").remove([item.storage_path]);
            if (stErr) return toast("Baris terhapus, tapi objek storage gagal: " + stErr.message, true);
          }
          if (folder === "gift_item") {
            const recs = giftRecs();
            recs.splice(i, 1);
            await saveGiftRecs(recs);
          }
          toast("Foto dihapus.");
          load();
        });
      });
      gridEl.querySelectorAll("select[data-gallery-layout]").forEach((control) => {
        control.addEventListener("change", async () => {
          const i = Number(control.dataset.galleryLayout);
          const photo = photos[i]; if (!photo) return;
          const patch = { gallery_layout: control.value };
          const { error } = await sb.from("photos").update(patch).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", photo.id);
          if (error) { toast("Gagal menyimpan layout galeri: " + error.message, true); paint(); return; }
          Object.assign(photo, patch);
          toast("Layout galeri tersimpan ✓");
          paint();
        });
      });
      gridEl.querySelectorAll("[data-gift-rec]").forEach((input) => {
        input.addEventListener("change", async () => {
          const i = Number(input.dataset.giftI);
          const recs = giftRecs();
          recs[i] = recs[i] || { name: "", price: "", link: "" };
          recs[i][input.dataset.giftRec] = input.value.trim();
          const ok = await saveGiftRecs(recs);
          if (ok) toast("Detail rekomendasi tersimpan ✓");
        });
      });
      gridEl.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.edit);
          Editor.open(photos[i], folder, i, photos, load);
        });
      });
    }

    async function saveOrder() {
      for (const [i, p] of photos.entries()) {
        if (p.sort_order === i) continue;
        const { error } = await sb.from("photos").update({ sort_order: i }).eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", p.id);
        if (error) { toast("Gagal menyimpan urutan: " + error.message, true); return; }
        p.sort_order = i;
      }
    }

    // Drag & drop (desktop) — dipasang sekali di elemen grid yang persist.
    let dragId = null;
    gridEl.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".p-photo-card");
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    gridEl.addEventListener("dragend", () => {
      gridEl.querySelectorAll(".p-photo-card").forEach((c) => c.classList.remove("dragging"));
      dragId = null;
    });
    gridEl.addEventListener("dragover", (e) => { if (dragId && e.target.closest(".p-photo-card")) e.preventDefault(); });
    gridEl.addEventListener("drop", (e) => {
      const card = e.target.closest(".p-photo-card");
      if (!card || !dragId) return;
      e.preventDefault();
      const from = photos.findIndex((p) => p.id === dragId);
      const over = photos.findIndex((p) => p.id === card.dataset.id);
      if (from === -1 || over === -1 || from === over) return;
      const rect = card.getBoundingClientRect();
      let to = e.clientY > rect.top + rect.height / 2 ? over + 1 : over;
      const moved = photos.splice(from, 1)[0];
      if (from < to) to -= 1;
      photos.splice(clamp(to, 0, photos.length), 0, moved);
      dragId = null;
      paint();
      saveOrder();
    });

    inputEl.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      e.target.value = "";
      if (files.length) uploadAll(files);
    });

    // Seret file langsung dari OS ke zona unggah. Berbeda dari drag&drop
    // reorder kartu di atas: ini file EKSTERNAL (dataTransfer.files), bukan
    // kartu internal (effectAllowed "move") — keduanya sengaja tidak saling
    // mengganggu lewat cek dragId / types "Files".
    container.addEventListener("dragover", (e) => {
      if (dragId) return;
      if (!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files"))) return;
      e.preventDefault();
      zoneEl.classList.add("is-dragover");
    });
    container.addEventListener("dragleave", (e) => {
      if (!container.contains(e.relatedTarget)) zoneEl.classList.remove("is-dragover");
    });
    container.addEventListener("drop", (e) => {
      zoneEl.classList.remove("is-dragover");
      if (dragId) return;
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || [])
        .filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      uploadAll(files);
    });

    async function uploadAll(files) {
      let nextOrder = photos.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;
      for (const file of files) {
        try {
          const blob = await convertToWebp(file, MAX_WIDTH[folder] || 1200);
          const name = `${window.AdminAPI.tenant.slug}/${folder}/${uuid()}.webp`;
          const { error: upErr } = await sb.storage.from("photos").upload(name, blob, { contentType: "image/webp" });
          if (upErr) throw new Error(upErr.message);
          const { error: rowErr } = await sb.from("photos").insert({ invitation_id: window.AdminAPI.tenant.invitationId, folder, storage_path: name, sort_order: nextOrder });
          if (rowErr) throw new Error(rowErr.message);
          nextOrder += 1;
          toast(`${file.name} → terunggah ✓`);
        } catch (err) {
          toast(`Gagal unggah ${file.name}: ${err.message}`, true);
        }
      }
      load();
    }

    load();

    return {
      refresh: load,
      destroy() { destroyed = true; }
    };
  }

  window.PanelPhotos = { mount, openEditor: Editor.open };
})();
