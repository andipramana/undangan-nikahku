/* Registry target Editor Visual. Target teks dibuat dari markup yang benar-benar
 * terlihat dengan urutan deterministik; tidak menerima selector dari admin. */
(function () {
  const SECTIONS = [["all", "Semua halaman (scroll)"], ["global", "Global settings"]];
  // .wish-card ikut di-exclude: kartu ucapan tampil asinkron (rsvp.js) dan
  // jumlahnya berubah antar sesi — kalau teksnya ikut jadi kandidat, index
  // data-ve-auto semua elemen SESUDAH #wishes (nama closing, footer) bergeser
  // dan override visualEditor yang tersimpan menunjuk elemen salah. Styling
  // kartu sudah ditangani target khusus wish.card.
  const EXCLUDE = "script,style,svg,path,option,.ve-pencil,[aria-hidden='true'],.wish-card";
  // #inv-root, BUKAN #invitation: itu elemen mount UNIVERSAL yang didefinisikan
  // cangkang (index.html), sama untuk keempat template. #invitation cuma nama
  // <main> milik klasik (templates/klasik/markup.html) — dulu selector ini
  // ditulis untuk klasik saja, jadi candidates() kosong untuk Nocturne/Kertas/
  // Sekar Jagat (id akar mereka nc-root/kt-root/sj-root). Klasik tetap tercakup
  // karena <main id="invitation"> tetap ada DI DALAM #inv-root.
  const candidates = (doc) => [...doc.querySelectorAll("#inv-root h1,#inv-root h2,#inv-root h3,#inv-root h4,#inv-root p,#inv-root small,#inv-root button,#inv-root a,#inv-root label,#inv-root strong,#inv-root legend,#gift-confirm-modal h3,#gift-confirm-modal p,#gift-confirm-modal button,#gift-confirm-modal label,#gift-recs-modal h3,#gift-recs-modal p,#gift-recs-modal button,#gift-recs-modal a")]
    .filter(el => !el.closest(EXCLUDE) && !el.closest("[data-ve-wish-dummy]") && el.textContent.trim() && !el.closest(".ve-pencil"));
  function markAutoTargets(doc) {
    candidates(doc).forEach((el, index) => {
      // key berdasarkan urutan markup undangan yang code-owned/deterministik.
      el.dataset.veAuto = String(index);
    });
  }
  function autoTargets(doc) {
    markAutoTargets(doc);
    return candidates(doc).map((el, index) => ({
      id: `text.auto::${index}`,
      baseId: "text.auto",
      section: "all",
      selector: `[data-ve-auto="${index}"]`,
      kind: /^(BUTTON|A)$/.test(el.tagName) ? "button" : "text",
      label: (el.textContent.trim().replace(/\s+/g, " ").slice(0, 54) || "Teks")
    }));
  }
  const WISH_CARD_TARGET = { id:"wish.card", baseId:"wish.card", section:"all", selector:".wish-card", kind:"wish-card", label:"Style semua kartu ucapan" };
  function targetForId(id, doc) {
    if (id === WISH_CARD_TARGET.id) return WISH_CARD_TARGET;
    if (String(id).startsWith("text.auto::")) {
      const index = Number(String(id).split("::")[1]);
      markAutoTargets(doc || document);
      const el = (doc || document).querySelector(`[data-ve-auto="${index}"]`);
      return el ? { id, baseId:"text.auto", section:"all", selector:`[data-ve-auto="${index}"]`, kind:/^(BUTTON|A)$/.test(el.tagName)?"button":"text", label:el.textContent.trim().slice(0,54) } : null;
    }
    return null;
  }
  window.VisualEditorRegistry = {
    sections: SECTIONS.map(([id, label]) => ({ id, label })),
    targets: [],
    markAutoTargets,
    autoTargets,
    forSection: (section, doc) => section === "all" ? [...autoTargets(doc || document), WISH_CARD_TARGET] : [],
    get: (id, doc) => targetForId(id, doc),
    categories: ["all", "text", "typography", "button", "image", "overlay", "position"]
  };
})();
