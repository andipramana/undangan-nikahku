import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const source = await fs.readFile("assets/js/admin/fonts.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.setContent('<main><div id="fonts-root"></div></main><button id="btn-save-fonts">Simpan font</button>');
  await page.evaluate(() => {
    window.__saved = null;
    window.sb = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { content: { couple: { bride: { nickname: "Salsa", name: "Salsa Putri", father: "Budi", mother: "Rina" }, groom: { nickname: "Raka", name: "Raka Putra" } }, defaultGuestName: "Keluarga Bahagia", event: { dateLabel: "12 Desember 2026", dayLabel: "Sabtu", akad: { label: "Akad Pemberkatan", venue: { name: "Ballroom Cendana" } } }, opening: { quote: "Doa terbaik untuk perjalanan kami." }, quotePhoto: { quote: "Cinta yang bertumbuh." } } }, error: null }), upsert: async (row) => { window.__saved = row; return { error: null }; } }) };
    window.AdminAPI = { sb: window.sb, tenant: { invitationId: "test" }, query: async (q) => q, contentFromConfig: () => ({}), toast: () => {} };
  });
  await page.evaluate((code) => new Function(code)(), source);
  await page.evaluate(() => window.FontsPanel.load());
  if (await page.locator('#font-section').count() !== 1) throw new Error('Section dropdown missing.');
  if (await page.locator('.font-card').count() !== 4) throw new Error('Cover must show four independent elements.');
  await page.locator('[data-font-family="cover-names"]').fill('Great Vibes');
  await page.locator('[data-font-size="cover-names"]').fill('56');
  await page.locator('#btn-save-fonts').click();
  let saved = await page.evaluate(() => window.__saved);
  if (saved.content.typography.elements['cover-names'].family !== 'Great Vibes') throw new Error('Individual element was not persisted.');
  await page.locator('[data-font-reset="cover-names"]').click();
  const resetState = await page.evaluate(() => ({
    family: document.querySelector('[data-font-family="cover-names"]').value,
    size: document.querySelector('[data-font-size="cover-names"]').value,
    weight: document.querySelector('[data-font-weight="cover-names"]').value,
    preview: document.querySelector('[data-font-preview="cover-names"]').textContent,
    previewStyle: document.querySelector('[data-font-preview="cover-names"]').style.cssText
  }));
  if (resetState.family !== 'Beau Rivage' || resetState.size !== '50' || resetState.weight !== '400') {
    throw new Error(`Per-element reset did not restore default input values: ${JSON.stringify(resetState)}`);
  }
  if (resetState.preview !== 'Salsa & Raka' || !resetState.previewStyle.includes('50px') || !resetState.previewStyle.includes('Beau Rivage')) {
    throw new Error(`Per-element reset did not restore matching preview: ${JSON.stringify(resetState)}`);
  }
  await page.locator('[data-font-family="cover-eyebrow"]').fill('Montserrat');
  await page.locator('#fonts-reset-all').click();
  const globalReset = await page.evaluate(() => ({
    family: document.querySelector('[data-font-family="cover-eyebrow"]').value,
    size: document.querySelector('[data-font-size="cover-eyebrow"]').value,
    weight: document.querySelector('[data-font-weight="cover-eyebrow"]').value,
    preview: document.querySelector('[data-font-preview="cover-eyebrow"]').textContent
  }));
  if (globalReset.family !== 'Alegreya Sans' || globalReset.size !== '13' || globalReset.weight !== '500' || globalReset.preview !== 'THE WEDDING OF') {
    throw new Error(`Global reset did not restore defaults: ${JSON.stringify(globalReset)}`);
  }
  await page.locator('#btn-save-fonts').click();
  saved = await page.evaluate(() => window.__saved);
  if (Object.keys(saved.content.typography.elements).length) throw new Error('Global reset did not clear all saved overrides.');
  console.log('PASS: Font panel has section controls, actual-content previews, and reset restores defaults.');
} finally { await browser.close(); }
