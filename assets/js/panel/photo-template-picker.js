/** Pilihan foto + crop KHUSUS TEMPLATE AKTIF, untuk satu slot foto.
 *
 * Beda dari assets/js/panel/photos.js (pool foto BERSAMA, satu crop per
 * foto, tersimpan langsung ke tabel `photos`): modul ini memilih SUBSET dari
 * pool yang sama, urutan dan crop-nya sendiri, untuk template yang sedang
 * aktif — disimpan di content.templates[<id>].photos[<slot>], dibaca sisi
 * tamu lewat assets/js/core/template-photos.js (forSlot). Nama file sengaja
 * beda dari file itu: yang ini modul ADMIN, tanggung jawabnya menulis
 * override, bukan membacanya.
 *
 * Kenapa perlu terpisah dari picker dasar: tiap template minta RASIO & JUMLAH
 * foto berbeda untuk slot yang sama (Nocturne: satu foto potret 3/4 per
 * mempelai; Kertas: 3/4 juga tapi ditata beda; Sekar Jagat: bingkai lengkung).
 * Foto & crop dasar (pool) tetap satu untuk semua template — ini lapisan
 * PILIHAN & CROP TAMBAHAN di atasnya, opsional. Kosong = pakai bawaan pool
 * (lihat core/template-photos.js.forSlot: tanpa override, urutan & crop pool
 * dipakai apa adanya).
 *
 * Persistensi DITUNDA: setiap perubahan (centang, urutan, crop) hanya
 * mengubah array di memori + memanggil markDirty() yang diserahkan
 * pages/section.js — penulisan sungguhan terjadi saat halaman men-commit()
 * semua handle lalu menyimpan lewat PanelStore.saveTpl()/store.save(). Ini
 * BEDA dari photos.js (pool dasar), yang menulis ke DB seketika di tiap aksi
 * — di sini semuanya masuk satu UPSERT bersama field lain di halaman yang
 * sama, memakai bar Simpan yang sudah ada.
 */
