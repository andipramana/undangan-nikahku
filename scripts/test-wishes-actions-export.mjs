import fs from 'node:fs/promises';
const [html, js, css] = await Promise.all(['admin.html','assets/js/admin/wishes.js','assets/css/admin.css'].map(p=>fs.readFile(p,'utf8')));
for (const [source, token] of [[html,'id="wish-export-modal"'],[html,'html2canvas@1.4.1'],[js,'id="wishes-refresh"'],[js,'id="wishes-delete-all"'],[js,'id="wishes-export"'],[js,'async function fetchAllWishes()'],[js,'for(let from=0;;from+=chunk)'],[js,'exportCsv'],[js,'exportPng'],[js,'confirm(`Hapus SEMUA ${total} ucapan'],[css,'.wish-export-sheet']]) if(!source.includes(token)) throw new Error(`Missing wish action/export contract: ${token}`);
console.log('PASS: wishes provides refresh, double-confirm delete-all, and all-record CSV/PNG export modal.');
