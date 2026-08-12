/* Tenant route context shared by the public invitation and both admin panels.
 * On GitHub Pages, unknown pretty paths arrive through 404.html as
 * ?__tenant_route=/slug/admin/. This script restores the pretty URL after the
 * static shell has loaded, while all assets still resolve from the root files.
 */
(function () {
  const routeFromQuery = new URLSearchParams(location.search).get("__tenant_route");
  const routePath = routeFromQuery || location.pathname;
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
    // Keep the real document URL at / while scripts/styles load; otherwise
    // relative asset URLs would resolve under /slug/. Clean the address only
    // after all static assets were requested.
    const clean = routePath.startsWith("/") ? routePath : `/${routePath}`;
    window.addEventListener("load", () => {
      history.replaceState(null, "", clean.endsWith("/") ? clean : `${clean}/`);
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
