/* Tenant route context shared by the public invitation and both admin panels.
 * On GitHub Pages, unknown pretty paths arrive through 404.html as
 * ?__tenant_route=/slug/admin/. This script restores the pretty URL after the
 * static shell has loaded, while all assets still resolve from the root files.
 */
(function () {
  const routeFromQuery = new URLSearchParams(location.search).get("__tenant_route");

  // 404.html membungkus pathname + search + hash menjadi SATU string, mis.
  // "/julia-dan-kevin?to=Putri". Urai dulu menjadi tiga bagian: kalau seluruh
  // string diperlakukan sebagai path, "?to=Putri" ikut menjadi bagian path —
  // slug gagal dikenali (jatuh ke root), lalu "/" ditambahkan di ujungnya
  // sehingga nama tamu terbaca "Putri/".
  let routePath = location.pathname;
  let routeSearch = location.search;
  let routeHash = location.hash;
  if (routeFromQuery) {
    const hashAt = routeFromQuery.indexOf("#");
    const beforeHash = hashAt >= 0 ? routeFromQuery.slice(0, hashAt) : routeFromQuery;
    routeHash = hashAt >= 0 ? routeFromQuery.slice(hashAt) : "";
    const queryAt = beforeHash.indexOf("?");
    routePath = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
    routeSearch = queryAt >= 0 ? beforeHash.slice(queryAt) : "";
  }
  const parts = routePath.split("/").filter(Boolean);
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  // Root routes (/admin/, /admin-qr/) are distinct from tenant routes
  // (/siti-dan-ujang/admin/).
  const rootSurface = parts[0] === "admin" ? "admin" : parts[0] === "admin-qr" ? "admin-qr" : parts[0] === "wa" ? "wa" : null;
  const slug = rootSurface ? "root" : (parts[0] && slugPattern.test(parts[0]) ? parts[0] : "root");
  const surface = rootSurface || (parts[1] === "admin" ? "admin" : parts[1] === "admin-qr" ? "admin-qr" : parts[1] === "wa" ? "wa" : "invitation");

  // 404 fallback initially opens index.html. Switch static shell before it
  // renders when the requested route is an admin surface.
  if (routeFromQuery && location.pathname.endsWith("index.html") && surface !== "invitation") {
    const shell = surface === "admin" ? "admin.html" : surface === "admin-qr" ? "admin-qr.html" : "wa.html";
    location.replace(`/${shell}?__tenant_route=${encodeURIComponent(routeFromQuery)}`);
    return;
  }

  if (routeFromQuery) {
    // Kembalikan query & hash ASLI sekarang juga, sebelum skrip lain jalan:
    // core/context.js (?to=), engine.js/main.js (?template=), supabase-client.js
    // (?preview=) dan router admin (#/acara) semuanya membaca location saat
    // boot, sedangkan yang tersisa di sini cuma ?__tenant_route=. Path-nya
    // sengaja dibiarkan (index.html / admin.html) — hanya search & hash yang
    // dipulihkan, jadi cara aset di-resolve tidak berubah.
    history.replaceState(null, "", location.pathname + routeSearch + routeHash);

    // Keep the real document URL at / while scripts/styles load; otherwise
    // relative asset URLs would resolve under /slug/. Clean the address only
    // after all static assets were requested. Slash akhir hanya untuk PATH —
    // menambahkannya ke query/hash merusak nilai ("Putri/", "#/acara/").
    const cleanPath = routePath.startsWith("/") ? routePath : `/${routePath}`;
    window.addEventListener("load", () => {
      history.replaceState(null, "", (cleanPath.endsWith("/") ? cleanPath : `${cleanPath}/`) + routeSearch + routeHash);
    }, { once: true });
  }

  const basePath = slug === "root" ? "/" : `/${slug}/`;
  window.TenantContext = {
    slug,
    surface,
    basePath,
    invitationId: null,
    setInvitation(invitation) {
      this.invitationId = invitation && invitation.id ? invitation.id : null;
      return this.invitationId;
    },
    path(kind) {
      if (kind === "admin") return slug === "root" ? "/admin/" : `/${slug}/admin/`;
      if (kind === "admin-qr") return slug === "root" ? "/admin-qr/" : `/${slug}/admin-qr/`;
      if (kind === "wa") return slug === "root" ? "/wa/" : `/${slug}/wa/`;
      return basePath;
    },
    storagePath(filename) {
      if (!filename || filename.includes("..") || filename.startsWith("/")) throw new Error("Nama file tidak valid");
      return `${slug}/${filename}`;
    }
  };
})();
