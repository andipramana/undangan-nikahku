import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const css = await fs.readFile('assets/css/admin.css', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.setContent(`<style>${css}</style><main>
    <div class="photo-grid photo-grid--cover"><article class="photo-card photo-card--hero" style="--photo-ratio:${9 / 19.5}"><div class="photo-card__thumb"></div></article></div>
    <div class="photo-grid photo-grid--gallery"><article class="photo-card photo-card--gallery photo-card--full" data-gallery-row="1" style="--photo-ratio:1.6;grid-row:1"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--gallery photo-card--half" data-gallery-row="2" style="--photo-ratio:.8;grid-row:2"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--gallery photo-card--third" data-gallery-row="3" style="--photo-ratio:.533;grid-row:3"><div class="photo-card__thumb"></div></article><article class="photo-card photo-card--gallery photo-card--twothirds" data-gallery-row="3" style="--photo-ratio:1.066;grid-row:3"><div class="photo-card__thumb"></div></article></div>
  </main>`);
  const result = await page.evaluate(() => {
    const hero = document.querySelector('.photo-card--hero');
    const full = document.querySelector('.photo-card--full');
    const half = document.querySelector('.photo-card--half');
    const third = document.querySelector('.photo-card--third');
    const twothirds = document.querySelector('.photo-card--twothirds');
    const thumb = el => el.querySelector('.photo-card__thumb').getBoundingClientRect();
    return {
      heroGrid: getComputedStyle(hero).gridColumn,
      fullGrid: getComputedStyle(full).gridColumn, halfGrid: getComputedStyle(half).gridColumn,
      thirdGrid: getComputedStyle(third).gridColumn, twothirdsGrid: getComputedStyle(twothirds).gridColumn,
      rows: [full, half, third, twothirds].map(el => getComputedStyle(el).gridRowStart),
      heroRatio: thumb(hero).width / thumb(hero).height,
      fullRatio: thumb(full).width / thumb(full).height,
      halfRatio: thumb(half).width / thumb(half).height
    };
  });
  if (result.heroGrid !== '1 / -1' || result.fullGrid !== '1 / -1' || result.halfGrid !== 'span 6' || result.thirdGrid !== 'span 4' || result.twothirdsGrid !== 'span 8' || result.rows.join(',') !== '1,2,3,3' || Math.abs(result.heroRatio - 9 / 19.5) > .02 || Math.abs(result.fullRatio - 1.6) > .02 || Math.abs(result.halfRatio - .8) > .02) throw new Error(`Admin card geometries do not mirror guest slots: ${JSON.stringify(result)}`);
  console.log('PASS: full-screen hero and explicit full/half/third/twothirds gallery rows render at real guest geometries.');
} finally { await browser.close(); }
