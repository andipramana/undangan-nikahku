/**
 * Menggantikan test-font-panel-browser.mjs (dihapus, membaca
 * assets/js/admin/fonts.js yang sudah tidak ada) — sekarang menargetkan
 * assets/js/panel/pages/font.js (window.PanelPages["font"]), lewat store.js
 * asli (bukan mock sb.upsert manual) supaya pola SELECT-merge-UPSERT satu
 * pintu ikut teruji. Perilaku yang diverifikasi sama seperti sebelumnya:
 * dropdown section, preview memakai konten sungguhan, reset per-elemen, dan
 * reset semua.
 */
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.setContent('<div id="p-outlet-inner"></div>');
  await page.evaluate(() => {
    window.__saved = null;
    const content = {
      couple: { bride: { nickname: "Salsa", name: "Salsa Putri", father: "Budi", mother: "Rina" }, groom: { nickname: "Raka", name: "Raka Putra" } },
      defaultGuestName: "Keluarga Bahagia",
      event: { dateLabel: "12 Desember 2026", dayLabel: "Sabtu", akad: { label: "Akad Pemberkatan", venue: { name: "Ballroom Cendana" } } },
      opening: { quote: "Doa terbaik untuk perjalanan kami." },
      quotePhoto: { quote: "Cinta yang bertumbuh." },
      dresscode: { text: "" }, loveStory: [{ title: "" }], closing: { text: "" },
      typography: { elements: {} }
    };
    const chain = () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { content }, error: null }) });
    window.sb = { from: (table) => table === "site_content" ? { ...chain(), upsert: async (row) => { window.__saved = row; content.typography = row.content.typography; return { error: null }; } } : chain() };
    window.AdminAPI = { sb: window.sb, tenant: { invitationId: "test", slug: "test" }, query: async (q) => q, contentFromConfig: () => content, toast: () => {} };
    window.WEDDING_CONFIG = { supabase: {} };
    // Router distub minimal: font.js hanya butuh setDirty untuk mendaftarkan
    // callback simpan (dipicu manual di test lewat window.__save()), dan
    // refreshPublishStatus dipanggil router asli setelah mount — tidak
    // relevan di sini karena kita mount() langsung, bukan lewat router.
    window.PanelRouter = { setDirty: (dirty, fn) => { window.__save = fn; }, clearDirty: () => {} };
  });
  await page.addScriptTag({ path: 'assets/js/panel/ui.js' });
  await page.addScriptTag({ path: 'assets/js/panel/store.js' });
  await page.addScriptTag({ path: 'assets/js/panel/pages/font.js' });
  await page.evaluate(async () => { await window.PanelStore.load(); await window.PanelPages["font"].mount(document.getElementById("p-outlet-inner")); });

  if (await page.locator('#fn-section').count() !== 1) throw new Error('Section dropdown missing.');
  const coverCards = await page.locator('#p-outlet-inner .p-card').count();
  if (coverCards !== 4) throw new Error(`Cover must show four independent elements, got ${coverCards}.`);

  await page.locator('[data-font-family="cover-names"]').fill('Great Vibes');
  await page.locator('[data-font-size="cover-names"]').fill('56');
  await page.evaluate(() => window.__save());
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
  await page.locator('#fn-reset-all').click();
  const globalReset = await page.evaluate(() => ({
    family: document.querySelector('[data-font-family="cover-eyebrow"]').value,
    size: document.querySelector('[data-font-size="cover-eyebrow"]').value,
    weight: document.querySelector('[data-font-weight="cover-eyebrow"]').value,
    preview: document.querySelector('[data-font-preview="cover-eyebrow"]').textContent
  }));
  if (globalReset.family !== 'Alegreya Sans' || globalReset.size !== '13' || globalReset.weight !== '500' || globalReset.preview !== 'THE WEDDING OF') {
    throw new Error(`Global reset did not restore defaults: ${JSON.stringify(globalReset)}`);
  }
  await page.evaluate(() => window.__save());
  saved = await page.evaluate(() => window.__saved);
  if (Object.keys(saved.content.typography.elements).length) throw new Error('Global reset did not clear all saved overrides.');

  // 7 grup section (§3.1 rencana v2) harus lengkap, bukan cuma Cover.
  const sectionCount = await page.locator('#fn-section option').count();
  if (sectionCount !== 7) throw new Error(`Font page must expose all 7 typography groups, got ${sectionCount}.`);

  console.log('PASS: halaman Font (panel v2) punya kontrol section lengkap (7 grup), preview konten sungguhan, reset per-elemen & reset semua, dan simpan lewat store.js satu pintu.');
} finally { await browser.close(); }
