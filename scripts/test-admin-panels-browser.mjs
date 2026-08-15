import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
// .wa-config lives in wa.html (the standalone WA workspace) — admin.html only
// ever held a stub link to it (pre admin-v2) / a nav card to it (admin-v2).
//
// R4 (docs/rencana-admin-v2-revisi.md): this test used to assert the details
// element started OPEN by default, which never matched wa.html — there is no
// `open` attribute in the markup and wa.js never sets `.open` (verified: no
// `.open`/`wa-config` reference in assets/js/wa.js at all). That assumption
// was wrong since before the admin-v2 rewrite too. The real, working design
// (see wa.css `.wa-config:not([open])` rule) is: collapsed by default,
// toggled open/closed by clicking the summary — assert THAT instead.
const [html, css] = await Promise.all([fs.readFile('wa.html','utf8'), fs.readFile('assets/css/wa.css','utf8')]);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:390,height:844} });
try {
  const wa = (html.match(/<details class="wa-config"[\s\S]*?<\/details>/)?.[0] || '');
  await page.setContent(`<style>${css}</style>${wa}`);
  const details = page.locator('.wa-config');
  if (!await details.count()) throw new Error('WA config details element missing.');
  if (await details.evaluate(el => el.open)) throw new Error('WA config must start collapsed on mobile (no `open` attribute in markup, nothing sets it at runtime).');
  await details.locator('summary').click();
  if (!await details.evaluate(el => el.open)) throw new Error('Clicking the summary must open WA config.');
  await details.locator('summary').click();
  if (await details.evaluate(el => el.open)) throw new Error('Clicking the summary again must collapse WA config.');
  console.log('PASS: WA warning/link/template panel starts collapsed and toggles open/closed on mobile.');
} finally { await browser.close(); }
