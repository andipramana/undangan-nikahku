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
  ['action === "capture_default_template"', 'root capture action'],
  ['from("invitation_templates")', 'static template persistence'],
  ['templates/default/photos/', 'independent template photo storage'],
  ['action === "sync_demo"', 'static-template-to-demo action'],
  ['await applyTemplate(demo.id, "Demo Undangan")', 'static template copied to demo'],
  ['await applyTemplate(invitationId', 'static template copied to new client'],
  ['slug === "root" || slug === "demo"', 'reserved template slugs'],
]) mustContain(fn, token, label);
mustContain(demo, 'assets/js/tenant.js', 'tenant-aware demo shell');
const [registerHtml, registerJs] = await Promise.all([fs.readFile('register.html', 'utf8'), fs.readFile('assets/js/register.js', 'utf8')]);
mustContain(registerHtml, 'id="capture-default"', 'root-only static default capture control');
mustContain(registerJs, 'action: "capture_default_template"', 'static default capture invocation');
mustContain(registerHtml, 'id="sync-demo"', 'root-only sync demo control');
mustContain(registerJs, 'action: "sync_demo"', 'sync demo invocation');
mustContain(landing, 'assets/img/landing-event-root.webp', 'static snapshot of current root Event sequence-one landing photo');
mustContain(landing, 'assets/img/foto_opening/01.jpg', 'root save-the-date sequence 1 landing photo');
console.log('PASS: root snapshots into demo; new clients clone demo visual metadata; landing uses approved root event/opening images.');
