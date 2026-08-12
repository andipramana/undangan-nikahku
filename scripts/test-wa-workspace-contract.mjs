import fs from "node:fs/promises";

const [page, css, runtime, routing] = await Promise.all([
  fs.readFile("wa.html", "utf8"),
  fs.readFile("assets/css/wa.css", "utf8"),
  fs.readFile("assets/js/wa.js", "utf8"),
  fs.readFile("assets/js/tenant.js", "utf8")
]);

const checks = [
  ["shell tidak mewarisi admin gelap", !page.includes("assets/css/admin.css") && page.includes("assets/css/wa.css")],
  ["shell menyediakan kirim manual", page.includes("wa-blast.js") && !runtime.includes("setInterval(")],
  ["guard hanya admin", /allowedRoles:\s*\["admin", "root_owner"\]/.test(runtime)],
  ["route tenant WA tersedia", /kind === "wa"/.test(routing) && /"wa.html"/.test(routing)],
  ["visual terang memakai token sendiri", css.includes("--wa-paper") && css.includes("--wa-green")],
  ["pencarian dan list compact tersedia", page.includes("wa-contacts") && css.includes("wa-contact-shell") && css.includes("wa-contact-toolbar__filters")]
];
for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
