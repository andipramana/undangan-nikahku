# Laporan Eksekusi v5 — FASE 0: Bersih-bersih Template Gagal

## 1. Apa yang Dikerjakan & Berkas yang Berubah

Menghapus tiga template eksperimental yang dinilai gagal secara desain (`nocturne`, `kertas`, `sekar-jagat`) dan memastikan fallback ke `klasik` berjalan mulus baik di halaman tamu maupun panel admin tanpa menulis balik ke database.

### Berkas yang dihapus:
- `templates/nocturne/` (`template.json`, `markup.html`, `style.css`, `render.js`, `cover.jpg`)
- `templates/kertas/` (`template.json`, `markup.html`, `style.css`, `render.js`, `cover.jpg`)
- `templates/sekar-jagat/` (`template.json`, `markup.html`, `style.css`, `render.js`, `cover.jpg`)

### Berkas yang diubah:
- `templates/index.json` — menghapus entri `nocturne`, `kertas`, dan `sekar-jagat` sehingga katalog hanya memuat template yang benar-benar ada (`klasik`).
- `assets/js/core/engine.js` — menambahkan `getCatalogIds()` dan `resolveKnownId(id)` untuk memverifikasi `templateId` terhadap `templates/index.json`.
- `assets/js/main.js` — mempertahankan `ALIAS` (`classic-elegance` → `klasik`) dan memeriksa `engine.resolveKnownId()` agar jika `content.templateId` menunjuk template yang sudah dihapus dari `templates/index.json`, mesin otomatis jatuh ke `klasik` tanpa menulis balik ke database.
- `assets/js/panel/store.js` — memeriksa katalog `templates/index.json` dan menjatuhkan `templateIdOf()` / `activeManifest()` ke `klasik` di memori bila template lama tidak ditemukan, tanpa memutasi `site_content` di database.
- `assets/js/panel/pages/template.js` — menampilkan `klasik` sebagai aktif jika `content.templateId` menunjuk template yang tidak ada di `templates/index.json`.
- `scripts/test-client-management-contract.mjs` — mengganti pengecekan nama template hardcode `nocturne` menjadi pembacaan dinamis dari `templates/index.json`.
- `scripts/test-panel-template-photos.mjs` — mengganti stub manifest `nocturne` menjadi pembacaan dinamis dari `templates/index.json`.
- `docs/rencana-admin-v2.md` — menambahkan catatan historis singkat di bagian atas dokumen.

## 2. Hasil Anggaran Performa

FASE 0 hanya menghapus berkas template gagal; pengukuran anggaran performa penuh dilakukan di FASE 1 (`scripts/perf-budget.mjs`).

## 3. Daftar Test yang Dijalankan & Hasilnya

Semua test wajib FASE 0 lolos (hijau):
- `node scripts/test-template-contract.mjs` — **PASS**
- `node scripts/test-template-render.mjs` — **PASS**
- `node scripts/test-visual-editor-all-templates.mjs` — **PASS**
- `node scripts/test-admin-v2-contract.mjs` — **PASS**
- `node scripts/test-client-management-contract.mjs` — **PASS**
- `node scripts/test-panel-photo-layout.mjs` — **PASS**
- `node scripts/test-panel-template-photos.mjs` — **PASS**

## 4. Keputusan Desain & Teknis

- Ketika `target === DEFAULT_ID` (`klasik`), `engine.resolveKnownId()` langsung mengembalikan `klasik` tanpa menunggu fetch `templates/index.json` supaya jalur kritis kunjungan tamu template default tidak menambah permintaan jaringan.
- Di `assets/js/panel/store.js`, pengecekan `templates/index.json` bersifat toleran terhadap mode offline/test-stub: jika fetch katalog gagal di lingkungan test tanpa server, fallback terjadi saat `templates/<id>/template.json` mengembalikan 404.

## 5. Apa yang Masih Bermasalah atau Sengaja Dilewati

- Data lama di database (`content.templates.nocturne`, dll.) sengaja dibiarkan sesuai instruksi §2 karena tidak mengganggu dan penghapusannya memerlukan operasi database.

## 6. Yang Perlu Diuji Pemilik Produk di HP

- Membuka `/<slug>/` untuk tenant yang sebelumnya memilih `nocturne`/`kertas`/`sekar-jagat` (harus tampil dengan template `klasik`, bukan layar kosong).
- Membuka `/<slug>/admin/#/template` (hanya menampilkan template aktif di katalog tanpa pilihan hantu).
