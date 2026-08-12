import fs from 'node:fs/promises';
const [js, css] = await Promise.all([fs.readFile('assets/js/admin/wa-blast.js','utf8'),fs.readFile('assets/css/wa.css','utf8')]);
for (const token of ['CONTACT_PAGE_SIZES = [20, 50, 100]', 'id="wa-contact-search"', 'data-filter=', 'wa-status-filter', 'slice((contactPage - 1) * contactPageSize', 'id="wa-contact-page-size"', 'id="wa-prev"', 'id="wa-next"', 'wa-contact-row--sent', 'wa-contact-row--pending']) if (!js.includes(token) && !css.includes(token)) throw new Error(`Missing WA pagination/filter contract: ${token}`);
if (!css.includes('.wa-contact-row--sent') || !css.includes('.wa-contact-row--pending')) throw new Error('Missing sent/pending visual distinction.');
console.log('PASS: WA contacts support search, capsule filters, footer pagination, and state-specific styling.');
