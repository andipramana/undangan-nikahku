import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
// .wa-config lives in wa.html (the standalone WA workspace) — admin.html only
// ever held a stub link to it (pre admin-v2) / a nav card to it (admin-v2).
const [html, css] = await Promise.all([fs.readFile('wa.html','utf8'), fs.readFile('assets/css/wa.css','utf8')]);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:390,height:844} });
try {
  const wa = (html.match(/<details class="wa-config"[\s\S]*?<\/details>/)?.[0] || '');
  await page.setContent(`<style>${css}</style>${wa}`);
  const details = page.locator('.wa-config');
  if (!await details.count() || !await details.evaluate(el=>el.open)) throw new Error('WA config must start available and collapsible.');
  await details.locator('summary').click();
  if (await details.evaluate(el=>el.open)) throw new Error('WA config summary must collapse settings away from contacts.');
  console.log('PASS: WA warning/link/template panel is visibly collapsible on mobile.');
} finally { await browser.close(); }
