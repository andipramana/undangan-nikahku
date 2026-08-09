import fs from 'node:fs/promises';
const source = await fs.readFile('assets/js/admin/wishes.js', 'utf8');
for (const token of ['PAGE_SIZES = [10, 20, 50, 100]', 'id="wish-page-size"', 'localStorage.setItem(PAGE_SIZE_KEY', 'from + pageSize - 1', 'load(1)']) {
  if (!source.includes(token)) throw new Error(`Missing page-size behavior: ${token}`);
}
console.log('PASS: wishes has persistent 10/20/50/100 page-size dropdown and resets pagination.');
