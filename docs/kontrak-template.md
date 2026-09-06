# Kontrak Template

Satu template = satu folder mandiri di `templates/<id>/`. Ganti template berarti
mengganti SELURUH tampilan: markup, CSS, transisi, urutan section — bukan sekadar
menukar warna.

```
templates/<id>/
  template.json   manifest + skema editor (dibaca halaman tamu DAN admin)
  markup.html     seluruh isi visual undangan (potongan HTML, tanpa <html>/<head>)
  style.css       CSS mandiri — satu-satunya CSS tampilan yang dimuat
  render.js       mengisi data ke markup + perilaku khas template
  cover.jpg       thumbnail untuk katalog
```

## Aturan isolasi

**CSS: nol berbagi.** Halaman tamu TIDAK memuat `assets/css/style.css` sama sekali.
Hanya `templates/<id>/style.css` milik template aktif yang dimuat, dan hanya satu
template aktif pada satu waktu. Konsekuensinya CSS template harus lengkap sendiri
(termasuk reset/normalize-nya) — tidak boleh mengandalkan gaya dari template lain.

**JS: layanan bersama bersifat opt-in.** Modul di `assets/js/core/` adalah
infrastruktur (ambil data, format tanggal, resolusi foto) — tidak boleh membuat
elemen visual apa pun. Modul perilaku (`gallery.js`, `gift.js`, `rsvp.js`, dst.)
dimuat hanya kalau template mencantumkannya di `assets.js`; template bebas tidak
memuatnya dan menulis perilakunya sendiri.

**Kalau dimuat, kontrak DOM-nya wajib dipenuhi.** Modul-modul itu memang keluar
lebih awal saat elemen utamanya tidak ada, tapi setelah lolos penjagaan itu mereka
memanggil `el.querySelector(...).addEventListener(...)` tanpa penjagaan null —
mis. `gift.js` dan `qr-checkin.js` mencari `.modal__close` di dalam modalnya, dan
`rsvp.js` hanya mengenali tombol `.rsvp-pill[data-value]` (bukan `<select>`). Satu
kait yang hilang bukan berarti fiturnya diam-diam mati: `render()` melempar dan
SEMUA yang dipanggil sesudahnya ikut batal. `scripts/test-template-shared-modules.mjs`
mengunci daftar kait per modul di DOM sungguhan — jalankan setelah menambah
template baru.

**Setelan per-template.** Warna, font, override editor visual, urutan section, dan
pilihan+crop foto disimpan terpisah di `content.templates[<id>]` — tidak pernah
bocor antar template. Data inti (nama, tanggal, venue, cerita, rekening) dipakai
bersama supaya client tidak perlu mengisi ulang saat mencoba template lain.

## `template.json`

```jsonc
{
  "id": "klasik",
  "name": "Classic Elegance",
  "version": 3,
  "description": "Hangat, emas, timeless.",
  "assets": {
    "css": ["https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"],
    "js":  ["https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js",
            "assets/js/gallery.js"],
    "fonts": ["https://fonts.googleapis.com/css2?family=..."]
  },
  "theme": { "--color-bg": "#f7f3ea" },        // nilai default, dipasang mesin
  "editor": {
    "colors": [ { "key": "bg", "var": "--color-bg", "label": "Latar halaman", "default": "#f7f3ea" } ],
    "overlays": [ { "key": "flat", "label": "Cover & pembuka", "default": "#0a0907", "opacity": 0.22 } ],
    "presets": [ { "id": "golden-hour", "label": "Golden Hour", "colors": { "bg": "#f7f3ea" },
                   "overlayColors": { "flat": "#0a0907" } } ],
    "sections": [
      { "key": "cover", "label": "Cover", "icon": "image",
        "cards": [ { "name": "Cover", "desc": "Foto pertama yang dilihat tamu." } ],
        "fields": [ { "path": "subcover.quoteLine1", "type": "text", "label": "Quote baris 1",
                      "card": "Subcover" } ],
        "photos": [ { "slot": "cover", "label": "Foto cover", "card": "Cover",
                      "ratio": "9/16", "min": 1, "max": 5 } ] }
    ]
  }
}
```

**`editor.sections`** menentukan bab & field yang muncul di panel admin —
`router.js` mendaftarkannya lewat renderer generik `panel/pages/section.js`, jadi
menambah field untuk satu template cukup dengan menambah entri di sini; tidak ada
halaman admin yang perlu ditulis.

Tipe field yang dirender: `text` (bawaan), `textarea` (+`rows`), `switch`,
`colorlist`, dan `list` (+`item` berisi field anak bertipe `text`/`textarea`/
`switch`/`select`+`options`, plus `addLabel` & `newItem`). Tipe lain diperlakukan
sebagai `text` — sengaja: `<input type=date|time>` akan MENGOSONGKAN nilai yang
formatnya tidak dikenalinya (config memakai `"10.00"`, bukan `"10:00"`), dan itu
berarti kehilangan data saat disimpan.

Atribut pendukung: `card` (mengelompokkan ke kartu bernama), `cardDesc`, `required`
(kosong = simpan diblokir dengan pesan), `placeholder`. `section.cards`
menetapkan urutan & deskripsi kartu lebih dulu — perlu ketika kartu pertama hanya
berisi foto sementara field-nya milik kartu berikutnya.

`path` menunjuk ke data inti (mis. `couple.bride.name`). Awalan `extras.` menunjuk ke
`content.templates[<id>].extras` — untuk field yang hanya ada di template ini.

**`editor.colors`** memasangkan `key` (tempat simpan di
`content.templates[<id>].theme.colors`) dengan `var` (nama variabel CSS milik
`style.css` template ini). Halaman Warna membangun dirinya dari daftar ini dan tidak
tahu nama variabel satu template pun; sisi tamu memasangkannya kembali lewat
`WeddingEngine.applyThemeOverrides`. Tiap `var` wajib benar-benar dipakai
`style.css` dan punya nilai bawaan di `theme` — dikunci
`scripts/test-template-contract.mjs`. `overlays` dan `presets` opsional; template
tanpa `colors` menyatakan terang-terangan bahwa warnanya ditetapkan desain.

## `render.js`

```js
window.WeddingTemplates["klasik"] = {
  render(ctx) { /* isi markup, pasang perilaku */ },
  destroy() { /* lepas listener/observer — dipanggil saat ganti template */ }
};
```

`ctx` yang diterima:

| Isi | Keterangan |
|---|---|
| `ctx.mount` | elemen tempat `markup.html` sudah dipasang |
| `ctx.data` | konten inti hasil merge Supabase + fallback `config.js` |
| `ctx.tpl` | blok setelan template ini (`theme`, `extras`, `sections`, `photos`) |
| `ctx.photos(slot)` | daftar foto slot itu, crop per-template sudah diterapkan |
| `ctx.guest` | `{ name, greeting, closing }` sudah diselesaikan dari `?to=` |
| `ctx.fmt` | `dateParts()`, `timeParts()`, `rupiah()`, `calendarUrl()` |
| `ctx.esc` | escape HTML untuk konten yang diedit admin |
| `ctx.services` | `rsvp`, `checkin`, `audio`, `reveal`, `countdown` |

## Konvensi ID opsional

Modul perilaku bersama mengenali ID ini kalau ada di markup. Template boleh
mengabaikan semuanya dan menangani sendiri:

`#btn-open` `#invitation` `#preloader` `#bg-audio` `#audio-toggle`
`#btn-qr-checkin` `#qr-checkin-modal` `#rsvp-form` `#wishes-list`
`#btn-nav-menu` `#nav-menu-modal` `#gift-*` `#cd-days|hours|minutes|seconds`
