/**
 * Klien REST/RPC ringan untuk halaman tamu (tanpa menarik 120 KB SDK penuh
 * @supabase/supabase-js di jalur kritis). Bila halaman (mis. test/admin)
 * sudah memuat window.supabase, gunakan itu; bila tidak, gunakan pembungkus
 * fetch() tipis ke endpoint PostgREST Supabase.
 *
 * Menyediakan:
 *  - window.sb: { rpc(), from(), storage }
 *  - window.fetchInvitation(): panggilan RPC get_invitation() + simpan cache
 *  - window.photoUrl(path): URL publik objek di bucket 'photos'
 *  - window.photoSrcset(path): srcset transformasi gambar Supabase (480w/768w/1200w)
 */
(function () {
  const cfg = window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase;

  function createLiteClient(baseUrl, anonKey) {
    const cleanUrl = String(baseUrl).replace(/\/+$/, "");
    const baseHeaders = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json"
    };

    return {
      storage: {
        from(bucket) {
          return {
            getPublicUrl(path) {
              return {
                data: {
                  publicUrl: `${cleanUrl}/storage/v1/object/public/${bucket}/${path}`
                }
              };
            }
          };
        }
      },
      async rpc(fnName, params) {
        try {
          const res = await fetch(`${cleanUrl}/rest/v1/rpc/${encodeURIComponent(fnName)}`, {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify(params || {})
          });
          const text = await res.text();
          const body = text ? JSON.parse(text) : null;
          if (!res.ok) {
            return { data: null, error: body || { message: `HTTP ${res.status}` } };
          }
          return { data: body, error: null };
        } catch (err) {
          return { data: null, error: { message: err && err.message ? err.message : String(err) } };
        }
      },
      from(table) {
        const state = {
          selectCols: "*",
          wantCount: false,
          filters: [],
          orders: [],
          rangeHeader: null,
          insertPayload: null,
          singleRow: false
        };

        const builder = {
          select(cols = "*", opts = {}) {
            state.selectCols = cols;
            if (opts && opts.count === "exact") state.wantCount = true;
            return builder;
          },
          eq(col, val) {
            if (val !== undefined && val !== null) {
              state.filters.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`);
            }
            return builder;
          },
          order(col, opts = {}) {
            const dir = opts && opts.ascending === false ? "desc" : "asc";
            state.orders.push(`${encodeURIComponent(col)}.${dir}`);
            return builder;
          },
          range(from, to) {
            state.rangeHeader = `${from}-${to}`;
            return builder;
          },
          insert(payload) {
            state.insertPayload = payload;
            return builder;
          },
          single() {
            state.singleRow = true;
            return builder;
          },
          then(onFulfilled, onRejected) {
            return execute().then(onFulfilled, onRejected);
          }
        };

        async function execute() {
          try {
            const headers = { ...baseHeaders };
            const prefer = [];
            if (state.wantCount) prefer.push("count=exact");
            if (state.insertPayload !== null) prefer.push("return=representation");
            if (prefer.length) headers.Prefer = prefer.join(",");
            if (state.rangeHeader) headers.Range = state.rangeHeader;
            if (state.singleRow) {
              headers.Accept = "application/vnd.pgrst.object+json";
            }

            const qs = [];
            if (state.selectCols) qs.push(`select=${encodeURIComponent(state.selectCols)}`);
            qs.push(...state.filters);
            if (state.orders.length) qs.push(`order=${state.orders.join(",")}`);

            const url = `${cleanUrl}/rest/v1/${encodeURIComponent(table)}${qs.length ? `?${qs.join("&")}` : ""}`;
            const res = await fetch(url, {
              method: state.insertPayload !== null ? "POST" : "GET",
              headers,
              body: state.insertPayload !== null ? JSON.stringify(state.insertPayload) : undefined
            });
            const text = await res.text();
            const body = text ? JSON.parse(text) : null;
            if (!res.ok) {
              return { data: null, error: body || { message: `HTTP ${res.status}` }, count: 0 };
            }
            let count = null;
            const cr = res.headers.get("content-range");
            if (cr && cr.includes("/")) {
              const totalStr = cr.split("/")[1];
              const parsed = parseInt(totalStr, 10);
              if (Number.isFinite(parsed)) count = parsed;
            }
            return { data: body, error: null, count };
          } catch (err) {
            return { data: null, error: { message: err && err.message ? err.message : String(err) }, count: 0 };
          }
        }

        return builder;
      }
    };
  }

  let sb = null;
  if (cfg && cfg.url && cfg.anonKey) {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } else {
      sb = createLiteClient(cfg.url, cfg.anonKey);
    }
  } else {
    console.warn("Supabase tidak dikonfigurasi — undangan berjalan penuh dari file lokal.");
  }
  window.sb = sb;

  /** URL publik foto di bucket 'photos'. */
  window.photoUrl = function (path) {
    if (!path) return "";
    if (/^(https?:|data:|blob:|assets\/|templates\/)/.test(path)) return path;
    if (sb && sb.storage) return sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
    if (cfg && cfg.url) return `${cfg.url}/storage/v1/object/public/photos/${path}`;
    return path;
  };

  /** Srcset responsif untuk foto di Supabase Storage (transformasi lebar 480, 768, 1200).
   *  Untuk path lokal di assets/, kembalikan string kosong agar memakai src langsung. */
  window.photoSrcset = function (path) {
    if (!path || /^(https?:|data:|blob:|assets\/|templates\/)/.test(path)) return "";
    const base = window.photoUrl(path);
    if (!base || !base.includes("/storage/v1/object/public/")) return "";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}width=480 480w, ${base}${sep}width=768 768w, ${base}${sep}width=1200 1200w`;
  };

  window.audioUrl = window.photoUrl;

  const tenant = window.TenantContext || { slug: "root", setInvitation() {} };
  const STORAGE_KEY = `wedding_invitation_v2_${tenant.slug}`;

  window.fetchInvitation = async function () {
    if (new URLSearchParams(location.search).get("preview") === "1") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          tenant.setInvitation(data.invitation);
          return data;
        }
      } catch (_) {}
    }
    if (!sb) return null;
    try {
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
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...data, _cachedAt: Date.now() })
        );
      } catch (_) {}
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
