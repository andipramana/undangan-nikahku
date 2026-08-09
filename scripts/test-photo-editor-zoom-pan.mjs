import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.setContent(`<!doctype html><style>${await (await import('node:fs/promises')).readFile('assets/css/admin.css','utf8')}</style>
    <div id="editor" class="editor" hidden><div class="editor__panel"><div class="editor__header"><h2>Atur</h2><button id="editor-close">Tutup</button></div><div class="editor__preview-wrap"><div class="editor__preview" id="editor-preview"><img id="editor-img"></div><p class="editor__hint"></p></div><label class="editor__zoom"><input id="editor-zoom" type="range" min="1" max="3" step=".01"><span id="editor-zoom-value"></span></label><div class="editor__footer"><button id="editor-reset">Reset</button><button id="editor-save">Simpan</button></div></div></div>`);
  await page.addScriptTag({ content: `window.AdminAPI={photoUrl:p=>p,sb:{from:()=>({update:()=>({eq:()=>({eq:async()=>({error:null})})})})},toast:()=>{}}; window.GalleryLayout={ratioAt:()=>1,labelAt:()=>'',shapeAt:()=> 'landscape'};` });
  await page.addScriptTag({ path: 'assets/js/admin/editor.js' });
  const photo = { id: 1, storage_path: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800"%3E%3Crect width="800" height="800" fill="orange"/%3E%3C/svg%3E', focal_x: 50, focal_y: 50, zoom: 1 };
  await page.evaluate(p => window.PhotoEditor.open(p, 'quote', 0), photo);
  await page.locator('#editor-img').waitFor({ state: 'visible' });
  await page.locator('#editor-img').evaluate(img => new Promise(r => img.complete ? r() : img.addEventListener('load', r, { once:true })));
  await page.locator('#editor-zoom').evaluate(input => { input.value='2'; input.dispatchEvent(new Event('input', { bubbles:true })); });
  const preview = page.locator('#editor-preview');
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 - 30);
  await page.mouse.up();
  const result = await page.locator('#editor-img').evaluate(img => ({ fx:Number(img.dataset.fx), fy:Number(img.dataset.fy), origin:img.style.transformOrigin, zoom:img.style.transform }));
  if (!(result.fx > 50 && result.fy > 50) || !result.origin || result.zoom !== 'scale(2)') throw new Error(`Zoomed square photo must pan both axes: ${JSON.stringify(result)}`);
  console.log('PASS: zoom creates real horizontal and vertical pan room in the photo editor.');
} finally { await browser.close(); }
