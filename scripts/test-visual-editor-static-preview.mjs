import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto('http://127.0.0.1:4174/scripts/visual-editor-harness.html');
  await page.evaluate(() => window.VisualEditorPanel.load());
  await page.waitForTimeout(1700);
  const frame = page.frames().find(f => f.url().includes('/index.html'));
  if (!frame) throw new Error('Preview guest frame missing.');
  const state = await frame.evaluate(() => ({
    cover: document.querySelector('#cover').getBoundingClientRect().top,
    opening: document.querySelector('#opening').getBoundingClientRect().top,
    scrollHeight: document.querySelector('.app-frame__scroll').scrollHeight,
    scrollClientHeight: document.querySelector('.app-frame__scroll').clientHeight,
    locked: document.querySelector('#invitation').classList.contains('is-locked'),
    staticSurfaces: [...document.querySelectorAll('[data-ve-static-surface="1"]')].map(el => el.id),
    openingStyle: (() => { const el=document.querySelector('#opening'); const cs=getComputedStyle(el); return { opacity:cs.opacity, transform:cs.transform, media:el.querySelectorAll('.hero-slide, .hero-media img').length }; })(),
    wishDummies: document.querySelectorAll('[data-ve-wish-dummy="1"]').length,
    pencils: document.querySelectorAll('.ve-pencil').length,
    registeredTextTargets: document.querySelectorAll('[data-ve-auto]').length
  }));
  if (state.locked || state.cover < -1 || state.opening < 1 || state.openingStyle.opacity !== '1' || state.openingStyle.transform !== 'none' || state.openingStyle.media < 1 || state.wishDummies !== 1 || state.scrollHeight <= state.scrollClientHeight || state.scrollHeight < 2000 || state.pencils < 20 || state.pencils !== state.registeredTextTargets + 1) throw new Error(`Scrollable static preview lacks complete pencils/content: ${JSON.stringify(state)}`);
  for (const id of ['gift-panel', 'gift-confirm-modal', 'gift-recs-modal']) if (!state.staticSurfaces.includes(id)) throw new Error(`Static editor surface missing: ${id}`);
  const clickResult = await frame.evaluate(() => { let fired=false; document.querySelector('#btn-open').addEventListener('click',()=>{fired=true});document.querySelector('#btn-open').click();return fired; });
  if (clickResult) throw new Error('Guest click behavior leaked into static preview.');
  console.log('PASS: editor shows one scrollable static invitation, all text pencils, and static gift surfaces.');
} finally { await browser.close(); }
