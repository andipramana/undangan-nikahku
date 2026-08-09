import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const css = await fs.readFile('assets/css/admin.css', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
try {
  await page.setContent(`<style>${css}</style><main style="width:390px"><div class="photo-grid photo-grid--gallery" style="--gallery-thumb-height:120px"><article class="photo-card photo-card--full"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--half"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--half"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--third"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--twothirds"><div class="photo-card__thumb"></div></article></div></main>`);
  const actual = await page.evaluate(() => {
    const grid = document.querySelector('.photo-grid--gallery').getBoundingClientRect();
    const rect = cls => document.querySelector(cls).getBoundingClientRect();
    const full=rect('.photo-card--full'), half=rect('.photo-card--half'), third=rect('.photo-card--third'), two=rect('.photo-card--twothirds');
    return { grid:grid.width, full:full.width, half:half.width, third:third.width, two:two.width, heights:[full,half,third,two].map(r=>r.querySelector?.()) };
  });
  const gap = 8; // .5rem in admin CSS
  const expected = { full: actual.grid, half: (actual.grid-gap)/2, third: (actual.grid-gap*2)/3, two: (actual.grid-gap*2)*2/3+gap };
  for (const key of Object.keys(expected)) if (Math.abs(actual[key]-expected[key]) > 1) throw new Error(`Wrong ${key} gallery width: got ${actual[key]}, expected ${expected[key]}`);
  console.log('PASS: gallery cards render exact 100% / 50% / 33.33% / 66.67% widths.');
} finally { await browser.close(); }
