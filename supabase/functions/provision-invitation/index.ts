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

  /* ── Draft dari halaman publik /catin ────────────────────────────────────
     Calon pengantin mengisi form tanpa login; hasilnya baris client_drafts
     (migration 0029). Di sini root owner melihatnya, dan `create` dengan
     draftId menerapkan isinya ke client baru supaya tidak diketik ulang.
     Isi draft adalah INPUT PUBLIK yang tidak tepercaya: setiap nilai dipotong,
     dicek bentuknya, dan hanya ditulis ke key yang memang dikenal. */
  const DRAFT_STATUS = ["baru", "diproses", "dibuat", "ditolak"];
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const dotTime = (v: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? "").trim()); return m ? `${m[1].padStart(2, "0")}.${m[2]}` : ""; };

  const applyDraft = async (invitationId: string, draft: { id: string; payload: any }) => {
    const p = (draft.payload && typeof draft.payload === "object") ? draft.payload : {};
    const { data: row, error: readError } = await admin.from("site_content").select("content").eq("invitation_id", invitationId).eq("id", 1).single();
    if (readError || !row) throw new Error("Konten client belum siap untuk diisi dari draft");
    const content = structuredClone(row.content) as Record<string, any>;

    const person = (src: any, base: any) => ({
      ...(base || {}),
      name: str(src?.name, 80) || base?.name || "", nickname: str(src?.nickname, 30) || base?.nickname || "",
      father: str(src?.father, 80), mother: str(src?.mother, 80),
      childOrder: str(src?.childOrder, 20), instagram: str(src?.instagram, 40).replace(/^@+/, "")
    });
    content.couple = { ...(content.couple || {}), groom: person(p.couple?.groom, content.couple?.groom), bride: person(p.couple?.bride, content.couple?.bride) };
    const bride = content.couple.bride, groom = content.couple.groom;
    content.siteTitle = `${bride.nickname || bride.name} & ${groom.nickname || groom.name} — The Wedding`;

    // Acara: label tanggal dihitung di sini dari tanggal ISO, bukan dipercaya dari klien.
    const ev = p.event || {};
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ev.date ?? ""));
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      const probe = new Date(Date.UTC(y, mo - 1, d));
      if (mo >= 1 && mo <= 12 && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d) {
        const akadStart = dotTime(ev.akad?.start);
        const venue = (v: any) => ({ name: str(v?.venueName, 120), address: str(v?.address, 300), mapsUrl: str(v?.mapsUrl, 300) });
        const akadV = venue(ev.akad);
        const resV = ev.resepsi?.sameVenue ? akadV : venue(ev.resepsi);
        content.event = {
          ...(content.event || {}),
          dateISO: String(ev.date), dateLabel: `${String(d).padStart(2, "0")} ${MONTHS[mo - 1]} ${y}`, dayLabel: DAYS[probe.getUTCDay()],
          countdownTarget: akadStart ? `${String(ev.date)}T${akadStart.replace(".", ":")}:00+07:00` : "",
          akad: { label: "Akad Nikah", start: akadStart, end: dotTime(ev.akad?.end), venue: akadV },
          resepsi: { label: "Resepsi", start: dotTime(ev.resepsi?.start), end: dotTime(ev.resepsi?.end), venue: resV }
        };
      }
    }

    if (Array.isArray(p.loveStory)) {
      content.loveStory = p.loveStory.slice(0, 4).map((x: any) => ({ date: str(x?.date, 40), title: str(x?.title, 80), text: str(x?.text, 400) })).filter((x: any) => x.title);
    }
    const accounts = Array.isArray(p.gift?.accounts) ? p.gift.accounts.slice(0, 4)
      .map((a: any) => ({ bank: str(a?.bank, 40), number: str(a?.number, 40), holder: str(a?.holder, 80), owner: a?.owner === "cpw" ? "cpw" : "cpp" }))
      .filter((a: any) => a.bank && a.number && a.holder) : [];
    content.gift = { ...(content.gift || {}), accounts,
      address: { recipient: str(p.gift?.address?.recipient, 80), phone: str(p.gift?.address?.phone, 30), detail: str(p.gift?.address?.detail, 300) } };
    content.livestream = { ...(content.livestream || {}), youtube: str(p.livestream?.youtube, 200) };

    // Warna pilihan: peta key→hex dari preset template. Hanya key sederhana & hex 6 digit yang diterima.
    const colors: Record<string, string> = {};
    for (const [k, v] of Object.entries((p.theme?.colors && typeof p.theme.colors === "object") ? p.theme.colors : {}).slice(0, 20)) {
      if (/^[a-zA-Z0-9_]{1,32}$/.test(k) && /^#[0-9a-fA-F]{6}$/.test(String(v))) colors[k] = String(v);
    }
    if (Object.keys(colors).length) {
      const tid = str(content.templateId, 40) || "klasik";
      content.templates = (content.templates && typeof content.templates === "object") ? content.templates : {};
      const block = content.templates[tid] || {};
      content.templates[tid] = { ...block, theme: { ...(block.theme || {}), colors: { ...(block.theme?.colors || {}), ...colors } } };
    }

    const { error: writeError } = await admin.from("site_content").update({ content, updated_at: new Date().toISOString() }).eq("invitation_id", invitationId).eq("id", 1);
    if (writeError) throw new Error(writeError.message);
    const { error: markError } = await admin.from("client_drafts").update({ status: "dibuat", invitation_id: invitationId }).eq("id", draft.id);
    if (markError) throw new Error(markError.message);
  };

  if (action === "list_drafts") {
    const { data, error } = await admin.from("client_drafts")
      .select("id,created_at,updated_at,status,contact_name,contact_wa,contact_email,preferred_slug,payload,note,invitation_id,edit_token")
      .order("created_at", { ascending: false }).limit(200);
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ drafts: data || [] }), { headers });
  }
  if (action === "update_draft") {
    const id = clean(body.draftId), status = clean(body.status);
    if (!id) return fail("Draft tidak valid");
    const patch: Record<string, unknown> = {};
    if (status) { if (!DRAFT_STATUS.includes(status)) return fail("Status tidak dikenal"); patch.status = status; }
    if (body.note !== undefined) patch.note = str(body.note, 500);
    if (!Object.keys(patch).length) return fail("Tidak ada yang diubah");
    const { error } = await admin.from("client_drafts").update(patch).eq("id", id);
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }
  if (action === "delete_draft") {
    const id = clean(body.draftId);
    if (!id) return fail("Draft tidak valid");
    const { error } = await admin.from("client_drafts").delete().eq("id", id);
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ deleted: true }), { headers });
  }

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

  // Cross-tenant account management (reset password / change login email of a
  // client's admin or admin_qr). Both operations require service role from the
  // client side, hence living here behind the root_owner gate above. The target
  // must be a member of at least one tenant so root's own account can never be
  // touched by accident; membership rows keep working after an email change
  // because invitation_members references user_id, not the email.
  if (action === "update_member_account") {
    const userId = clean(body.userId);
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const newEmail = clean(body.newEmail).toLowerCase();
    if (!userId) return fail("Akun tidak valid");
    if (!newPassword && !newEmail) return fail("Tidak ada perubahan yang diminta");
    if (newPassword && newPassword.length < 8) return fail("Kata sandi minimal 8 karakter");
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return fail("Format email tidak valid");
    const { data: membership } = await admin.from("invitation_members").select("invitation_id").eq("user_id", userId).limit(1).maybeSingle();
    if (!membership) return fail("Akun itu bukan anggota client mana pun", 404);
    const attributes: { email?: string; email_confirm?: boolean; password?: string } = {};
    if (newEmail) { attributes.email = newEmail; attributes.email_confirm = true; }
    if (newPassword) attributes.password = newPassword;
    const { error } = await admin.auth.admin.updateUserById(userId, attributes);
    if (error) return fail(error.message);
    return new Response(JSON.stringify({ updated: true }), { headers });
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
    // Ikon unggahan menunjuk berkas Storage milik root (<slug>/icons/); client baru harus memulai dari ikon bawaan.
    delete content.appIcon;
    // Editor Visual root membawa dua hal: penyesuaian TAMPILAN (posisi, gaya,
    // tombol, overlay) yang justru harus ikut karena root adalah patokan desain
    // client baru, dan override TEKS yang berisi copy milik root ("Mita & Andi",
    // "Made with by Mita & Iyow") — guest-overrides.js menimpakannya ke nama
    // client di halaman tamu. Hanya yang kedua dibuang, di akar dan di tiap blok
    // per-template.
    const stripCopyOverrides = (ve: any) => {
      if (!ve || typeof ve !== "object" || !ve.elements || typeof ve.elements !== "object") return;
      for (const el of Object.values(ve.elements as Record<string, any>)) if (el && typeof el === "object") delete el.text;
    };
    stripCopyOverrides(content.visualEditor);
    if (content.templates && typeof content.templates === "object") {
      for (const block of Object.values(content.templates as Record<string, any>)) if (block && typeof block === "object") stripCopyOverrides(block.visualEditor);
    }
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
  const applyTemplate = async (toInvitationId: string, displayName: string, brideName = "Mempelai Wanita", groomName = "Mempelai Pria", templateId = "klasik") => {
    const template = await readTemplate(); const content = sanitizeContent(template.content, displayName);
    content.couple = { ...(content.couple || {}), bride: blankPerson(brideName), groom: blankPerson(groomName) };
    // Desain yang dipilih client saat dibuat. Sengaja TIDAK divalidasi
    // terhadap daftar id yang di-hardcode di sini — templates/index.json
    // adalah satu sumber kebenaran, dan id yang salah/tidak dikenal sudah
    // otomatis jatuh ke klasik di sisi tamu (lihat fallback di main.js/
    // core/engine.js). Kalau divalidasi di sini, menambah template baru akan
    // butuh redeploy Edge Function — kopling yang tidak perlu.
    content.templateId = templateId;
    const { error: contentError } = await admin.from("site_content").upsert({ invitation_id: toInvitationId, id: 1, content }, { onConflict: "invitation_id,id" });
    if (contentError) throw new Error(contentError.message);
    const { error: removeError } = await admin.from("photos").delete().eq("invitation_id", toInvitationId);
    if (removeError) throw new Error(removeError.message);
    if (template.photos.length) {
      const { error: photoError } = await admin.from("photos").insert(template.photos.map((photo) => ({ ...photo, invitation_id: toInvitationId })));
      if (photoError) throw new Error(photoError.message);
    }
  };
  // "Salin gaya dari client lain": menerima slug atau URL undangan (willcome.my.id/<slug>/?to=..).
  // Hanya GAYA yang ikut (warna, font, penyesuaian tampilan per template) — nama, tanggal,
  // foto, dan teks tidak, supaya data client sumber tidak bocor ke client baru.
  const slugFromInput = (raw: string) => {
    let s = raw.trim();
    if (!s) return "";
    if (/^[a-z0-9-]+$/i.test(s)) return s.toLowerCase();   // slug polos
    try { s = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`).pathname; } catch (_) { /* bukan URL: anggap slug */ }
    return (s.split("/").filter(Boolean)[0] || "").toLowerCase();
  };
  const loadStyleSource = async (slug: string) => {
    const { data: inv } = await admin.from("invitations").select("id").eq("slug", slug).maybeSingle();
    if (!inv) return null;
    const { data: row } = await admin.from("site_content").select("content").eq("invitation_id", inv.id).eq("id", 1).maybeSingle();
    return row?.content ? sanitizeContent(row.content as Record<string, unknown>) : null;
  };
  const applyStyle = async (toInvitationId: string, source: Record<string, any>) => {
    const { data: row, error } = await admin.from("site_content").select("content").eq("invitation_id", toInvitationId).eq("id", 1).single();
    if (error || !row) throw new Error(error?.message || "Konten client baru tidak ditemukan");
    const dest = row.content as Record<string, any>;
    for (const key of ["theme", "typography", "visualEditor"]) if (source[key] !== undefined) dest[key] = source[key];
    dest.templates = dest.templates && typeof dest.templates === "object" ? dest.templates : {};
    for (const [id, block] of Object.entries((source.templates || {}) as Record<string, any>)) {
      if (!block || typeof block !== "object") continue;
      const target = (dest.templates[id] = dest.templates[id] && typeof dest.templates[id] === "object" ? dest.templates[id] : {});
      for (const key of ["theme", "typography", "visualEditor"]) if (block[key] !== undefined) target[key] = block[key];
    }
    const { error: saveError } = await admin.from("site_content").update({ content: dest }).eq("invitation_id", toInvitationId).eq("id", 1);
    if (saveError) throw new Error(saveError.message);
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
    try { await applyTemplate(demo.id, "Demo Undangan"); const { error: waError } = await admin.from("wa_settings").upsert({ invitation_id: demo.id, id: 1, invitation_link: "https://willcome.my.id/demo/" }, { onConflict: "invitation_id,id" }); if (waError) throw new Error(waError.message); }
    catch (error) { return fail(error instanceof Error ? error.message : "Gagal memperbarui demo dari default statis"); }
    return new Response(JSON.stringify({ demo: { slug: demo.slug }, copiedFrom: "static_default" }), { headers });
  }

  // Cek ketersediaan slug SEBELUM submit — UX saja, bukan jaring pengaman
  // utama. Constraint unik di kolom `slug` (kode 23505, ditangani di bawah)
  // tetap yang terakhir menentukan; race condition antara cek ini dan submit
  // sungguhan (dua tab admin, dsb.) tetap aman lewat itu.
  if (action === "check_slug") {
    const slug = clean(body.slug).toLowerCase();
    if (slug === "root" || slug === "demo" || slug === "catin" || slug === "home" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return new Response(JSON.stringify({ available: false, reason: "invalid" }), { headers });
    }
    const { data } = await admin.from("invitations").select("id").eq("slug", slug).maybeSingle();
    return new Response(JSON.stringify({ available: !data }), { headers });
  }

  if (action !== "create") return fail("Aksi tidak dikenal");
  const slug = clean(body.slug).toLowerCase();
  if (slug === "root" || slug === "demo" || slug === "catin" || slug === "home") return fail("Slug ini dicadangkan untuk halaman sistem");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail("Slug hanya huruf kecil, angka, dan tanda hubung");
  for (const field of ["adminEmail", "adminPassword"]) if (!clean(body[field])) return fail(`Field ${field} wajib diisi`);
  // Satu orang boleh memegang undangan sekaligus QR check-in. Auth Supabase
  // hanya mengizinkan satu akun per email dan invitation_members hanya satu
  // peran per user, jadi kalau email QR kosong atau sama dengan email admin,
  // cukup satu akun `admin` — halaman admin-qr tidak membatasi peran dan RLS
  // check-in memakai can_access_invitation (admin + admin_qr).
  const adminEmail = clean(body.adminEmail);
  const qrEmail = clean(body.qrEmail);
  const separateQr = qrEmail !== "" && qrEmail.toLowerCase() !== adminEmail.toLowerCase();
  if (separateQr && !clean(body.qrPassword)) return fail("Field qrPassword wajib diisi");
  const templateId = clean(body.templateId) || "klasik";
  // Draft dari /catin (opsional): dipastikan ada & belum dipakai SEBELUM apa pun dibuat.
  const draftId = clean(body.draftId);
  let draft: { id: string; payload: any } | null = null;
  if (draftId) {
    const { data: d } = await admin.from("client_drafts").select("id,status,payload").eq("id", draftId).maybeSingle();
    if (!d) return fail("Draft tidak ditemukan", 404);
    if (d.status === "dibuat") return fail("Draft ini sudah dipakai membuat client");
    draft = { id: d.id, payload: d.payload };
  }
  if (!/^[a-z0-9-]+$/.test(templateId)) return fail("Template tidak valid");
  // Gaya dari client lain (opsional) — dipastikan ada SEBELUM apa pun dibuat.
  const styleSlug = slugFromInput(clean(body.cloneFrom));
  let styleSource: Record<string, any> | null = null;
  if (styleSlug) {
    if (styleSlug === slug) return fail("Sumber gaya tidak boleh client yang sama");
    styleSource = await loadStyleSource(styleSlug);
    if (!styleSource) return fail(`Client "${styleSlug}" tidak ditemukan`, 404);
  }
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
    await createAccount(adminEmail, String(body.adminPassword), "admin");
    if (separateQr) await createAccount(qrEmail, String(body.qrPassword), "admin_qr");
    await applyTemplate(invitationId, clean(body.displayName || slug), clean(body.brideName || "Mempelai Wanita"), clean(body.groomName || "Mempelai Pria"), templateId);
    if (styleSource) await applyStyle(invitationId, styleSource);   // sebelum draft, supaya warna pilihan client menang
    if (draft) await applyDraft(invitationId, draft);
    const { error: settingError } = await admin.from("wa_settings").insert({ invitation_id: invitationId, id: 1, invitation_link: `https://willcome.my.id/${slug}/` }); if (settingError) throw new Error(settingError.message);
  } catch (error) { await rollback(); return fail(error instanceof Error ? error.message : "Provisioning gagal"); }
  return new Response(JSON.stringify({ invitation: created, urls: { invitation: `/${slug}/`, admin: `/${slug}/admin/`, adminQr: `/${slug}/admin-qr/` } }), { headers });
});
