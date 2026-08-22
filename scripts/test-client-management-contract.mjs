import fs from 'node:fs/promises';
// Dashboard root (register.html): bukan lagi form register publik — login
// gate dulu (reuse core.js initAdminAuth, role root_owner), lalu daftar
// client sebagai tampilan utama dengan URL per client dan aksi kelola akun
// lintas tenant. Create client menjadi modal sekunder TANPA field
// email/password root (sesi gerbang yang dipakai).
const [html, js, fn, css] = await Promise.all(['register.html','assets/js/register.js','supabase/functions/provision-invitation/index.ts','assets/css/panel.css'].map(p=>fs.readFile(p,'utf8')));
const checks = [
  // ---- Gerbang login wajib dulu ----
  ['gerbang login terpisah dari app', html.includes('id="login-screen"') && /<div id="app" hidden>/.test(html)],
  ['login reuse core.js, bukan auth sendiri', js.includes('initAdminAuth') && !js.includes('signInWithPassword')],
  // Regresi 2026-08-22: tenant.js di register.html membuat URL /register
  // terbaca sebagai slug tenant "register" → RPC akses dijalankan dengan
  // slug salah → root owner ditolak padahal akunnya benar. Halaman ini
  // harus memakai fallback slug "root" bawaan core.js.
  ['tanpa tenant.js (slug root dari fallback core.js)', !html.includes('assets/js/tenant.js')],
  ['hanya role root_owner yang lolos gerbang', /allowedRoles:\s*\[\s*"root_owner"\s*\]/.test(js)],
  ['daftar client dimuat tepat setelah login', /onSignedIn:\s*loadClients/.test(js)],
  ['komponen login terang dari panel.css', css.includes('.p-login-card') && css.includes('.p-login-error')],

  // ---- Daftar client = tampilan utama; create = alur sekunder ----
  ['daftar client ada di dashboard utama', html.includes('id="clients-list"') && !html.includes('Lihat daftar client')],
  ['create client jadi modal terpisah', html.includes('id="client-new-open"') && html.includes('id="client-modal"') && /id="client-modal" class="p-modal"/.test(html) && /<form id="register-form" class="p-modal__panel"/.test(html)],
  ['field kredensial root dihapus total', !html.includes('owner-email') && !html.includes('owner-password') && !js.includes('ensureRootLogin')],
  ['form create tetap lengkap (slug, mempelai, akun admin & QR)', ['id="slug"','id="bride-name"','id="groom-name"','id="display-name"','id="admin-email"','id="admin-password"','id="qr-email"','id="qr-password"'].every(t => html.includes(t))],

  // ---- URL per client selalu tampak (dibangun dari slug, konvensi tenant.js) ----
  ['URL undangan/admin/QR dibangun dari slug', /invitation:\s*`\/\$\{slug\}\/`/.test(js) && /admin:\s*`\/\$\{slug\}\/admin\/`/.test(js) && /adminQr:\s*`\/\$\{slug\}\/admin-qr\/`/.test(js)],
  ['tiap baris client menautkan URL-nya', /class="cl-links"/.test(js) && /\$\{urls\.invitation\}/.test(js) && /\$\{urls\.admin\}/.test(js)],

  // ---- Kelola akun lintas client ----
  ['modal kelola akun tersedia', html.includes('id="account-modal"') && html.includes('id="account-list"')],
  ['baris client punya tombol kelola akun', js.includes('data-account-manage') && js.includes('openAccountModal')],
  ['reset sandi + ganti email di UI akun', js.includes('data-ac-reset') && js.includes('data-ac-save-email')],
  ['invoke action update_member_account', js.includes('"update_member_account"')],

  // ---- Aksi lama tetap utuh (edit nama, aktif/nonaktif, hapus berjaga) ----
  ['aksi edit/toggle/hapus tetap ada', js.includes('data-client-edit') && js.includes('data-client-toggle') && js.includes('data-client-delete') && js.includes('Ketik HAPUS')],
  ['tools lanjutan capture default & sync demo tetap dirender', html.includes('id="capture-default"') && html.includes('id="sync-demo"') && js.includes('action: "capture_default_template"') && js.includes('action: "sync_demo"')],

  // ---- Kontrak Edge Function ----
  ['fn: aksi list/update/delete tetap ada', ['action === "list"','action === "update"','action === "delete"'].every(t => fn.includes(t))],
  ['fn: update_member_account memakai service-role Auth admin', fn.includes('action === "update_member_account"') && fn.includes('admin.auth.admin.updateUserById')],
  ['fn: target update wajib anggota invitation_members', /\.from\("invitation_members"\)\.select\("invitation_id"\)\.eq\("user_id", userId\)/.test(fn)],
  ['fn: sandi minimal 8 karakter divalidasi server', /newPassword\.length < 8/.test(fn)],
  ['fn: hapus permanen tetap bersihkan Storage + Auth users', fn.includes('admin.auth.admin.deleteUser') && fn.includes('admin.storage.from("photos")')]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
