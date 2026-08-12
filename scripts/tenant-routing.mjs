export function parseInvitationRoute(pathname) {
  const parts = String(pathname || "/").split("/").filter(Boolean);
  if (!parts.length) return { slug: "root", surface: "invitation" };
  if (["admin", "admin-qr", "wa"].includes(parts[0]) && parts.length === 1) {
    return { slug: "root", surface: parts[0] };
  }
  const [slug, section] = parts;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (!section) return { slug, surface: "invitation" };
  if (section === "admin") return { slug, surface: "admin" };
  if (section === "admin-qr") return { slug, surface: "admin-qr" };
  if (section === "wa") return { slug, surface: "wa" };
  return null;
}

export function invitationPath(slug, surface = "invitation") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug undangan tidak valid");
  if (surface === "invitation") return slug === "root" ? "/" : `/${slug}/`;
  if (surface === "admin") return slug === "root" ? "/admin/" : `/${slug}/admin/`;
  if (surface === "admin-qr") return slug === "root" ? "/admin-qr/" : `/${slug}/admin-qr/`;
  if (surface === "wa") return slug === "root" ? "/wa/" : `/${slug}/wa/`;
  throw new Error("Surface tidak dikenal");
}

export function storagePath(slug, filename) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug undangan tidak valid");
  if (!filename || filename.includes("..") || filename.startsWith("/")) throw new Error("Nama file tidak valid");
  return `${slug}/${filename}`;
}

export function qrBelongsToInvitation(rawUrl, currentHost, slug) {
  const url = new URL(rawUrl);
  if (url.hostname !== currentHost) return false;
  return parseInvitationRoute(url.pathname)?.slug === slug;
}
