import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const logs = [];
page.on('pageerror', e => logs.push('pageerror:' + e.message));
page.on('console', m => { if (m.type() === 'error') logs.push('console:' + m.text()); });
try {
  await page.goto('http://127.0.0.1:4174/scripts/visual-editor-harness.html');
  await page.evaluate(() => window.VisualEditorPanel.load());
  const frame = page.locator('#ve-frame');
  await frame.waitFor({ state: 'visible' });
  await page.waitForTimeout(1800);
  const frameDoc = page.frames().find(f => f.url().includes('/index.html'));
  if (!frameDoc) throw new Error('Live guest frame was not created.');
  await frameDoc.locator('#couple-names-cover').waitFor({ state: 'attached' });
  const debug = await frameDoc.evaluate(() => ({ pencils: document.querySelectorAll('.ve-pencil').length, selected: document.querySelectorAll('#cover .hero-content__top .eyebrow').length, parentUrl: window.parent.location.href, parentPanel: !!window.parent.VisualEditorPanel, parentRoot: window.parent.document.getElementById('visual-editor-root')?.innerHTML.slice(0,100) }));
  const pencilCount = debug.pencils;
  if (!pencilCount) throw new Error('No in-context pencil controls were mounted in the real guest frame: ' + JSON.stringify({ debug, logs }));
  const coverTop = await frameDoc.locator('#cover').evaluate(el => el.getBoundingClientRect().top);
  if (coverTop < -1) { const coverDebug = await frameDoc.locator('#cover').evaluate(el => ({ top: el.getBoundingClientRect().top, className: el.className, inline: el.getAttribute('style'), computed: getComputedStyle(el).transform, editorCss: document.getElementById('ve-editor-style')?.textContent.slice(0,160) })); throw new Error(`Cover canvas is not visible at its real initial position: ${JSON.stringify(coverDebug)}`); }
  await frameDoc.locator('#cover .ve-pencil[title="Edit: The Wedding Of"]').evaluate(button => button.click());
  const editModal = page.locator('#ve-edit-modal');
  await editModal.waitFor({ state: 'visible' });
  await editModal.getByText('Font & teks').waitFor();
  const transparency = await page.evaluate(() => {
    const rgbaAlpha = value => { const m = String(value).match(/rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/); return m ? Number(m[1]) : 1; };
    return {
      backdrop: rgbaAlpha(getComputedStyle(document.getElementById('ve-edit-modal')).backgroundColor),
      panel: rgbaAlpha(getComputedStyle(document.querySelector('#ve-edit-modal .ve-modal__panel')).backgroundColor),
      header: rgbaAlpha(getComputedStyle(document.querySelector('#ve-edit-modal .modal__header')).backgroundColor)
    };
  });
  if (transparency.backdrop > .2 || transparency.panel > .58 || transparency.header > .65) throw new Error(`Visual editor modal is not transparent enough for live canvas review: ${JSON.stringify(transparency)}`);
  const initialEditorText = await editModal.locator('#ve-text').inputValue();
  if (initialEditorText.includes('✎')) throw new Error(`Editor text input must not include the injected pencil icon: ${initialEditorText}`);
  const saveInsideModal = await page.evaluate(() => document.getElementById('ve-edit-modal').contains(document.getElementById('btn-save-visual-editor')));
  if (saveInsideModal) throw new Error('Floating save must stay outside edit modal.');
  const familySelect = page.locator('#ve-family');
  if (await familySelect.count()) {
    const previewStyle = await familySelect.locator('option[value="Beau Rivage"]').getAttribute('style');
    if (!previewStyle?.includes("font-family:'Beau Rivage'")) throw new Error('Font options are not rendered in their own font style.');
    await familySelect.selectOption('Poppins');
    await page.waitForTimeout(80);
    const appliedFamily = await frameDoc.locator('#cover .hero-content__top .eyebrow').evaluate(el => el.style.fontFamily);
    if (!appliedFamily.includes('Poppins')) throw new Error('Font dropdown did not update the canvas live.');
  }
  const textInput = page.locator('#ve-text');
  if (await textInput.count()) {
    await textInput.fill('Preview Visual');
    await page.waitForTimeout(100);
    const edited = await frameDoc.locator('#cover .hero-content__top .eyebrow').evaluate(el => { const clone = el.cloneNode(true); clone.querySelectorAll('.ve-pencil').forEach(button => button.remove()); return clone.textContent.trim(); });
    if (edited !== 'Preview Visual') throw new Error('In-context text edit did not update the live guest canvas.');
  }
  const width = await page.locator('.ve-phone').evaluate(el => getComputedStyle(el).maxWidth);
  if (width !== '430px') throw new Error('Live frame does not preserve mobile canvas width.');
  console.log('PASS: Editor Visual mounts an actual guest page, pencil controls, and live text editing in the mobile canvas.');
} finally { await browser.close(); }
