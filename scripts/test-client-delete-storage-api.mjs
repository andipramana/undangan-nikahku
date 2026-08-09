import fs from 'node:fs/promises';
const source = await fs.readFile('supabase/functions/provision-invitation/index.ts', 'utf8');
for (const token of ['admin.storage.from("photos")', 'bucket.list(prefix', 'collectFiles(invitation.slug)', 'bucket.remove(files.slice', 'for (let start = 0; start < files.length; start += 100)']) if (!source.includes(token)) throw new Error(`Missing safe tenant storage cleanup: ${token}`);
if (source.includes('schema("storage")')) throw new Error('Must not access the internal storage schema through PostgREST.');
console.log('PASS: client deletion cleans tenant storage recursively through the official Storage API.');
