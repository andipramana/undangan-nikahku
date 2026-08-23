/**
 * PanelListPin — PIN angka OPSIONAL per daftar, dipakai BERSAMA halaman
 * Kontak (contact_lists) dan Kado & Amplop (gift_lists). Tujuan: satu
 * anggota admin tidak bisa "ngintip" isi daftar milik anggota lain yang
 * berbagi login admin yang sama (mis. Amplop Pengantin Pria vs Wanita).
 *
 * Dua tempat penyimpanan yang SENGAJA berbeda:
 * - Supabase: kolom `pin_hash` (migration 0027) — SHA-256 hex dari PIN,
 *   TIDAK pernah plaintext.
 * - localStorage kunci `wedding_listpin_<slug>_<kind>_<listId>` = "1":
 *   penanda "device ini sudah pernah berhasil buka daftar itu", supaya
 *   tidak diminta PIN ulang tiap kali membuka. Bukan sumber kebenaran.
 *
 * Modul ini mandirian dari PanelUI/AdminAPI (overlay dibangun sendiri,
 * error tampil inline) supaya gampang diuji; penulisan DB lewat changeDialog()
 * menerima window.AdminAPI dari pemanggil. Catatan jujur: ini gerbang UI
 * biasa — RLS tetap mengizinkan semua admin tenant baca penuh, jadi bukan
 * proteksi dari admin yang niat teknis (lihat rencana §2).
 */
