import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  for (const width of [360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto("http://127.0.0.1:4180/home/", { waitUntil: "networkidle" });
    const result = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Missing ${selector}`);
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      const heroCta = [...document.querySelectorAll("a")].find((link) => link.textContent.includes("Lihat demo dulu"));
      const sticky = rect(".sticky-cta");
      const hero = rect(".hero");
      const media = rect(".hero-media");
      const cta = heroCta.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hero,
        media,
        cta: { width: cta.width, height: cta.height, bottom: cta.bottom },
        sticky,
        stickyDisplay: getComputedStyle(document.querySelector(".sticky-cta")).display,
      };
    });
    if (result.scrollWidth > result.clientWidth) throw new Error(`${width}px: horizontal overflow (${result.scrollWidth}/${result.clientWidth})`);
    if (result.cta.height < 44 || result.cta.width < 100) throw new Error(`${width}px: hero CTA target too small`);
    if (result.stickyDisplay === "none" || result.sticky.height < 44) throw new Error(`${width}px: sticky WhatsApp CTA unavailable`);
    if (result.media.top < result.hero.top || result.media.bottom > result.hero.bottom + 1) throw new Error(`${width}px: hero media escaped its section`);
    await page.screenshot({ path: `test-results/landing-mobile-${width}.png`, fullPage: false });
    await page.close();
  }
  console.log("PASS: /home/ has no horizontal overflow and keeps demo + sticky WhatsApp CTAs tappable at 360/390/430px.");
} finally {
  await browser.close();
}
