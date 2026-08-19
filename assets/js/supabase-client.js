/**
 * Inisialisasi Supabase client (browser, publishable/anon key — aman
 * karena akses tabel dibatasi lewat Row Level Security) + dua helper yang
 * dipakai seluruh undangan:
 *
 *  - fetchInvitation(): satu panggilan RPC get_invitation() → teks + seluruh
 *    foto terurut. Hasil terakhir disimpan di localStorage sebagai cadangan;
 *    kalau Supabase mati, undangan tetap tampil (lihat §2.3 rencana admin).
 *  - photoUrl(path): URL publik objek di bucket 'photos'.
 */
(function () {
  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;
  let sb = null;
  if (window.supabase && cfg && cfg.url && cfg.anonKey) {
    // Halaman tamu TIDAK PERNAH login (selalu anon) — tanpa opsi ini, client
    // otomatis coba baca & refresh sesi auth dari localStorage (satu domain
    // dengan admin.html, jadi bisa ketiban sisa sesi admin yang sudah basi),
    // memicu POST .../token?grant_type=refresh_token 400 di console tiap
    // load pertama. Client ini cuma dipakai untuk RPC anon + URL storage,
    // jadi sesi auth tidak relevan sama sekali.
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } else {
    console.warn("Supabase tidak dikonfigurasi — undangan berjalan penuh dari file lokal.");
  }
  window.sb = sb;

  /** URL publik foto di bucket 'photos'. Tanpa client (mis. CDN gagal dimuat),
   * URL dibangun manual dari config — undangan tetap bisa menampilkan foto. */
  window.photoUrl = function (path) {
    if (!path) return "";
    if (sb) return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    return `${cfg.url}/storage/v1/object/public/photos/${path}`;
  };

  // Backsound memakai bucket yang sama, tetapi path-nya selalu tenant-scoped:
  // <slug>/audio/<uuid>.<ext>. Dengan begitu undangan tidak pernah menunjuk
  // atau menimpa file audio milik tenant lain.
  window.audioUrl = window.photoUrl;

  // Versi di kunci membedakan bentuk payload kalau skema berubah nanti —
  // cadangan lama yang bentuknya beda tidak boleh dipakai.
  const tenant = window.TenantContext || { slug: "root", setInvitation() {} };
  const STORAGE_KEY = `wedding_invitation_v2_${tenant.slug}`;

  /** Ambil payload undangan: {content, photos} | null.
   * Prioritas: Supabase → localStorage → null (undangan pakai config.js +
   * manifest lokal seperti sebelum ada panel admin).
   *
   * ?preview=1: dipakai tombol "Pratinjau undangan" di admin (lihat admin.js)
   * — admin sudah menulis draft (get_invitation_draft, belum dipublikasikan)
   * ke localStorage SEBELUM tab ini dibuka. Baca langsung dari situ, jangan
   * panggil get_invitation() publik (yang sekarang membaca snapshot
   * published_*, bukan draft). Cache kosong/rusak → lanjut alur normal di
   * bawah (fail-open ke versi terpublikasi, bukan error). */
  window.fetchInvitation = async function () {
    if (new URLSearchParams(location.search).get("preview") === "1") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          tenant.setInvitation(data.invitation);
          return data;
        }
      } catch (_) {
        // cache preview rusak — jatuh ke alur normal di bawah
      }
    }
    if (!sb) return null;
    try {
      // Batas waktu keras: saat trafik tinggi (banyak tamu buka bersamaan) RPC
      // bisa antre lama di sisi Supabase — tanpa batas ini, tamu bisa menunggu
      // 10-20 detik menatap layar loading. Timeout membuatnya JATUH ke cadangan
      // (localStorage lalu config.js) secepat mungkin alih-alih menunggu tanpa
      // batas; kalau requestnya sendiri akhirnya selesai belakangan, hasilnya
      // dibuang begitu saja (Promise.race, bukan dibatalkan di server).
      const REQUEST_TIMEOUT_MS = 5000;
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Waktu permintaan undangan habis (>5 detik).")), REQUEST_TIMEOUT_MS)
      );
      const { data, error } = await Promise.race([
        sb.rpc("get_invitation", { p_slug: tenant.slug }),
        timeout
      ]);
      if (error) throw error;
      if (!data) throw new Error("Undangan tidak ditemukan atau tidak aktif.");
      tenant.setInvitation(data.invitation);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {
        // localStorage penuh/diblokir — abaikan, cadangan bukan prioritas
      }
      return data;
    } catch (err) {
      console.warn("Supabase tidak merespons — pakai cadangan tersimpan.", err);
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return null;
    }
  };
})();
