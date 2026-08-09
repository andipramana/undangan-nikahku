import fs from 'node:fs/promises';
const source = await fs.readFile('assets/js/admin/section-nav.js', 'utf8');
if (source.includes('["gift-rekomendasi", "Rekomendasi kado"]')) throw new Error('Burger section menu still exposes the moved Rekomendasi kado item.');
console.log('PASS: admin burger section menu no longer shows Rekomendasi kado.');
