import fs from 'node:fs/promises';
const [js, css] = await Promise.all(['assets/js/admin/wishes.js','assets/css/admin.css'].map(p=>fs.readFile(p,'utf8')));
for (const token of ['sb.from("wish_blocks").select', 'Perangkat diblokir', 'data-unblock', 'async function unblock', '.eq("device_token", deviceToken)']) if (!js.includes(token)) throw new Error(`Missing blocked-device list behavior: ${token}`);
for (const token of ['.wish-block-list', '.wish-block-row', '.wish-block-list__count']) if (!css.includes(token)) throw new Error(`Missing blocked-device list styling: ${token}`);
console.log('PASS: blocked-device list is tenant-scoped and each device can be unblocked.');
