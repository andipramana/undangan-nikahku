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
  ["FAB tambah-kontak mengikuti viewport", page.includes('id="wa-add-fab"') && css.includes(".wa-fab {") && /addFab\.addEventListener\("click", openAdd\)/.test(blast)],
  // Dua FAB dalam satu grup kolom: "Tambah kontak" (primary) & "Dari kontak"
  // (buku alamat panel) — keduanya membuka modal pasangannya di toolbar,
  // keduanya ikut disabled tanpa daftar kirim.
  ["FAB kedua: tambah dari kontak", page.includes('id="wa-add-from-fab"') && css.includes(".wa-fab-group") && css.includes(".wa-fab--secondary") && /addFromFab\.addEventListener\("click", openFromContacts\)/.test(blast) && /"wa-add-from-fab"\]\.forEach/.test(blast)],
  // Select "Daftar kirim" tidak lagi memakai tampilan native kotak:
  // appearance none + panah chevron custom.
  ["select daftar kirim dipolasi (bukan kotak native)", /appearance:\s*none/.test(css) && css.includes("data:image/svg+xml") && /wa-list-bar select:focus/.test(css)]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
