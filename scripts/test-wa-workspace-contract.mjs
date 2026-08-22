import fs from "node:fs/promises";

const [page, css, runtime, routing, blast] = await Promise.all([
  fs.readFile("wa.html", "utf8"),
  fs.readFile("assets/css/wa.css", "utf8"),
  fs.readFile("assets/js/wa.js", "utf8"),
  fs.readFile("assets/js/tenant.js", "utf8"),
  fs.readFile("assets/js/admin/wa-blast.js", "utf8")
]);

const checks = [
  ["shell tidak mewarisi admin gelap", !page.includes("assets/css/admin.css") && page.includes("assets/css/wa.css")],
  ["shell menyediakan kirim manual", page.includes("wa-blast.js") && !runtime.includes("setInterval(")],
  ["guard hanya admin", /allowedRoles:\s*\["admin", "root_owner"\]/.test(runtime)],
  ["route tenant WA tersedia", /kind === "wa"/.test(routing) && /"wa.html"/.test(routing)],
  ["visual terang memakai token sendiri", css.includes("--wa-paper") && css.includes("--wa-green")],
  ["pencarian dan list compact tersedia", page.includes("wa-contacts") && css.includes("wa-contact-shell") && css.includes("wa-status-filters")],
  // Aksi utama "Tambah kontak" punya titik masuk kedua yang mengikuti
  // viewport (dulu FAB) — terjangkau dari posisi scroll mana pun di daftar,
  // membuka modal yang sama dengan #wa-add, dan ikut disabled tanpa list.
  // Bottom navbar gaya aplikasi mobile (≤800px): SEMUA aksi kontak pindah
  // ke bar bawah saat dibuka di HP — toolbar atas disembunyikan, tidak ada
  // FAB mengambang. Item memicu tombol toolbar pasangannya (satu sumber
  // logika & disabled-state), "Kelola" link keluar ke panel #/kontak.
  // Lima slot dengan "Dari kontak" sebagai item TENGAH primary (disc hijau),
  // dan "Link & Template" membuka section Pengaturan pesan di atas.
  ["bottom navbar: lima item aksi di markup", page.includes('id="wa-nav-add"') && page.includes('id="wa-nav-from"') && page.includes('id="wa-nav-import"') && page.includes('id="wa-nav-links"') && page.includes('id="wa-nav-manage"') && !page.includes("wa-fab")],
  ["bottom navbar: tengah primary disc menggantung", /grid-template-columns:\s*repeat\(5,\s*1fr\)/.test(css) && css.includes("wa-bottomnav__item--primary") && css.includes(".wa-bottomnav__disc") && /margin-top:\s*-18px/.test(css)],
  // "Link & Template" bukan pasangan tombol toolbar — handler-nya sendiri:
  // buka <details> Pengaturan pesan, scroll halus, flash ring ±1,6s
  // (restart via void offsetWidth supaya klik ulang tetap terlihat).
  [
    "navbar Link & Template membuka Pengaturan pesan dengan flash",
    /\[\s*"wa-nav-links"/.test(blast) === false &&
      /getElementById\("wa-nav-links"\)/.test(blast) &&
      blast.includes('document.querySelector(".wa-config")') &&
      /config\.open = true;/.test(blast) &&
      /config\.scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/.test(blast) &&
      blast.includes('void config.offsetWidth') &&
      blast.includes('config.classList.add("wa-config--flash")') &&
      css.includes(".wa-config--flash") &&
      /@keyframes wa-config-flash/.test(css)
  ],
  // Impor file menerima vCard (.vcf) selain CSV & Excel: accept input file,
  // parser parseVcf tersedia, dan routing ekstensi mengarahkannya.
  [
    "impor menerima vCard (.vcf)",
    /accept="\.csv,\.xlsx,\.xls,\.vcf"/.test(page) &&
      blast.includes("function parseVcf(text)") &&
      blast.includes('ext === "vcf" ? parseVcf(await file.text())')
  ],
  ["bottom navbar: wiring memicu toolbar + sinkron disabled", /\[\s*"wa-nav-add",\s*"wa-add"/.test(blast) && /classList\.toggle\("wa-bottomnav__item--disabled"/.test(blast)],
  ["bottom navbar: hanya tampil di mobile, toolbar atas disembunyikan", css.includes(".wa-bottomnav { display: none; }") && /\.wa-toolbar--actions\s*\{\s*display:\s*none/.test(css)],
  // Select "Daftar kirim" tidak lagi memakai tampilan native kotak:
  // appearance none + panah chevron custom.
  ["select daftar kirim dipolasi (bukan kotak native)", /appearance:\s*none/.test(css) && css.includes("data:image/svg+xml") && /wa-list-bar select:focus/.test(css)],
  // Select "Daftar kirim" full width di HP: parent label-nya harus dibentangkan
  // dulu (flex-item berukuran konten membuat width:100% resolusinya melingkar).
  ["select daftar kirim full width di mobile", /\.wa-list-bar label\s*\{\s*flex:\s*1 1 100%/.test(css)],
  // Tooltip long-press item navbar: teks dari atribut title (desktop hover
  // native), bubble .wa-navtip untuk HP, dan aksi tak jalan setelah hold.
  // Regex item harus menerima suffix class (--primary pada item tengah).
  ["tooltip long-press item navbar", (page.match(/class="wa-bottomnav__item[^"]*"[^>]*title=/g) || []).length === 5 && css.includes(".wa-navtip--show") && /pointerType === "mouse"/.test(blast) && /suppressUntil = Date\.now\(\) \+ 700/.test(blast)],
  // "Pilih dari kontak HP" DI DALAM modal Tambah-dari-kontak: tombol default
  // hidden (Contact Picker API cuma ada di Chromium Android — iPhone/desktop
  // tidak pernah melihatnya), wa-blast.js menampilkannya hanya saat
  // navigator.contacts tersedia dan memakai select(["name","tel"], multiple).
  [
    "pilih dari kontak HP hanya di browser pendukung",
    page.includes('id="wa-from-contacts-phone"') &&
      /id="wa-from-contacts-phone"[^>]*hidden/.test(page) &&
      blast.includes("navigator.contacts.select") &&
      blast.includes('select(["name", "tel"], { multiple: true })') &&
      blast.includes("fcPhoneBtn.hidden = !hasPhoneContacts")
  ],
  // Modal "Isi nomor dari kontak" (baris tanpa nomor) punya jalur yang sama:
  // satu pilihan langsung diterapkan via applyPickedPhone (modal ini tanpa
  // tombol simpan), kontak tanpa nomor ditolak dengan pesan.
  [
    "isi nomor baris tanpa nomor juga bisa dari kontak HP",
    page.includes('id="wa-pick-phone-hp"') && /id="wa-pick-phone-hp"[^>]*hidden/.test(page) &&
      blast.includes("ppPhoneBtn.hidden = !hasPhoneContacts") &&
      /ppPhoneBtn[\s\S]{0,900}applyPickedPhone\(\{ name:/.test(blast)
  ],
  // Empty state daftar kontak tidak boleh menempel ke tepi container —
  // .wa-contacts (tanpa CSS sendiri) memuat pesan kosong langsung.
  ["empty state daftar berjarak dari pinggir", /\.wa-contact-empty\s*\{[^}]*padding:1\.4rem 1rem/.test(css)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
