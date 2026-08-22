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
  // viewport (FAB) — terjangkau dari posisi scroll mana pun di daftar,
  // membuka modal yang sama dengan #wa-add, dan ikut disabled tanpa list.
  // Bottom navbar gaya aplikasi mobile (≤800px): SEMUA aksi kontak pindah
  // ke bar bawah saat dibuka di HP — toolbar atas disembunyikan, tidak ada
  // FAB mengambang. Item memicu tombol toolbar pasangannya (satu sumber
  // logika & disabled-state), "Kelola" link keluar ke panel #/kontak.
  ["bottom navbar: empat item aksi di markup", page.includes('id="wa-nav-add"') && page.includes('id="wa-nav-from"') && page.includes('id="wa-nav-import"') && page.includes('id="wa-nav-manage"') && !page.includes("wa-fab")],
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
  ["tooltip long-press item navbar", (page.match(/class="wa-bottomnav__item"[^>]*title=/g) || []).length === 4 && css.includes(".wa-navtip--show") && /pointerType === "mouse"/.test(blast) && /suppressUntil = Date\.now\(\) \+ 700/.test(blast)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
