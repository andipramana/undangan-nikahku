/**
 * Ucapan tamu (rsvp.js) sekarang dipaginasi server-side 20/halaman (dulu
 * dibatasi .limit(50) tanpa cara melihat sisanya). Test ini memakai mock
 * window.sb yang mensimulasikan 45 baris (3 halaman: 20, 20, 5) untuk
 * membuktikan navigasi, teks "Halaman X dari Y", dan disabled state tombol
 * di ujung-ujung halaman — tanpa bergantung pada jumlah ucapan sungguhan
 * di database tenant manapun.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const rsvpSource = await fs.readFile("assets/js/rsvp.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.setContent(`
    <form id="rsvp-form"><input id="rsvp-name"><div id="rsvp-attendance"><button type="button" class="rsvp-pill" data-value="hadir">Hadir</button></div><textarea id="rsvp-message"></textarea><button id="rsvp-submit">Kirim</button></form>
    <p id="rsvp-status"></p><div id="wishes-list"></div><nav id="wishes-pagination"></nav>
  `);
  await page.evaluate((source) => {
    Object.defineProperty(window, "localStorage", {
      value: { getItem: () => null, setItem: () => {} },
      configurable: true, writable: true
    });
    window.WEDDING_CONFIG = { guestParam: "to", supabase: { wishesTable: "wishes" } };
    window.TenantContext = { invitationId: "tenant-a" };
    window.revealScan = () => {};
    const TOTAL = 45; // 20 + 20 + 5 -> 3 halaman
    function row(i) { return { id: `w${i}`, name: `Tamu ${i}`, attendance: "hadir", message: `Doa ke-${i}`, pinned: false }; }
    window.sb = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          range(from, to) {
            const rows = [];
            for (let i = from; i <= Math.min(to, TOTAL - 1); i++) rows.push(row(i));
            return Promise.resolve({ data: rows, error: null, count: TOTAL });
          }
        };
      },
      rpc() { return Promise.resolve({ data: null, error: null }); }
    };
    // eslint-disable-next-line no-eval
    eval(source);
    window.initRsvp();
  }, rsvpSource);

  await page.waitForFunction(() => document.querySelectorAll(".wish-card").length === 20);
  const page1Info = await page.locator("#wishes-pagination .wishes-page-info").textContent();
  if (!/Halaman 1 dari 3/.test(page1Info || "")) throw new Error(`Info halaman 1 salah: ${page1Info}`);
  if (!(await page.locator("#wishes-prev").isDisabled())) {
    throw new Error("Tombol Sebelumnya harusnya disabled di halaman pertama.");
  }

  await page.locator("#wishes-next").click();
  await page.waitForFunction(() => document.querySelector(".wish-card__message")?.textContent === "Doa ke-20");
  const page2Info = await page.locator("#wishes-pagination .wishes-page-info").textContent();
  if (!/Halaman 2 dari 3/.test(page2Info || "")) throw new Error(`Info halaman 2 salah: ${page2Info}`);
  if (await page.locator("#wishes-prev").isDisabled()) {
    throw new Error("Tombol Sebelumnya harusnya aktif di halaman tengah.");
  }

  await page.locator("#wishes-next").click();
  await page.waitForFunction(() => document.querySelectorAll(".wish-card").length === 5);
  if (!(await page.locator("#wishes-next").isDisabled())) {
    throw new Error("Tombol Berikutnya harusnya disabled di halaman terakhir.");
  }

  console.log("PASS: pagination ucapan tamu (20/halaman) — navigasi, info halaman, dan disabled state di ujung-ujung sudah benar.");
} finally {
  await browser.close();
}
