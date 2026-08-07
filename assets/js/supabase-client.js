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
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
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

  // Versi di kunci membedakan bentuk payload kalau skema berubah nanti —
  // cadangan lama yang bentuknya beda tidak boleh dipakai.
  const STORAGE_KEY = "wedding_invitation_v1";

  /** Ambil payload undangan: {content, photos} | null.
   * Prioritas: Supabase → localStorage → null (undangan pakai config.js +
   * manifest lokal seperti sebelum ada panel admin). */
  window.fetchInvitation = async function () {
    if (!sb) return null;
    try {
      const { data, error } = await sb.rpc("get_invitation");
      if (error) throw error;
      if (!data) throw new Error("payload kosong");
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
