/** "Salin gaya dari client lain" (provision-invitation): parsing slug/URL dan penyalinan
 *  HANYA gaya (theme/typography/visualEditor). Kode diambil langsung dari index.ts. */
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

let failed = false;
const check = (label, pass, detail) => {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
};

const src = await fs.readFile("supabase/functions/provision-invitation/index.ts", "utf8");
const a = src.indexOf("const slugFromInput");
const b = src.indexOf("const loadStyleSource");
const c = src.indexOf("const applyStyle");
const d = src.indexOf("// Captures root once");
check("potongan kode ditemukan", a > 0 && b > a && c > b && d > c);
const js = stripTypeScriptTypes(src.slice(a, b) + src.slice(c, d));
const build = new Function("admin", `${js}\nreturn { slugFromInput, applyStyle };`);

let stored;
const admin = {
  from() {
    const q = {
      select() { return q; }, eq() { return q; },
      single: async () => ({ data: { content: structuredClone(stored) }, error: null }),
      update(patch) { q.patch = patch; return { eq: () => ({ eq: async () => { stored = q.patch.content; return { error: null }; } }) }; },
    };
    return q;
  },
};
const { slugFromInput, applyStyle } = build(admin);

for (const [input, want] of [
  ["julia-dan-kevin", "julia-dan-kevin"],
  ["https://willcome.my.id/julia-dan-kevin/", "julia-dan-kevin"],
  ["willcome.my.id/Julia-Dan-Kevin/?to=Putri", "julia-dan-kevin"],
  ["  https://willcome.my.id/uput-dan-dany/admin/#/warna ", "uput-dan-dany"],
  ["", ""],
]) check(`slugFromInput(${JSON.stringify(input)}) = ${JSON.stringify(want)}`, slugFromInput(input) === want, slugFromInput(input));

stored = {
  couple: { bride: { name: "Siti" } },
  templates: { klasik: { theme: { colors: { bg: "#fff" } }, photos: { cover: [1] }, extras: { badgeLabel: "BARU" } } },
};
await applyStyle("new-id", {
  couple: { bride: { name: "Sumber" } },
  siteTitle: "Sumber",
  theme: { x: 1 }, typography: { font: "Y" },
  templates: {
    klasik: { theme: { colors: { bg: "#123456" } }, typography: { heading: "Z" }, visualEditor: { elements: { a: { color: "red" } } }, photos: { cover: [9] }, extras: { badgeLabel: "SUMBER" } },
    lain: { theme: { colors: { bg: "#000" } } },
  },
});
check("warna template disalin", stored.templates.klasik.theme.colors.bg === "#123456");
check("typography & visualEditor template disalin", stored.templates.klasik.typography.heading === "Z" && stored.templates.klasik.visualEditor.elements.a.color === "red");
check("blok template lain ikut dibuat", stored.templates.lain?.theme?.colors?.bg === "#000");
check("theme/typography akar disalin", stored.theme?.x === 1 && stored.typography?.font === "Y");
check("nama client baru tidak tertimpa", stored.couple.bride.name === "Siti");
check("judul situs sumber tidak ikut", stored.siteTitle === undefined);
check("foto per-template tidak ikut", JSON.stringify(stored.templates.klasik.photos) === JSON.stringify({ cover: [1] }));
check("extras (teks) tidak ikut", stored.templates.klasik.extras.badgeLabel === "BARU");

if (failed) { console.error("\nFAIL: clone style"); process.exit(1); }
console.log("\nSemua pemeriksaan salin-gaya LULUS.");