window.PanelListPin = (() => {
  const MIN_DIGIT = 4;
  const MAX_DIGIT = 8;

  /** Kunci localStorage per tenant+jenis halaman+daftar. Slug root tenant
   * adalah "root" (lihat tenant.js); kalau AdminAPI belum siap, pakai itu. */
  function lsKey(kind, listId) {
    const slug = (window.AdminAPI && window.AdminAPI.tenant && window.AdminAPI.tenant.slug) || "root";
    return `wedding_listpin_${slug}_${kind}_${listId}`;
  }

  function unlockKeyFor({ kind, list }) {
    return lsKey(kind, list.id);
  }

  /** SHA-256 hex — hash yang sama yang diverifikasi terhadap pin_hash DB. */
  async function hashPin(pin) {
    if (!window.crypto || !crypto.subtle) throw new Error("Browser tidak mendukung crypto.subtle.");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(pin)));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** PIN baru valid: 4–8 digit angka. Kosong → null (artinya hapus/tidak
   * memakai PIN — dipakai readFieldHash & tombol Hapus PIN). */
  function parseNewPin(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return { value: null };
    if (!new RegExp(`^\\d{${MIN_DIGIT},${MAX_DIGIT}}$`).test(s)) {
      return { error: `PIN harus ${MIN_DIGIT}–${MAX_DIGIT} digit angka.` };
    }
    return { value: s };
  }

  /* ---------- Overlay mini (mandiri, tanpa PanelUI) ---------- */

  function buildOverlay(innerHtml) {
    const wrap = document.createElement("div");
    wrap.className = "p-modal"; // CSS .p-modal tampil default; hidden tak dipakai
    wrap.innerHTML = `<div class="p-modal__panel">${innerHtml}</div>`;
    document.body.appendChild(wrap);
    return wrap;
  }
  function closeOverlay(wrap) { wrap.remove(); }

  /* ---------- Gerbang buka daftar ---------- */

  /** resolve(true) kalau boleh masuk: daftar tanpa pin, device sudah pernah
   * unlock, ATAU PIN diketik benar. resolve(false) kalau admin batal.
   * Salah PIN TIDAK menutup overlay — pesan inline, bisa coba lagi. */
  function gate({ kind, list }) {
    if (!list || !list.pin_hash) return Promise.resolve(true);
    const key = lsKey(kind, list.id);
    try { if (localStorage.getItem(key) === "1") return Promise.resolve(true); } catch { /* storage diblok → tetap minta PIN */ }
    return new Promise((resolve) => {
      const wrap = buildOverlay(`
        <div class="p-modal__header"><h3>Buka &quot;${list.name}&quot;</h3><button type="button" class="p-modal__close" aria-label="Tutup">&times;</button></div>
        <label class="p-field"><span>PIN daftar (${MIN_DIGIT}–${MAX_DIGIT} digit)</span><input class="p-input lp-pin-input" inputmode="numeric" maxlength="${MAX_DIGIT}" autocomplete="off"></label>
        <p class="lp-error" hidden></p>
        <div class="lp-actions"><button type="button" class="p-btn p-btn--primary" data-lp-ok>Buka</button></div>
      `);
      const input = wrap.querySelector(".lp-pin-input");
      const err = wrap.querySelector(".lp-error");
      const done = (value) => { closeOverlay(wrap); resolve(value); };
      wrap.querySelector(".p-modal__close").addEventListener("click", () => done(false));
      async function submit() {
        err.hidden = true;
        const v = input.value.trim();
        if (!/^\d+$/.test(v)) { err.textContent = "PIN hanya boleh angka."; err.hidden = false; return; }
        let hashed;
        try { hashed = await hashPin(v); } catch { done(false); return; }
        if (hashed !== list.pin_hash) {
          err.textContent = "PIN salah — coba lagi.";
          err.hidden = false;
          input.value = "";
          input.focus();
          return;
        }
        try { localStorage.setItem(key, "1"); } catch { /* abaikan */ }
        done(true);
      }
      wrap.querySelector("[data-lp-ok]").addEventListener("click", submit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
      input.focus();
    });
  }

  /* ---------- Ganti / pasang / hapus PIN dari dalam daftar ---------- */

  /** Dialog tunggal: verifikasi PIN lama (kalau daftar sudah ber-PIN),
   * lalu simpan PIN baru atau hapus PIN. Menulis DB via api.query + api.sb
   * (dipass pemanggil), memutasi list.pin_hash. resolve true = berubah. */
  function changeDialog({ kind, table, list, api }) {
    const adaPin = !!list.pin_hash;
    return new Promise((resolveOuter) => {
      const wrap = buildOverlay(`
        <div class="p-modal__header"><h3>${adaPin ? "Ganti PIN" : "Pasang PIN"} — ${list.name}</h3><button type="button" class="p-modal__close" aria-label="Tutup">&times;</button></div>
        ${adaPin ? `<label class="p-field"><span>PIN saat ini</span><input class="p-input" data-lp-old inputmode="numeric" maxlength="${MAX_DIGIT}" autocomplete="off"></label>` : ""}
        <label class="p-field"><span>PIN baru</span><input class="p-input" data-lp-new inputmode="numeric" maxlength="${MAX_DIGIT}" autocomplete="off" placeholder="${MIN_DIGIT}–${MAX_DIGIT} digit angka"></label>
        <p class="lp-error" data-lp-error hidden></p>
        <div class="lp-actions">
          ${adaPin ? `<button type="button" class="p-btn p-btn--danger" data-lp-remove>Hapus PIN</button>` : ""}
          <button type="button" class="p-btn p-btn--primary" data-lp-save>Simpan</button>
        </div>
      `);
      const oldInput = wrap.querySelector("[data-lp-old]");
      const newInput = wrap.querySelector("[data-lp-new]");
      const err = wrap.querySelector("[data-lp-error]");
      const gagal = (msg) => { err.textContent = msg; err.hidden = false; };
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        closeOverlay(wrap);
        resolveOuter(value);
      };
      wrap.querySelector(".p-modal__close").addEventListener("click", () => done(false));

      async function verifikasiPinLama() {
        if (!adaPin) return true;
        const oldParsed = parseNewPin(oldInput.value);
        if (oldParsed.error) { gagal("Isi PIN saat ini dulu."); return false; }
        return (await hashPin(oldParsed.value)) === list.pin_hash;
      }

      async function clearUnlockFlag() {
        try { localStorage.removeItem(lsKey(kind, list.id)); } catch { /* abaikan */ }
      }

      async function save() {
        err.hidden = true;
        if (!(await verifikasiPinLama())) { gagal("PIN saat ini salah."); return; }
        const parsed = parseNewPin(newInput.value);
        if (parsed.error) { gagal(parsed.error); return; }
        if (parsed.value === null) { gagal("Kosongkan pakai tombol Hapus PIN."); return; }
        const pin_hash = await hashPin(parsed.value);
        const { error } = await api.query(
          api.sb.from(table).update({ pin_hash }).eq("invitation_id", api.tenant.invitationId).eq("id", list.id),
          "Penyimpanan PIN daftar"
        );
        if (error) { api.toast("Gagal menyimpan PIN: " + error.message, true); return; }
        list.pin_hash = pin_hash;
        await clearUnlockFlag(); // ganti PIN → device wajib konfirmasi sekali lagi
        api.toast("PIN daftar disimpan.");
        done(true);
      }

      async function removePin() {
        err.hidden = true;
        if (!(await verifikasiPinLama())) { gagal("PIN saat ini salah."); return; }
        if (!confirm(`Hapus PIN daftar "${list.name}"?\n\nDaftar akan terbuka langsung tanpa PIN.`)) return;
        const { error } = await api.query(
          api.sb.from(table).update({ pin_hash: null }).eq("invitation_id", api.tenant.invitationId).eq("id", list.id),
          "Penghapusan PIN daftar"
        );
        if (error) { api.toast("Gagal menghapus PIN: " + error.message, true); return; }
        list.pin_hash = null;
        await clearUnlockFlag();
        api.toast("PIN daftar dihapus.");
        done(true);
      }

      wrap.querySelector("[data-lp-save]").addEventListener("click", save);
      const removeBtn = wrap.querySelector("[data-lp-remove]");
      if (removeBtn) removeBtn.addEventListener("click", removePin);
      if (oldInput) oldInput.focus(); else newInput.focus();
    });
  }

  /* ---------- Field PIN opsional di modal "Daftar baru"/"Ganti nama" ---------- */

  /** <label> field PIN untuk disuntikkan ke markup modal milik halaman. */
  function fieldHtml(inputId) {
    return `<label class="p-field"><span>PIN (opsional)</span><input class="p-input" id="${inputId}" inputmode="numeric" maxlength="${MAX_DIGIT}" autocomplete="off" placeholder="${MIN_DIGIT}–${MAX_DIGIT} digit angka"></label>`;
  }

  /** Baca field PIN modal saat Simpan: {hash} isi baru, {skip:true} kosong
   * (JANGAN ubah pin_hash yang sudah ada), atau {error}. */
  async function readFieldHash(inputId) {
    const el = document.getElementById(String(inputId).replace(/^#/, ""));
    const parsed = parseNewPin(el ? el.value : "");
    if (parsed.error) return parsed;
    if (parsed.value === null) return { skip: true };
    return { hash: await hashPin(parsed.value) };
  }

  return { gate, changeDialog, fieldHtml, readFieldHash, hashPin, parseNewPin };
})();
