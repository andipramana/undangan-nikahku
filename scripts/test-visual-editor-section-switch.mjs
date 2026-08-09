import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto('http://127.0.0.1:4174/scripts/visual-editor-harness.html');
  await page.evaluate(() => window.VisualEditorPanel.load());
  await page.waitForTimeout(1500);
  const cover = page.frames().find(f => f.url().includes('/index.html'));
  const coverPencils = await cover.locator('.ve-pencil').evaluateAll(buttons => buttons.map(button => button.title).sort());
  const requiredCoverTargets = ['Foto & overlay cover', 'Nama mempelai', 'Sapaan tamu', 'Nama tamu', 'The Wedding Of', 'Tombol buka undangan'];
  if (coverPencils.length !== requiredCoverTargets.length || requiredCoverTargets.some(name => !coverPencils.includes(`Edit: ${name}`))) {
    const selectorState = await cover.evaluate(() => ({ eyebrow: document.querySelectorAll('.hero-content__top .eyebrow').length, names: document.querySelectorAll('#couple-names-cover').length, guestLabel: document.querySelectorAll('#guest-label').length, guestName: document.querySelectorAll('#guest-name').length, button: document.querySelectorAll('#btn-open').length, photo: document.querySelectorAll('#cover-media').length }));
    throw new Error(`Cover targets must each have a distinct pencil: ${JSON.stringify({ coverPencils, selectorState })}`);
  }
  await page.locator('#ve-section').selectOption('opening');
  await page.waitForTimeout(1500);
  const opening = page.frames().find(f => f.url().includes('/index.html'));
  const openingState = await opening.locator('#opening').evaluate(el => ({ top: el.getBoundingClientRect().top, pencils: document.querySelectorAll('.ve-pencil').length }));
  if (Math.abs(openingState.top) > 30 || openingState.pencils < 1) throw new Error(`Selected section did not reload/decorate: ${JSON.stringify(openingState)}`);
  console.log('PASS: Cover photo remains visible and selecting Opening mounts its own static canvas targets.');
} finally { await browser.close(); }
