import test from "node:test";
import assert from "node:assert/strict";
import {
  invitationPath,
  parseInvitationRoute,
  qrBelongsToInvitation,
  storagePath
} from "../scripts/tenant-routing.mjs";

test("tenant route parses public and admin surfaces", () => {
  assert.deepEqual(parseInvitationRoute("/siti-dan-ujang/"), { slug: "siti-dan-ujang", surface: "invitation" });
  assert.deepEqual(parseInvitationRoute("/siti-dan-ujang/admin/"), { slug: "siti-dan-ujang", surface: "admin" });
  assert.deepEqual(parseInvitationRoute("/siti-dan-ujang/admin-qr/"), { slug: "siti-dan-ujang", surface: "admin-qr" });
});

test("tenant route rejects unrecognized nested paths", () => {
  assert.equal(parseInvitationRoute("/siti-dan-ujang/other/"), null);
  assert.equal(parseInvitationRoute("/Siti-Ujang/"), null);
});

test("tenant paths preserve root and isolate non-root slugs", () => {
  assert.equal(invitationPath("root", "admin"), "/admin/");
  assert.equal(invitationPath("siti-dan-ujang", "admin"), "/siti-dan-ujang/admin/");
  assert.equal(storagePath("siti-dan-ujang", "cover/01.webp"), "siti-dan-ujang/cover/01.webp");
  assert.throws(() => storagePath("siti-dan-ujang", "../other/secret.webp"));
});

test("QR is accepted only for the current invitation slug", () => {
  assert.equal(qrBelongsToInvitation("https://undangan.test/siti-dan-ujang/?to=Tamu", "undangan.test", "siti-dan-ujang"), true);
  assert.equal(qrBelongsToInvitation("https://undangan.test/budi-dan-ani/?to=Tamu", "undangan.test", "siti-dan-ujang"), false);
  assert.equal(qrBelongsToInvitation("https://other.test/siti-dan-ujang/?to=Tamu", "undangan.test", "siti-dan-ujang"), false);
});
