import fs from 'node:fs/promises';
const [photos, content, waHtml, wishes, rsvp, migration, css] = await Promise.all([
  fs.readFile('assets/js/admin/photos.js','utf8'), fs.readFile('assets/js/admin/content.js','utf8'), fs.readFile('admin.html','utf8'), fs.readFile('assets/js/admin/wishes.js','utf8'), fs.readFile('assets/js/rsvp.js','utf8'), fs.readFile('supabase/migrations/0014_wish_moderation.sql','utf8'), fs.readFile('assets/css/admin.css','utf8')
]);
const required = [
  [photos, 'data-gift-rec="name"', 'Gift photo cards need name input'], [photos, 'data-gift-rec="price"', 'Gift photo cards need price input'], [photos, 'data-gift-rec="link"', 'Gift photo cards need link input'], [photos, 'saveGiftRecommendations', 'Gift metadata must persist from Foto'],
  [content, 'gift-recs-list', 'Text tab must no longer render recommendation inputs', true], [waHtml, '<details class="wa-config" open>', 'WA settings must be collapsible'],
  [wishes, 'PAGE_SIZE = 20', 'Wishes need pagination'], [wishes, 'data-block', 'Wishes need block-device action'], [wishes, 'wish-banned-words', 'Wishes need banned word input'],
  [rsvp, 'rpc("submit_wish"', 'Guest RSVP must submit through moderated RPC'], [rsvp, 'Doa baik akan kembali kepada orang yang mendoakan.', 'Guest needs moderation message'],
  [migration, 'create table if not exists public.wish_blocks', 'Migration needs blocks'], [migration, 'create table if not exists public.wish_moderation', 'Migration needs banned words'], [migration, 'create or replace function public.submit_wish', 'Migration needs server enforcement'],
  [css, '.wa-config', 'Collapse styling missing']
];
for (const [source, token, message, absent] of required) if (absent ? source.includes(token) : !source.includes(token)) throw new Error(message);
console.log('PASS: Foto recommendations, collapsible WA, and secure paginated wish moderation contracts exist.');
