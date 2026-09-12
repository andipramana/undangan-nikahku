/** Pecah teks jadi satu <span> per huruf — modul perilaku OPT-IN, dimuat
 * lewat assets.js di template.json (sejajar rsvp.js / gift.js), BUKAN bagian
 * core: core tidak boleh membuat elemen DOM sama sekali, karena seluruh
 * markup adalah milik template (docs/kontrak-template.md).
 *
 * Dipakai template untuk memunculkan nama mempelai huruf demi huruf — gerak
 * yang paling terasa "mendarat" pada tipografi besar. Sengaja ditulis sendiri
 * ketimbang memasang SplitType/Splitting.js: keduanya 2–4 KB untuk pekerjaan
 * yang muat dalam belasan baris, dan tiap KB terasa di HP dengan koneksi
 * lambat.
 */
/** Pecah teks jadi satu <span> per huruf, tiap huruf membawa nomor urutnya
 * di --c. Template memakainya untuk memunculkan nama mempelai huruf demi
 * huruf — gerak yang paling terasa "mendarat" pada tipografi besar, dan
 * tidak butuh satu pun library (SplitType/Splitting.js kira-kira 2–4 KB
 * untuk pekerjaan yang muat dalam belasan baris ini).
 *
 * HARUS dipanggil SETELAH override editor visual dijalankan: modul itu
 * menulis ulang textContent, yang akan menghapus span-span ini.
 *
 * Spasi dijadikan span ber-kelas tersendiri supaya jeda antar kata tetap
 * ada saat huruf dianimasikan, dan teks aslinya disimpan di aria-label agar
 * pembaca layar tetap membacanya sebagai satu kata, bukan deretan huruf. */
window.splitChars = function (el) {
  if (!el || el.dataset.split === "1") return;
  const text = el.textContent;
  if (!text.trim()) return;

  el.setAttribute("aria-label", text.trim());
  el.dataset.split = "1";
  el.textContent = "";

  [...text].forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = ch === " " ? "ch ch--space" : "ch";
    span.textContent = ch === " " ? " " : ch;
    span.style.setProperty("--c", String(i));
    span.setAttribute("aria-hidden", "true");
    el.appendChild(span);
  });
};
