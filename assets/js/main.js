/** Bootstrapper halaman tamu.
 *
 * Tugasnya cuma tiga: ambil data, tentukan template, serahkan ke mesin
 * template. SELURUH tampilan (markup, CSS, transisi) milik template aktif di
 * templates/<id>/ — file ini tidak boleh membuat elemen visual apa pun
 * (lihat docs/kontrak-template.md).
 *
 * Sebelumnya file ini juga memegang populateContent + semua perilaku section;
 * itu sekarang jadi milik templates/klasik/render.js, karena memang khas
 * template itu, bukan perilaku universal.
 */
(function () {
  "use strict";

  const core = window.WeddingCore;
  const engine = window.WeddingEngine;

  /* ── Preloader ───────────────────────────────────────────────────────────
     Batas keras didaftarkan SEKARANG, bukan setelah rantai await di bawah.
     Bug lama yang tidak boleh terulang: timer 3 detik dulu baru MULAI
     menghitung setelah fetch+render selesai, jadi kalau RPC lambat 8 detik,
     preloader baru hilang di detik ke-11. Sekarang timer jalan dari awal
     skrip, independen dari cepat/lambatnya jaringan. */
  function hidePreloader() {
    const pre = document.getElementById("preloader");
    if (pre) pre.classList.add("hide");
  }
  // Jaring pengaman keras sejak awal skrip (bukan setelah rantai await):
  // preloader wajib hilang paling lambat 2,5 detik walau jaringan/decode lambat.
  setTimeout(hidePreloader, 2500);

  /** Tunggu foto cover selesai decode (maksimal 2,5 detik) sebelum menutup
   * preloader, supaya preloader hilang karena SIAP, bukan karena timeout. */
  async function waitForCoverDecode() {
    const root = document.getElementById("inv-root");
    const coverImg = root && (root.querySelector("#cover img[src]") || root.querySelector("img[src]"));
    if (!coverImg || typeof coverImg.decode !== "function") return;
    await Promise.race([
      coverImg.decode().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  }

  /** Template lama memakai id "classic-elegance"; sejak template punya folder
   * sendiri namanya "klasik". Data tenant lama tidak perlu diubah — cukup
   * dipetakan di sini saat dibaca. */
  const ALIAS = { "classic-elegance": "klasik" };
  const resolveId = (raw) => {
    const id = String(raw || "").replace(/\/+$/, "");
    return ALIAS[id] || id;
  };

  /** Judul & meta share ikut data tenant — kalau nama/tanggal diubah lewat
   * admin, tautan yang dibagikan tidak lagi menampilkan data lama. */
  function applyMeta(cfg) {
    if (cfg.siteTitle) {
      document.title = cfg.siteTitle;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", cfg.siteTitle);
      const ogSite = document.querySelector('meta[property="og:site_name"]');
      if (ogSite) ogSite.setAttribute("content", cfg.siteTitle);
    }
    const desc = `Undangan pernikahan digital ${cfg.couple.bride.name} & ${cfg.couple.groom.name}, ${cfg.event.dateLabel}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", desc);
  }

  /** Blok setelan milik template aktif. Warna/font/override/urutan section &
   * pilihan foto disimpan per-template supaya tidak pernah bocor antar
   * template (lihat docs/kontrak-template.md §Aturan isolasi). */
  function templateBlock(cfg, id) {
    const all = (cfg && cfg.templates) || {};
    return all[id] || {};
  }

  /** Proyeksikan setelan milik template aktif ke key yang dibaca modul lama
   * (theme.js membaca cfg.theme & cfg.typography, guest-overrides.js membaca
   * cfg.visualEditor). Dengan begini isolasi per-template tercapai TANPA
   * mengubah satu baris pun di modul-modul itu: yang berbeda cuma nilai yang
   * disodorkan sebelum render.
   *
   * Kalau template belum punya setelan tersimpan, key global dibiarkan apa
   * adanya — template baru langsung tampil dengan nilai bawaan manifest-nya,
   * bukan mewarisi warna template lain. */
  function projectTemplateSettings(cfg, id) {
    const blk = (cfg.templates || {})[id];
    if (!blk) return;
    if (blk.theme) cfg.theme = blk.theme;
    if (blk.typography) cfg.typography = blk.typography;
    if (blk.visualEditor) cfg.visualEditor = blk.visualEditor;
  }

  function buildContext(cfg, id, manifest, root) {
    const tplBlock = templateBlock(cfg, id);
    return {
      mount: root,
      id,
      manifest,
      data: cfg,
      tpl: tplBlock,
      guest: core.buildGuest(cfg),
      photos: (slot) => window.WeddingPhotos.forSlot(slot, tplBlock),
      panStyle: window.WeddingPhotos.panStyle,
      esc: core.esc,
      fmt: core.fmt,
      services: {
        // Modul perilaku mendaftarkan dirinya di window.* saat dimuat lewat
        // assets.js template. Dibungkus di sini supaya template baru punya
        // satu tempat untuk melihat apa yang tersedia.
        rsvp: () => window.initRsvp && window.initRsvp(),
        checkin: () => window.initQrCheckin && window.initQrCheckin(),
        audio: () => window.initAudioPlayer && window.initAudioPlayer(),
        countdown: () => window.initCountdown && window.initCountdown(),
        reveal: () => window.initReveal && window.initReveal()
      }
    };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.documentElement.classList.add("no-scroll");

    // Aset template mulai diunduh BERSAMAAN dengan RPC data (id-nya ditebak
    // dari cache/URL). Tanpa ini, template baru bisa diunduh setelah data
    // tiba — menambah satu perjalanan jaringan di jalur paling kritis.
    let pending = engine.prefetch(engine.initialId());

    const baseConfig = JSON.parse(JSON.stringify(window.WEDDING_CONFIG));
    const cachedPayload = window.getCachedInvitation ? window.getCachedInvitation() : null;
    const freshPromise = window.fetchInvitation();

    // Stale-while-revalidate: kalau cache localStorage tersedia, render
    // LANGSUNG dari cache (kunjungan ulang ≤ 0,8 s), lalu perbarui di latar
    // belakang bila hasil RPC berbeda.
    const payload = cachedPayload || (await freshPromise);
    if (payload && payload.content) {
      window.WEDDING_CONFIG = core.mergeContent(JSON.parse(JSON.stringify(baseConfig)), payload.content);
    }
    window.__PHOTO_PAYLOAD = payload && payload.photos ? payload.photos : null;
    const cfg = window.WEDDING_CONFIG;

    applyMeta(cfg);
    // Ikon tab & ikon saat dipasang ke layar utama: unggahan client (content.appIcon).
    if (window.WeddingPwa) window.WeddingPwa.setAppIcon(cfg.appIcon);

    // ?template= (pratinjau dari admin) menang atas pilihan tersimpan tenant.
    // Kalau content.templateId menunjuk template yang sudah tidak ada di
    // templates/index.json, jatuh ke DEFAULT_ID ("klasik") tanpa menulis balik
    // ke database (biarkan admin yang mengubahnya sendiri).
    const fromUrl = resolveId(new URLSearchParams(location.search).get("template"));
    const saved = resolveId(cfg.templateId || cfg.template);
    const rawWanted = fromUrl || saved || engine.DEFAULT_ID;
    let wanted = engine.resolveKnownId ? await engine.resolveKnownId(rawWanted) : rawWanted;
    // Tebakan awal meleset (mis. tenant baru saja ganti template di admin) —
    // buang dan unduh yang benar. Hanya terjadi sekali; kunjungan berikutnya
    // cache sudah benar.
    if (wanted !== pending.id) pending = engine.prefetch(wanted);

    projectTemplateSettings(cfg, wanted);

    try {
      await engine.mount(pending, (manifest, root) => buildContext(cfg, wanted, manifest, root));
    } catch (err) {
      console.error("Gagal memuat template:", err);
      // Jangan tinggalkan tamu di layar kosong: kalau template pilihan tenant
      // rusak/hilang, jatuh ke template bawaan yang selalu ada di repo.
      if (wanted !== engine.DEFAULT_ID) {
        wanted = engine.DEFAULT_ID;
        await engine.mount(
          engine.prefetch(engine.DEFAULT_ID),
          (manifest, root) => buildContext(cfg, engine.DEFAULT_ID, manifest, root)
        );
      }
    }

    await waitForCoverDecode();
    hidePreloader();

    // Revalidasi latar belakang saat render awal berasal dari cache.
    if (cachedPayload) {
      freshPromise.then(async (fresh) => {
        if (!fresh || !fresh.content || window.__invitationOpen) return;
        const prevSig = JSON.stringify({ c: cachedPayload.content, p: cachedPayload.photos });
        const nextSig = JSON.stringify({ c: fresh.content, p: fresh.photos });
        if (prevSig === nextSig) return;
        window.WEDDING_CONFIG = core.mergeContent(JSON.parse(JSON.stringify(baseConfig)), fresh.content);
        window.__PHOTO_PAYLOAD = fresh.photos || null;
        const nextCfg = window.WEDDING_CONFIG;
        applyMeta(nextCfg);
        const nextSaved = resolveId(nextCfg.templateId || nextCfg.template);
        const nextRaw = fromUrl || nextSaved || engine.DEFAULT_ID;
        const nextWanted = engine.resolveKnownId ? await engine.resolveKnownId(nextRaw) : nextRaw;
        projectTemplateSettings(nextCfg, nextWanted);
        const activeTpl = window.WeddingTemplates[wanted];
        if (activeTpl && typeof activeTpl.destroy === "function") {
          try { activeTpl.destroy(); } catch (_) {}
        }
        await engine.mount(
          engine.prefetch(nextWanted),
          (manifest, root) => buildContext(nextCfg, nextWanted, manifest, root)
        ).catch(() => {});
      }).catch(() => {});
    }
  });
})();
