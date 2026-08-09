import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  // Root-only authorization tetap divalidasi dari JWT di bawah. Origin wildcard
  // diperlukan agar panel register dapat dipakai dari LAN (http://192.168.x.x).
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const fail = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers });
const clean = (value: unknown) => String(value || "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return fail("Method tidak diizinkan", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("Login owner diperlukan", 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return fail("Sesi tidak valid", 401);
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner } = await admin.auth.admin.getUserById(user.id);
  if (owner?.user?.app_metadata?.role !== "root_owner") return fail("Hanya admin root yang boleh mengelola client", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Payload tidak valid"); }
  const action = clean(body.action || "create");

  if (action === "list") {
    const { data: invitations, error } = await admin.from("invitations").select("id,slug,display_name,is_active,created_at").neq("slug", "root").order("created_at", { ascending: false });
    if (error) return fail(error.message);
    const result = [];
    for (const invitation of invitations || []) {
      const { data: members } = await admin.from("invitation_members").select("user_id,role").eq("invitation_id", invitation.id);
      const people = [];
      for (const member of members || []) {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        people.push({ role: member.role, email: data.user?.email || "", userId: member.user_id });
      }
      result.push({ ...invitation, members: people });
    }
    return new Response(JSON.stringify({ clients: result }), { headers });
  }

  if (action === "update") {
    const id = clean(body.invitationId), displayName = clean(body.displayName);
    if (!id || !displayName) return fail("Nama client wajib diisi");
    const { data, error } = await admin.from("invitations").update({ display_name: displayName, is_active: body.isActive !== false }).eq("id", id).neq("slug", "root").select("id,slug,display_name,is_active").single();
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ invitation: data }), { headers });
  }

  if (action === "delete") {
    const id = clean(body.invitationId);
    if (!id) return fail("Client tidak valid");
    const { data: invitation, error: inviteError } = await admin.from("invitations").select("id,slug").eq("id", id).neq("slug", "root").single();
    if (inviteError || !invitation) return fail("Client tidak ditemukan", 404);
    const { data: members, error: memberError } = await admin.from("invitation_members").select("user_id").eq("invitation_id", id);
    if (memberError) return fail(memberError.message);

    // Objek Storage tidak ikut cascade oleh FK database. Jangan mengakses
    // schema internal `storage` lewat PostgREST; gunakan Storage API resmi.
    const bucket = admin.storage.from("photos");
    const files: string[] = [];
    const collectFiles = async (prefix: string) => {
      const { data, error } = await bucket.list(prefix, { limit: 1000, offset: 0 });
      if (error) throw new Error(error.message);
      for (const item of data || []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        // File memiliki metadata/id; folder virtual tidak.
        if (item.id) files.push(path);
        else await collectFiles(path);
      }
    };
    try {
      await collectFiles(invitation.slug);
      for (let start = 0; start < files.length; start += 100) {
        const { error } = await bucket.remove(files.slice(start, start + 100));
        if (error) throw new Error(error.message);
      }
    } catch (error) {
      return fail("Gagal menghapus foto tenant: " + (error instanceof Error ? error.message : "Storage tidak dapat diakses"));
    }
    const { error: deleteError } = await admin.from("invitations").delete().eq("id", id);
    if (deleteError) return fail("Gagal menghapus data tenant: " + deleteError.message);

    // Hapus akun Auth hanya bila tidak memiliki membership di tenant lain.
    // Ini mencegah satu alamat email yang dipakai lintas tenant ikut terhapus.
    const retained: string[] = [];
    for (const member of members || []) {
      const { count } = await admin.from("invitation_members").select("*", { count: "exact", head: true }).eq("user_id", member.user_id);
      if (count) { retained.push(member.user_id); continue; }
      const { error } = await admin.auth.admin.deleteUser(member.user_id);
      if (error) retained.push(member.user_id);
    }
    return new Response(JSON.stringify({ deleted: true, retainedUserIds: retained }), { headers });
  }

  type TemplatePhoto = { folder: string; storage_path: string; sort_order: number; focal_x: number; focal_y: number; zoom: number; alt: string; width: number | null; height: number | null; gallery_layout: string; gallery_row: number };
  const templateName = "default";
  const blankPerson = (name: string) => ({ name, nickname: name, father: "", mother: "", instagram: "" });
  const sanitizeContent = (raw: Record<string, unknown>, displayName = "Undangan Demo") => {
    const content = structuredClone(raw) as Record<string, any>;
    content.couple = { ...(content.couple || {}), bride: blankPerson("Mempelai Wanita"), groom: blankPerson("Mempelai Pria") };
    content.siteTitle = `${displayName} — The Wedding`;
    content.livestream = { youtube: "", instagram: "", tiktok: "" }; content.galleryVideo = { youtube: "" };
    content.gift = { accounts: [], contactCPP: "", contactCPW: "", address: { recipient: "", phone: "", detail: "" }, note: "" };
    content.event = { ...(content.event || {}), dateISO: "", dateLabel: "", dayLabel: "", countdownTarget: "", akad: { label: "Akad Nikah", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } }, resepsi: { label: "Resepsi", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } } };
    content.loveStory = []; content.guestGreetings = [];
    return content;
  };
  const copyObject = async (from: string, to: string) => {
    const bucket = admin.storage.from("photos"); const { data, error } = await bucket.download(from);
    if (error || !data) throw new Error(error?.message || `Foto template tidak dapat dibaca: ${from}`);
    const { error: uploadError } = await bucket.upload(to, data, { upsert: true, contentType: data.type || undefined });
    if (uploadError) throw new Error(uploadError.message);
  };
  const readTemplate = async () => {
    const { data, error } = await admin.from("invitation_templates").select("content,photos").eq("name", templateName).single();
    if (error || !data) throw new Error("Default statis belum dibuat. Ambil snapshot root terlebih dahulu.");
    return { content: data.content as Record<string, unknown>, photos: (data.photos || []) as TemplatePhoto[] };
  };
  const applyTemplate = async (toInvitationId: string, displayName: string, brideName = "Mempelai Wanita", groomName = "Mempelai Pria") => {
    const template = await readTemplate(); const content = sanitizeContent(template.content, displayName);
    content.couple = { ...(content.couple || {}), bride: blankPerson(brideName), groom: blankPerson(groomName) };
    const { error: contentError } = await admin.from("site_content").upsert({ invitation_id: toInvitationId, id: 1, content }, { onConflict: "invitation_id,id" });
    if (contentError) throw new Error(contentError.message);
    const { error: removeError } = await admin.from("photos").delete().eq("invitation_id", toInvitationId);
    if (removeError) throw new Error(removeError.message);
    if (template.photos.length) {
      const { error: photoError } = await admin.from("photos").insert(template.photos.map((photo) => ({ ...photo, invitation_id: toInvitationId })));
      if (photoError) throw new Error(photoError.message);
    }
  };
  // Captures root once into an independent static template. Assets are physically
  // copied under templates/default so later root edits/deletions cannot affect it.
  if (action === "capture_default_template") {
    const { data: root, error: rootError } = await admin.from("invitations").select("id,updated_at").eq("slug", "root").single();
    if (rootError || !root) return fail("Undangan root tidak ditemukan", 404);
    const { data: rootContent, error: contentError } = await admin.from("site_content").select("content,updated_at").eq("invitation_id", root.id).eq("id", 1).single();
    const { data: rootPhotos, error: photoError } = await admin.from("photos").select("folder,storage_path,sort_order,focal_x,focal_y,zoom,alt,width,height,gallery_layout,gallery_row").eq("invitation_id", root.id).order("folder").order("sort_order").order("id");
    if (contentError || !rootContent?.content || photoError) return fail(contentError?.message || photoError?.message || "State root belum siap", 409);
    try {
      const capturedPhotos: TemplatePhoto[] = [];
      for (const [index, photo] of (rootPhotos || []).entries()) {
        const extension = photo.storage_path.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
        const staticPath = `templates/default/photos/${String(index).padStart(3, "0")}.${extension}`;
        await copyObject(photo.storage_path, staticPath);
        capturedPhotos.push({ ...photo, storage_path: staticPath });
      }
      const content = sanitizeContent(rootContent.content as Record<string, unknown>);
      const originalAudioPath = content.audio?.path;
      if (originalAudioPath) { const extension = String(originalAudioPath).split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "mp3"; const staticAudioPath = `templates/default/audio/backsound.${extension}`; await copyObject(originalAudioPath, staticAudioPath); content.audio.path = staticAudioPath; content.audio.src = ""; }
      const { error } = await admin.from("invitation_templates").upsert({ name: templateName, content, photos: capturedPhotos, source_root_updated_at: rootContent.updated_at || root.updated_at, captured_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "name" });
      if (error) throw new Error(error.message);
    } catch (error) { return fail(error instanceof Error ? error.message : "Gagal mengambil snapshot default"); }
    return new Response(JSON.stringify({ template: templateName, capturedFrom: "root" }), { headers });
  }
  if (action === "sync_demo") {
    const { data: demo, error: demoError } = await admin.from("invitations").upsert({ slug: "demo", display_name: "Demo Undangan" }, { onConflict: "slug" }).select("id,slug").single();
    if (demoError || !demo) return fail(demoError?.message || "Gagal menyiapkan demo");
    try { await applyTemplate(demo.id, "Demo Undangan"); const { error: waError } = await admin.from("wa_settings").upsert({ invitation_id: demo.id, id: 1, invitation_link: "https://undangan.andipramana.com/demo/" }, { onConflict: "invitation_id,id" }); if (waError) throw new Error(waError.message); }
    catch (error) { return fail(error instanceof Error ? error.message : "Gagal memperbarui demo dari default statis"); }
    return new Response(JSON.stringify({ demo: { slug: demo.slug }, copiedFrom: "static_default" }), { headers });
  }

  if (action !== "create") return fail("Aksi tidak dikenal");
  const slug = clean(body.slug).toLowerCase();
  if (slug === "root" || slug === "demo") return fail("Slug ini dicadangkan untuk template sistem");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail("Slug hanya huruf kecil, angka, dan tanda hubung");
  for (const field of ["adminEmail", "adminPassword", "qrEmail", "qrPassword"]) if (!clean(body[field])) return fail(`Field ${field} wajib diisi`);
  const { data: created, error: invitationError } = await admin.from("invitations").insert({ slug, display_name: clean(body.displayName || slug) }).select("id,slug").single();
  if (invitationError) return fail(invitationError.code === "23505" ? "Slug sudah dipakai" : invitationError.message);
  const invitationId = created.id;
  const createdUsers: string[] = [];
  const rollback = async () => { await admin.from("invitations").delete().eq("id", invitationId); for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId); };
  const createAccount = async (email: string, password: string, role: "admin" | "admin_qr") => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message || "Gagal membuat akun");
    createdUsers.push(data.user.id);
    const { error: memberError } = await admin.from("invitation_members").insert({ invitation_id: invitationId, user_id: data.user.id, role });
    if (memberError) throw new Error(memberError.message);
  };
  try {
    await createAccount(clean(body.adminEmail), String(body.adminPassword), "admin");
    await createAccount(clean(body.qrEmail), String(body.qrPassword), "admin_qr");
    await applyTemplate(invitationId, clean(body.displayName || slug), clean(body.brideName || "Mempelai Wanita"), clean(body.groomName || "Mempelai Pria"));
    const { error: settingError } = await admin.from("wa_settings").insert({ invitation_id: invitationId, id: 1, invitation_link: `https://undangan.andipramana.com/${slug}/` }); if (settingError) throw new Error(settingError.message);
  } catch (error) { await rollback(); return fail(error instanceof Error ? error.message : "Provisioning gagal"); }
  return new Response(JSON.stringify({ invitation: created, urls: { invitation: `/${slug}/`, admin: `/${slug}/admin/`, adminQr: `/${slug}/admin-qr/` } }), { headers });
});