(function () {
  const { esc, escAttr } = window.PanelUI;

  function parseRatio(str, fallback) {
    const m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(String(str || "").trim());
    if (!m) return fallback;
    const w = Number(m[1]), h = Number(m[2]);
    return h > 0 ? w / h : fallback;
  }

  function mount(container, photoSpec, markDirty) {
    const { sb, photoUrl, toast } = window.AdminAPI;
    const slot = photoSpec.slot;
    const ratio = parseRatio(photoSpec.ratio, 1);
    const max = Number(photoSpec.max) || 0; // 0 = tanpa batas

    // Klon dalam — draft ini yang diedit; tidak menyentuh content sampai
    // commit() dipanggil (biasanya dari onSave() halaman).
    let overrides = JSON.parse(JSON.stringify(window.PanelStore.tplGet(`photos.${slot}`, [])));
    let pool = []; // baris dari tabel photos, folder = slot
    let templateName = ""; // diisi async dari manifest, untuk judul panel
    let destroyed = false;

    container.innerHTML = `<p class="p-empty">Memuat…</p>`;

    function byId(id) { return pool.find((p) => String(p.id) === String(id)); }
    function overrideIndex(id) { return overrides.findIndex((o) => String(o.id) === String(id)); }
    function isIncluded(id) { return overrideIndex(id) !== -1; }

    /** Nilai efektif (override kalau ada, kalau tidak dari baris pool). */
    function effective(p) {
      const o = overrides[overrideIndex(p.id)];
      return {
        focalX: o ? o.focalX : (Number(p.focal_x) || 50),
        focalY: o ? o.focalY : (Number(p.focal_y) || 50),
        zoom: o ? o.zoom : (Number(p.zoom) || 1)
      };
    }

    function render() {
      if (destroyed) return;
      if (!pool.length) {
        container.innerHTML = `<p class="p-empty">Unggah foto di atas dulu, baru pilih &amp; atur untuk template ini.</p>`;
        return;
      }
      // Urutan tampil: yang tersentang dulu (mengikuti urutan override —
      // itulah urutan tampil di template), sisanya (belum dipakai) menyusul
      // dalam urutan pool.
      const includedIds = overrides.map((o) => String(o.id));
      const ordered = [
        ...overrides.map((o) => byId(o.id)).filter(Boolean),
        ...pool.filter((p) => !includedIds.includes(String(p.id)))
      ];

      const limitHint = max ? ` (maks. ${max} foto)` : "";
      container.innerHTML = `
        <p class="p-tplphoto__title">Foto untuk template <b>${esc(templateName || "ini")}</b></p>
        <p class="p-hint">Kosongkan semua untuk memakai urutan &amp; crop bawaan${limitHint}. Foto &amp; file baru dikelola di atas — bagian ini hanya memilih &amp; menata untuk template ini.</p>
        <div class="p-photo-grid" id="tpg-${escAttr(slot)}"></div>
        <button type="button" class="p-btn p-btn--ghost p-btn--tiny" data-reset ${overrides.length ? "" : "disabled"}>Reset ke bawaan</button>
      `;
      const grid = container.querySelector(`#tpg-${escAttr(slot)}`);
      grid.innerHTML = ordered.map((p) => {
        const included = isIncluded(p.id);
        const i = overrideIndex(p.id);
        const eff = effective(p);
        return `
        <div class="p-photo-card ${included ? "" : "p-photo-card--excluded"}" data-id="${escAttr(p.id)}" style="--photo-ratio:${ratio}">
          <div class="p-photo-card__thumb">
            <img src="${escAttr(photoUrl(p.storage_path))}" alt="${esc(p.alt)}" loading="lazy"
                 style="object-position:${eff.focalX}% ${eff.focalY}%;transform-origin:${eff.focalX}% ${eff.focalY}%;transform:scale(${eff.zoom})">
          </div>
          <div class="p-photo-card__meta">
            <label class="p-switch"><input type="checkbox" data-include="${escAttr(p.id)}" ${included ? "checked" : ""}><span>Dipakai</span></label>
          </div>
          <div class="p-photo-card__actions">
            ${included ? `<button type="button" class="p-btn p-btn--tiny" data-edit="${escAttr(p.id)}">Atur crop</button>` : ""}
            ${included ? `<button type="button" class="p-btn p-btn--tiny" data-move="${escAttr(p.id)}" data-dir="-1" ${i <= 0 ? "disabled" : ""}>&#9650;</button>` : ""}
            ${included ? `<button type="button" class="p-btn p-btn--tiny" data-move="${escAttr(p.id)}" data-dir="1" ${i >= overrides.length - 1 ? "disabled" : ""}>&#9660;</button>` : ""}
          </div>
        </div>`;
      }).join("");
      bind();
    }

    function include(id) {
      if (isIncluded(id)) return;
      const p = byId(id);
      if (!p) return;
      if (max && overrides.length >= max) {
        // Kartu tertua (pertama disentang) dilepas otomatis, bukan menolak
        // pilihan baru — konsisten dengan "centang terakhir yang menang",
        // dan tamu tetap tahu kenapa lewat toast.
        const dropped = overrides.shift();
        toast(`Maksimal ${max} foto untuk slot ini — "${byId(dropped.id)?.storage_path?.split("/").pop() || "foto lama"}" dilepas.`);
      }
      overrides.push({ id: p.id, focalX: Number(p.focal_x) || 50, focalY: Number(p.focal_y) || 50, zoom: Number(p.zoom) || 1 });
      markDirty();
    }
    function exclude(id) {
      const i = overrideIndex(id);
      if (i === -1) return;
      overrides.splice(i, 1);
      markDirty();
    }

    function bind() {
      container.querySelectorAll("[data-include]").forEach((box) => {
        box.addEventListener("change", () => {
          const id = box.dataset.include;
          if (box.checked) include(id); else exclude(id);
          render();
        });
      });
      container.querySelectorAll("[data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.move, dir = Number(btn.dataset.dir);
          const from = overrideIndex(id), to = from + dir;
          if (from === -1 || to < 0 || to >= overrides.length) return;
          [overrides[from], overrides[to]] = [overrides[to], overrides[from]];
          markDirty();
          render();
        });
      });
      container.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.edit;
          const p = byId(id);
          if (!p) return;
          const eff = effective(p);
          // "Foto semu" untuk Editor: bentuknya persis baris tabel photos
          // (focal_x/focal_y, snake_case) supaya Editor tidak perlu tahu apa
          // pun soal bentuk override per-template.
          const shim = { id: p.id, storage_path: p.storage_path, alt: p.alt, focal_x: eff.focalX, focal_y: eff.focalY, zoom: eff.zoom };
          window.PanelPhotos.openEditor(shim, slot, null, null, null, async ({ focalX, focalY, zoom }) => {
            const idx = overrideIndex(id);
            if (idx === -1) return { error: { message: "Foto ini sudah tidak dipakai." } };
            overrides[idx] = { id: p.id, focalX, focalY, zoom };
            markDirty();
            render();
            return { message: "Crop diterapkan — klik Simpan di halaman untuk menyimpannya." };
          }, ratio);
        });
      });
      const resetBtn = container.querySelector("[data-reset]");
      if (resetBtn) resetBtn.addEventListener("click", () => {
        overrides = [];
        markDirty();
        render();
      });
    }

    async function load() {
      const { data, error } = await window.AdminAPI.query(
        sb.from("photos").select("*").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("folder", slot)
          .order("sort_order", { ascending: true }).order("id", { ascending: true }),
        "Permintaan foto (template)"
      );
      if (destroyed) return;
      if (error) {
        container.innerHTML = `<p class="p-warning p-warning--danger">Gagal memuat foto: ${esc(error.message)}</p>`;
        return;
      }
      pool = data || [];
      // Override yang menunjuk foto yang sudah dihapus dari pool dibuang diam-
      // diam (bukan error) — sama seperti forSlot() di sisi tamu melakukannya.
      overrides = overrides.filter((o) => pool.some((p) => String(p.id) === String(o.id)));
      render();
    }
    window.PanelStore.activeManifest().then((m) => {
      templateName = m.name || m.id || "";
      if (!destroyed) render();
    });
    load();

    return {
      /** Menulis draft saat ini ke content (in-memory) via PanelStore.tplSet.
       * SELALU dipanggil oleh halaman pemanggil sebelum store.save() —
       * idempotent, aman dipanggil walau tidak ada perubahan. */
      commit() {
        window.PanelStore.tplSet(`photos.${slot}`, overrides);
      },
      destroy() { destroyed = true; }
    };
  }

  window.PanelTemplatePhotos = { mount };
})();
