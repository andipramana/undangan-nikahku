import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const source = await fs.readFile("assets/js/theme.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  await page.setContent('<section id="rsvp"><h2 class="section-title">Judul RSVP</h2><button id="rsvp-submit">Kirim</button></section><p id="couple-names-cover" class="cover-names">Mita & Andi</p>');
  await page.evaluate((code) => { new Function(code)(); }, source);
  await page.evaluate(() => window.applyTheme({ typography: { elements: {
    "cover-names": { family: "Great Vibes", size: 56, weight: 400, color: "#7a2b30" },
    "rsvp-title": { family: "Cormorant Garamond", size: 38, weight: 600, color: "#2b2620" },
    "rsvp-form": { family: "Montserrat", size: 15, weight: 700, color: "#ffffff" }
  } } }));
  const values = await page.evaluate(() => ({
    names: document.querySelector('#couple-names-cover').style.cssText,
    title: document.querySelector('#rsvp .section-title').style.cssText,
    button: document.querySelector('#rsvp-submit').style.cssText,
    fontLinks: document.querySelectorAll('link[id^="dynamic-font-"]').length
  }));
  if (!values.names.includes('56px') || !values.names.includes('Great Vibes')) throw new Error(`Cover name style missing: ${values.names}`);
  if (!values.title.includes('38px') || !values.title.includes('600')) throw new Error(`RSVP title style missing: ${values.title}`);
  if (!values.button.includes('15px') || !values.button.includes('700')) throw new Error(`RSVP form style missing: ${values.button}`);
  if (values.fontLinks !== 3) throw new Error(`Expected 3 dynamic font links, got ${values.fontLinks}`);
  console.log('PASS: saved per-element typography applies independently.');
} finally { await browser.close(); }
