/** Section "We Found Love": kartu lipat 3D "M & A" + ayat quran, port dari
 * example/fold/ (lihat CATATAN-IMPLEMENTASI-FOLD.md di folder itu untuk
 * detail jebakan implementasi). Checkbox tersembunyi #wfl-more-info
 * men-drive SEMUA animasi lewat CSS `:checked ~` (murni CSS, lihat
 * style.css) — JS di sini CUMA:
 *   1. Ambil SATU foto (sort_order awal) dari folder 'wfl' (Supabase,
 *      fallback manifest lokal), set sebagai var(--img) di section (foto
 *      DIREGANG oleh CSS via background-size 300%, bukan cover/contain —
 *      itu bagian dari desain, bukan bug, jangan diubah jadi cover-fit).
 *   2. Centang checkbox SEKALI saat section masuk viewport (IntersectionObserver,
 *      threshold 0.25) — TIDAK PERNAH dilepas lagi setelahnya, konsisten
 *      dengan pola "sekali reveal, selamanya reveal" section lain di
 *      project ini (beda dari demo example/fold/ yang auto-tutup saat
 *      discroll keluar; di sini sengaja tidak, supaya tidak "reset" kalau
 *      tamu scroll bolak-balik).
 *   3. prefers-reduced-motion: langsung centang tanpa observer (CSS media
 *      query di style.css yang menonaktifkan transition-nya). */
window.initWeFoundLove = async function () {
  const section = document.getElementById("we-found-love");
  const checkbox = document.getElementById("wfl-more-info");
  if (!section || !checkbox) return;

  const photos = (await window.getPhotos("wfl")) || [];
  if (!photos.length) return;
  const photo = photos[0];
  const src = photo.path && !photo.webp ? window.photoUrl(photo.path) : photo.webp || photo.jpg;
  section.style.setProperty("--img", 'url("' + src + '")');

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    checkbox.checked = true;
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        checkbox.checked = true;
      }
    },
    { threshold: 0.25 }
  );
  observer.observe(section);
};
