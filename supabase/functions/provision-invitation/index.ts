import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://undangan.andipramana.com",
  // supabase-js sends x-client-info by default; it must be allowed in the
  // browser preflight or the provisioning POST is blocked before reaching us.
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const fail = (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status, headers });

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
  if (owner?.user?.app_metadata?.role !== "root_owner") return fail("Hanya admin root yang boleh membuat undangan", 403);

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return fail("Payload tidak valid"); }
  const slug = String(body.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail("Slug hanya huruf kecil, angka, dan tanda hubung");
  for (const field of ["adminEmail", "adminPassword", "qrEmail", "qrPassword"]) if (!String(body[field] || "").trim()) return fail(`Field ${field} wajib diisi`);

  const { data: created, error: invitationError } = await admin.from("invitations").insert({ slug, display_name: String(body.displayName || slug) }).select("id,slug").single();
  if (invitationError) return fail(invitationError.code === "23505" ? "Slug sudah dipakai" : invitationError.message);
  const invitationId = created.id;
  const rollback = async () => { await admin.from("invitations").delete().eq("id", invitationId); };
  const createAccount = async (email: string, password: string, role: "admin" | "admin_qr") => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message || "Gagal membuat akun");
    const { error: memberError } = await admin.from("invitation_members").insert({ invitation_id: invitationId, user_id: data.user.id, role });
    if (memberError) throw new Error(memberError.message);
  };
  try {
    await createAccount(String(body.adminEmail).trim(), String(body.adminPassword), "admin");
    await createAccount(String(body.qrEmail).trim(), String(body.qrPassword), "admin_qr");
    const { data: root } = await admin.from("invitations").select("id").eq("slug", "root").single();
    const rootId = root?.id;
    const { data: rootContent } = await admin.from("site_content").select("content").eq("invitation_id", rootId).eq("id", 1).maybeSingle();
    if (rootContent?.content) {
      const content = structuredClone(rootContent.content);
      const brideName = String(body.brideName || "").trim();
      const groomName = String(body.groomName || "").trim();
      const displayName = String(body.displayName || slug).trim();
      const blankPerson = (name: string) => ({
        name,
        nickname: name,
        father: "",
        mother: "",
        instagram: ""
      });
      content.couple = content.couple || {};
      content.couple.bride = blankPerson(brideName || "Mempelai Wanita");
      content.couple.groom = blankPerson(groomName || "Mempelai Pria");

      // Never copy private root data into a customer invitation. The template
      // keeps only generic structure/design; owner/admin fills these later.
      content.siteTitle = `${displayName} — The Wedding`;
      content.livestream = { youtube: "", instagram: "", tiktok: "" };
      content.galleryVideo = { youtube: "" };
      content.gift = {
        accounts: [],
        contactCPP: "",
        contactCPW: "",
        address: { recipient: "", phone: "", detail: "" },
        note: ""
      };
      content.event = {
        ...(content.event || {}),
        dateISO: "",
        dateLabel: "",
        dayLabel: "",
        countdownTarget: "",
        akad: { label: "Akad Nikah", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } },
        resepsi: { label: "Resepsi", start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } }
      };
      content.loveStory = [];
      await admin.from("site_content").insert({ invitation_id: invitationId, id: 1, content });
    }
    // Deliberately do NOT copy root photos, wishes, contacts, templates, or
    // check-ins. Those can contain private data and must start empty per tenant.
    await admin.from("wa_settings").insert({ invitation_id: invitationId, id: 1, invitation_link: `https://undangan.andipramana.com/${slug}/` });
  } catch (error) {
    await rollback();
    return fail(error instanceof Error ? error.message : "Provisioning gagal");
  }
  return new Response(JSON.stringify({ invitation: created, urls: { invitation: `/${slug}/`, admin: `/${slug}/admin/`, adminQr: `/${slug}/admin-qr/` } }), { headers });
});
