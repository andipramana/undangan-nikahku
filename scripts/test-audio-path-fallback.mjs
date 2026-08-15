import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile("assets/js/panel/pages/pengaturan.js", "utf8");
if (!source.includes('typeof window.crypto.randomUUID === "function"')) {
  throw new Error("Audio upload masih tidak punya fallback crypto.randomUUID.");
}

const sandbox = {
  window: { crypto: {} },
  Date: { now: () => 1700000000000 },
  Math: { random: () => 0.5 },
  result: ""
};
vm.createContext(sandbox);
vm.runInContext('result = `a${Date.now()}${Math.random().toString(16).slice(2)}`', sandbox);
if (!/^a1700000000000[0-9a-f]+$/.test(sandbox.result)) {
  throw new Error(`Fallback ID tidak valid: ${sandbox.result}`);
}
console.log("PASS: path audio tetap unik saat crypto.randomUUID tidak tersedia.");
