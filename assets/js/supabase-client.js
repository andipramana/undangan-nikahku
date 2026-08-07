/**
 * Inisialisasi Supabase client (browser, publishable/anon key — aman
 * karena akses tabel dibatasi lewat Row Level Security).
 */
(function () {
  try {
    const cfg = window.WEDDING_CONFIG.supabase;
    if (window.supabase && cfg.url && cfg.anonKey) {
      window.sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    } else {
      window.sb = null;
    }
  } catch (err) {
    console.error("Gagal inisialisasi Supabase:", err);
    window.sb = null;
  }
})();
