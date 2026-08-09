import fs from 'node:fs/promises';
const [js, css] = await Promise.all(['assets/js/admin/wishes.js','assets/css/admin.css'].map(p=>fs.readFile(p,'utf8')));
for (const token of ['wish-toolbar__primary', 'wish-toolbar__delete', 'grid-template-columns:1fr 1fr', '.wish-toolbar__primary .btn, .wish-toolbar__delete { width:100%']) if (!js.includes(token) && !css.includes(token)) throw new Error(`Missing desired toolbar layout: ${token}`);
console.log('PASS: refresh/export are equal-width row buttons and delete-all is separate full-width row.');
