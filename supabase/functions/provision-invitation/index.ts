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

  if (action !== "create") return fail("Aksi tidak dikenal");
  const slug = clean(body.slug).toLowerCase();
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
    const { data: root } = await admin.from("invitations").select("id").eq("slug", "root").single();
    const { data: rootContent } = await admin.from("site_content").select("content").eq("invitation_id", root?.id).eq("id", 1).maybeSingle();
    if (rootContent?.content) {
      const content = structuredClone(rootContent.content); const brideName = clean(body.brideName); const groomName = clean(body.groomName); const displayName = clean(body.displayName || slug);
      const blankPerson = (name: string) => ({ name, nickname: name, father: "", mother: "", instagram: "" });
      content.couple = { ...(content.couple || {}), bride: blankPerson(brideName || "Mempelai Wanita"), groom: blankPerson(groomName || "Mempelai Pria") };
      content.siteTitle = `${displayName} — The Wedding`; content.livestream = { youtube: "", instagram: "", tiktok: "" }; content.galleryVideo = { youtube: "" };
      content.gift = { accounts: [], contactCPP: "", contactCPW: "", address: { recipient: "", phone: "", detail: "" }, note: "" };
      content.event = { ...(content.event || {}), dateISO: "", dateLabel: "", dayLabel: "", countdownTarget: "", akad: { label: "Akad Nikah", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } }, resepsi: { label: "Resepsi", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } } };
      content.loveStory = [];
      const { error } = await admin.from("site_content").insert({ invitation_id: invitationId, id: 1, content }); if (error) throw new Error(error.message);
    }
    const { error: settingError } = await admin.from("wa_settings").insert({ invitation_id: invitationId, id: 1, invitation_link: `https://undangan.andipramana.com/${slug}/` }); if (settingError) throw new Error(settingError.message);
  } catch (error) { await rollback(); return fail(error instanceof Error ? error.message : "Provisioning gagal"); }
  return new Response(JSON.stringify({ invitation: created, urls: { invitation: `/${slug}/`, admin: `/${slug}/admin/`, adminQr: `/${slug}/admin-qr/` } }), { headers });
});
