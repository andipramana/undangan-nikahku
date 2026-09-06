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
infrastruktur (ambil data, kirim RSVP, check-in QR, format tanggal) — tidak boleh
membuat elemen visual apa pun. Modul perilaku lama (`gallery.js`, `gift.js`, dst.)
bersifat opsional: semuanya menjaga diri dengan `if (!el) return`, jadi template
yang tidak memakai ID terkait otomatis tidak mengaktifkannya. Template bebas tidak
memuatnya dan menulis perilakunya sendiri.

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
  "theme": { "--color-bg": "#f7f3ea" },        // nilai default, bisa ditimpa admin
  "editor": {
    "sections": [
      { "key": "cover", "label": "Cover", "icon": "image",
        "fields": [ { "path": "couple.bride.nickname", "type": "text", "label": "Panggilan wanita" } ],
        "photos": [ { "slot": "cover", "label": "Foto cover", "ratio": "9/16", "min": 1, "max": 5 } ],
        "extras": [ { "path": "extras.tagline", "type": "text", "label": "Tagline" } ] }
    ]
  }
}
```

`editor.sections` menentukan halaman & field yang muncul di panel admin. Menambah
field untuk satu template cukup dengan menambah entri di sini — tidak perlu menulis
halaman admin baru.

Tipe field yang didukung `type`: `text`, `textarea`, `date`, `time`, `url`, `color`,
`number`, `switch`, `select` (+`options`), `list` (+`item` berisi field anak).

`path` menunjuk ke data inti (mis. `couple.bride.name`). Awalan `extras.` menunjuk ke
`content.templates[<id>].extras` — dipakai untuk field yang hanya ada di template ini.

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
| `ctx.fmt` | `date()`, `time()`, `rupiah()`, `calendarUrl()` |
| `ctx.esc` | escape HTML untuk konten yang diedit admin |
| `ctx.services` | `rsvp`, `checkin`, `audio`, `reveal`, `countdown` |

## Konvensi ID opsional

Modul perilaku bersama mengenali ID ini kalau ada di markup. Template boleh
mengabaikan semuanya dan menangani sendiri:

`#btn-open` `#invitation` `#preloader` `#bg-audio` `#audio-toggle`
`#btn-qr-checkin` `#qr-checkin-modal` `#rsvp-form` `#wishes-list`
`#btn-nav-menu` `#nav-menu-modal` `#gift-*` `#cd-days|hours|minutes|seconds`
