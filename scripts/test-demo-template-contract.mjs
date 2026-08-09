import fs from 'node:fs/promises';
const [fn, demo, landing] = await Promise.all([
  fs.readFile('supabase/functions/provision-invitation/index.ts', 'utf8'),
  fs.readFile('demo/index.html', 'utf8'),
  fs.readFile('home/index.html', 'utf8')
]);
const mustContain = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
for (const [token, label] of [
  ['action === "sync_demo"', 'root-to-demo snapshot action'],
  ['eq("slug", "root")', 'root snapshot source'],
  ['upsert({ slug: "demo"', 'demo tenant creation'],
  ['await copyPhotos(root.id, demo.id)', 'root photo metadata copied to demo'],
  ['eq("slug", "demo")', 'client template source'],
  ['await copyPhotos(template.id, invitationId)', 'demo photo metadata copied to new client'],
  ['slug === "root" || slug === "demo"', 'reserved template slugs'],
]) mustContain(fn, token, label);
mustContain(demo, 'assets/js/tenant.js', 'tenant-aware demo shell');
const [registerHtml, registerJs] = await Promise.all([fs.readFile('register.html', 'utf8'), fs.readFile('assets/js/register.js', 'utf8')]);
mustContain(registerHtml, 'id="sync-demo"', 'root-only sync demo control');
mustContain(registerJs, 'action: "sync_demo"', 'sync demo invocation');
mustContain(landing, 'assets/img/foto_slider_section_2/01.jpg', 'root event sequence 1 landing photo');
mustContain(landing, 'assets/img/foto_opening/01.jpg', 'root save-the-date sequence 1 landing photo');
console.log('PASS: root snapshots into demo; new clients clone demo visual metadata; landing uses approved root event/opening images.');
