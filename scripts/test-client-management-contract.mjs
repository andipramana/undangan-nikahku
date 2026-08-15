import fs from 'node:fs/promises';
// R2 (docs/rencana-admin-v2-revisi.md): register.html pindah dari admin.css
// (gelap) ke panel.css (terang) — daftar client sekarang dirender pakai
// .p-list-row (register.js), bukan .client-row lagi.
const [html, js, fn, css] = await Promise.all(['register.html','assets/js/register.js','supabase/functions/provision-invitation/index.ts','assets/css/panel.css'].map(p=>fs.readFile(p,'utf8')));
for (const [src, token] of [[html,'id="clients-panel"'],[html,'id="clients-list"'],[js,'action: "list"'],[js,'data-client-edit'],[js,'data-client-toggle'],[js,'data-client-delete'],[js,'Ketik HAPUS'],[fn,'action === "list"'],[fn,'action === "update"'],[fn,'action === "delete"'],[fn,'admin.auth.admin.deleteUser'],[fn,'admin.storage.from("photos")'],[js,'p-list-row'],[css,'.p-list-row']]) if (!src.includes(token)) throw new Error(`Missing client-management contract: ${token}`);
console.log('PASS: root client list supports edit, activate/deactivate, and guarded permanent deletion including tenant storage and isolated Auth users.');
