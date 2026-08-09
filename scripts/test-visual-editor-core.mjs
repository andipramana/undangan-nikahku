import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const registry = await fs.readFile("assets/js/visual-editor/registry.js", "utf8");
const panel = await fs.readFile("assets/js/admin/visual-editor.js", "utf8");
const pageHtml = await fs.readFile("admin.html", "utf8");
const adminCss = await fs.readFile("assets/css/admin.css", "utf8");
if (!registry.includes("autoTargets") || !registry.includes("data-ve-auto")) throw new Error("Registry must generate code-owned targets for every visible text item.");
if (!panel.includes("VisualEditorPanel") || !panel.includes("Semua halaman — scroll")) throw new Error("Visual editor must be a single scrollable invitation preview.");
if (!panel.includes("resetScope") || !panel.includes("Reset global")) throw new Error("Global reset control is missing.");
if (!panel.includes("data-ve-static-surface") || !panel.includes("gift-confirm-modal")) throw new Error("Hidden gift UI is not surfaced for static editing.");
if (!pageHtml.includes('data-tab="editor-visual"') || !pageHtml.includes('id="tab-editor-visual"')) throw new Error("Editor Visual tab is missing without preserving normal admin markup.");
if (!panel.includes('id="ve-edit-modal"') || !panel.includes('ve-edit-modal").hidden=false')) throw new Error("Element inspector is not opened as a modal.");
if (!panel.includes('FONT_OPTIONS') || !panel.includes('<select class="input" id="ve-family">') || !panel.includes("style=\"font-family:'${esc(font)}',sans-serif\"")) throw new Error("Visual-editor font must use the curated self-styled dropdown, not free text input.");
if (panel.includes('visualEditorPreview=1')) throw new Error("Unsupported visualEditorPreview query parameter still exists.");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.setContent('<style>' + adminCss + '</style><main class="visual-editor-panel"><div class="ve-layout"><div class="ve-phone"></div><aside class="ve-inspector"></aside></div></main>');
  const phoneWidth = await page.locator('.ve-phone').evaluate(el => getComputedStyle(el).maxWidth);
  if (phoneWidth !== '430px') throw new Error(`Expected exact mobile canvas maximum width, got ${phoneWidth}`);
  console.log("PASS: Editor Visual has mobile canvas, per-item targets, scopes, and resets.");
} finally { await browser.close(); }
