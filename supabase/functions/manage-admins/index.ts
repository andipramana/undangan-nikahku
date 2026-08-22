import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Kelola akun admin sebuah tenant dari panel (halaman Akun Admin):
//  - list           : daftar anggota invitation_members + email mereka.
//                     Email TIDAK bisa dibaca client biasa (auth.users
//     terlindungi), jadi perlu service-role di sini. Izin: caller adalah
//     anggota tenant ATAU root_owner.
//  - reset_password : ganti kata sandi salah satu anggota. ROOT_OWNER ONLY —
//     admin tenant biasa tidak boleh menyentuh akun sesamanya. Target wajib
//     anggota tenant yang diminta supaya scope-nya eksplisit.
// Pola persis provision-invitation: verifikasi sesi caller lewat anon client
// ber-header Authorization, operasi sensitif lewat service client.

const headers = {
  "Content-Type": "application/json",
  // Otorisasi tetap divalidasi dari JWT di bawah. Origin wildcard agar panel
  // dapat dipakai dari LAN (http://192.168.x.x).
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
  if (!auth) return fail("Login diperlukan", 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await caller.auth.getUser();
  if (userError || !user) return fail("Sesi tidak valid", 401);
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner } = await admin.auth.admin.getUserById(user.id);
  const isRootOwner = owner?.user?.app_metadata?.role === "root_owner";

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Payload tidak valid"); }
  const action = clean(body.action || "");

  if (action === "list") {
    const invitationId = clean(body.invitationId);
    if (!invitationId) return fail("Undangan tidak valid");
    if (!isRootOwner) {
      const { data: member } = await admin.from("invitation_members")
        .select("user_id").eq("invitation_id", invitationId).eq("user_id", user.id).maybeSingle();
      if (!member) return fail("Kamu bukan anggota undangan ini", 403);
    }
    const { data: members, error } = await admin.from("invitation_members")
      .select("user_id,role,created_at").eq("invitation_id", invitationId).order("created_at");
    if (error) return fail(error.message);
    const people = [];
    for (const member of members || []) {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      people.push({ userId: member.user_id, role: member.role, email: data.user?.email || "", createdAt: member.created_at });
    }
    return new Response(JSON.stringify({ members: people }), { headers });
  }

  if (action === "reset_password") {
    if (!isRootOwner) return fail("Hanya pemilik akar (root owner) yang boleh mengganti sandi anggota", 403);
    const invitationId = clean(body.invitationId);
    const userId = clean(body.userId);
    const password = String(body.password || "");
    if (!invitationId || !userId) return fail("Target tidak valid");
    if (password.length < 8) return fail("Password minimal 8 karakter");
    // Target HARUS anggota tenant ini — jangan pernah menembak user arbitrer
    // di luar scope undangan yang sedang dikelola.
    const { data: member } = await admin.from("invitation_members")
      .select("user_id").eq("invitation_id", invitationId).eq("user_id", userId).maybeSingle();
    if (!member) return fail("Akun target bukan anggota undangan ini", 404);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ reset: true }), { headers });
  }

  return fail("Aksi tidak dikenal");
});
