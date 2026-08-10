/** Modern Minimal — complete JS behaviour override.
 *  Runs AFTER all default modules. Patches cover, reveal,
 *  slider, parallax. Returns cleanup.
 *
 *  SECTION ORDER: Classic DOM order preserved.
 *  cover → opening → we-found-love → couple → event →
 *  livestream → quote → love-story → gallery → gift → rsvp → closing
 */
return (function() {
  "use strict";

  /* ─── 1. INJECTED STYLES (track for cleanup) ─── */
  var injected = [];

  function injectStyle(id, css) {
    var el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
    injected.push(el);
    return el;
  }

  /* ─── 2. COVER: position fixed, slide LEFT exit ─── */
  injectStyle("mm-cover",
    "#cover { position: fixed !important; inset: 0; z-index: 100; }" +
    "#cover.cover-visible { transform: translateX(0); opacity: 1; }" +
    "#cover.is-exiting { transform: translateX(-105%) !important; opacity: 1; transition: transform 3s cubic-bezier(0.5,0,0.75,0); pointer-events: none; }" +
    "#invitation.is-locked .invitation-body { display: none; }" +
    /* Opening visible immediately behind cover.
       CATATAN: TIDAK ada rule !important untuk transform img opening — rule
       itu mematikan zoom reveal (scale 1.025→1, lihat CSS #opening.section-
       revealed) yang sekarang diatur murni dari stylesheet template. Ken
       Burns opening dimatikan lewat CSS #opening .hero-slide.active img. */
    "#opening { opacity: 1 !important; transform: none !important; }" +
    "#opening .hero-content { opacity: 1 !important; }"
  );

  /* Override setupOpenButton from main.js — slide left, opening reveal langsung */
  function patchOpenButton() {
    var btn = document.getElementById("btn-open");
    var invitation = document.getElementById("invitation");
    var cover = document.getElementById("cover");
    var opening = document.getElementById("opening");
    if (!btn || !cover) return;

    /* Remove existing listener by cloning */
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    btn = newBtn;

    /* stopImmediatePropagation: setupOpenButton() di main.js (~baris 412,
       file shared JANGAN diubah) ikut addEventListener ke tombol hasil clone
       ini, jadi ada 2 listener untuk 1 click. Listener ini terdaftar LEBIH
       DULU (template init), maka jalan pertama — hentikan sisanya agar audio
       tidak 2x, slideshow tidak 2x, dan transitionend tidak dobel. */
    btn.addEventListener("click", function(evt) {
      if (evt && evt.stopImmediatePropagation) evt.stopImmediatePropagation();
      invitation.classList.remove("is-locked");
      document.documentElement.classList.remove("no-scroll");
      window.__invitationOpen = true;
      (window.__openCallbacks || []).forEach(function(fn) { fn(); });
      window.__openCallbacks = [];
      if (window.playBackgroundAudio) window.playBackgroundAudio();

      /* Opening langsung tampil, animasi text-enter */
      if (opening) {
        opening.classList.add("section-revealed");
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            opening.classList.add("text-revealed");
          });
        });
        /* Queue opening slideshow */
        setTimeout(function() {
          if (window.startOpeningSlideshow) window.startOpeningSlideshow();
          else window.__openingStartQueued = true;
        }, 800);
      }

      /* Subcover: reveal langsung begitu undangan dibuka (kalau ada) */
      var subcoverSec = document.getElementById("subcover");
      if (subcoverSec && window.revealNow) window.revealNow(subcoverSec);

      /* Cover slide keluar kiri */
      cover.classList.add("is-exiting");
      cover.addEventListener("transitionend", function() {
        if (window.revealScan) window.revealScan();
      }, { once: true });
    });
  }

  /* ─── 2b. Restructure couple names jadi 2 baris ───
   *  MutationObserver dibutuhkan karena populateContent() di main.js
   *  (baris ~411) menimpa ulang innerHTML #couple-names-cover SETELAH
   *  template JS init — jadi restrukturisasi pertama selalu kalah.
   *  Observer memastikan SETIAP perubahan innerHTML langsung direspons,
   *  dengan guard .bride-line + disconnect/reconnect untuk cegah
   *  infinite loop. Scope HANYA #couple-names-cover. */
  var coupleNamesObserver = null;

  function restructureCoupleNames() {
    var el = document.getElementById("couple-names-cover");
    if (!el) return;
    /* Guard: sudah direstruktur */
    if (el.querySelector(".bride-line")) return;

    /* Parse DOM langsung — lebih robust daripada regex di innerHTML
       karena serialisasi &amp; bisa berbeda antar browser.
       Format A (dari fillCoupleNames main.js): textNode + <span class="amp">&</span> + textNode
       Format B (dari applyVisualEditorOverrides main.js — guest-overrides.js
       baris ~24 menimpa via el.textContent): teks POLOS tanpa span sama
       sekali, mis. "Mita & Iyow" — fallback split '&' jadi 2 bagian. */
    var ampSpan = el.querySelector("span.amp");
    var bride = "";
    var groom = "";

    if (ampSpan) {
      var foundAmp = false;
      var children = el.childNodes;
      for (var i = 0; i < children.length; i++) {
        var node = children[i];
        if (node === ampSpan) { foundAmp = true; continue; }
        if (node.nodeType === 3 /* TEXT_NODE */) {
          var text = node.textContent.trim();
          if (text) {
            if (!foundAmp) bride = text;
            else groom = text;
          }
        }
      }
    } else if (el.children.length === 0 && el.textContent.indexOf("&") !== -1) {
      /* Format B: murni text node tanpa child element. Split harus tepat
         2 bagian non-kosong — selain itu jangan diproses (guard). */
      var parts = el.textContent.split("&");
      if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
        bride = parts[0].trim();
        groom = parts[1].trim();
      }
    }

    if (!bride && !groom) return;

    /* Disconnect observer sebelum mengubah innerHTML agar tidak infinite loop */
    if (coupleNamesObserver) coupleNamesObserver.disconnect();
    el.innerHTML = '<span class="bride-line">' + bride + '</span><span class="amp-line">&amp; ' + groom + '</span>';
    /* Reconnect observer */
    if (coupleNamesObserver) coupleNamesObserver.observe(el, { childList: true });
  }

  function startObservingCoupleNames() {
    var el = document.getElementById("couple-names-cover");
    if (!el) return;
    if (coupleNamesObserver) coupleNamesObserver.disconnect();
    coupleNamesObserver = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList") {
          restructureCoupleNames();
          break;
        }
      }
    });
    coupleNamesObserver.observe(el, { childList: true });
  }

  function stopObservingCoupleNames() {
    if (coupleNamesObserver) {
      coupleNamesObserver.disconnect();
      coupleNamesObserver = null;
    }
  }

  /* ─── 3. PARALLAX 3D — scroll-depth berlapis (perspective + translateZ) ───
   *  Bukan sekadar geser 28px: wrapper diberi perspective, tiap layer gambar
   *  digeser dengan kecepatan berbeda (depth), sehingga scroll terasa punya
   *  kedalaman. Hanya 2-5 layer kunci (cover/opening/closing/quote) — tidak
   *  semua elemen. Hormati prefers-reduced-motion. */
  var parallaxRaf = null;
  var depthLayers = [];
  function registerParallaxLayers() {
    /* Foto slideshow di-inject ASYNC oleh hero-slideshow.js setelah payload
       Supabase termuat — jangan daftarkan layer sebelum gambar ada. */
    var layerDefs = [
      { sel: "#opening .hero-media img", speed: 0.22, z: 26 },
      { sel: "#closing .hero-media img", speed: 0.18, z: 18 },
      { sel: ".quote-section", speed: 0.10, z: 12 }
    ];
    depthLayers = [];
    layerDefs.forEach(function(def) {
      var els = document.querySelectorAll(def.sel);
      els.forEach(function(el) {
        if (el.classList.contains("parallax-layer")) return;
        el.classList.add("parallax-layer");
        el.style.willChange = "transform";
        el.style.backfaceVisibility = "hidden";
        depthLayers.push({ el: el, speed: def.speed, z: def.z });
      });
    });
  }

  function startParallax() {
    var scroller = document.querySelector(".app-frame__scroll");
    if (!scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* PERSPECTIVE DI SINI, BUKAN DI #invitation:
       perspective pada ancestor jadi containing block untuk descendant
       position:fixed. #cover pakai position:fixed — kalau perspective
       di #invitation (yang tinggi 10877px saat is-locked dilepas),
       #cover ikut membentang setinggi dokumen dan semua kontennya
       terlempar keluar viewport. .app-frame__scroll selalu 100dvh dan
       berisi semua parallax layer (img opening/closing/quote), jadi
       efek 3D tetap sama — hanya containing block #cover yang stabil. */
    var wrap = document.querySelector(".app-frame__scroll");
    if (wrap) {
      wrap.style.perspective = "420px";
      wrap.style.perspectiveOrigin = "50% 50%";
    }

    registerParallaxLayers();

    function tick() {
      var scrollTop = scroller.scrollTop;
      depthLayers.forEach(function(layer) {
        var section = layer.el.closest("section, .quote-section");
        if (!section) return;
        var rect = section.getBoundingClientRect();
        /* Animasikan hanya saat section di layar (plus sedikit buffer) */
        if (rect.bottom > -120 && rect.top < window.innerHeight + 120) {
          var progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
          if (progress < 0) progress = 0;
          if (progress > 1) progress = 1;
          /* Gerakan depth: makin cepat layer, makin besar jarak — tetap halus */
          var y = (progress - 0.5) * layer.speed * 220;
          layer.el.style.transform =
            "translate3d(0," + y.toFixed(1) + "px,0) translateZ(" + layer.z + "px)";
        }
      });
      parallaxRaf = requestAnimationFrame(tick);
    }
    parallaxRaf = requestAnimationFrame(tick);
  }

  /* ─── 4. REVEAL OVERRIDE — cinematic timing ─── */
  injectStyle("mm-reveal",
    /* Longer, more cinematic durations */
    ".reveal-ready [data-reveal] { transition-duration: 0.8s; }" +
    ".reveal-ready [data-reveal=\"enter-right\"], " +
    ".reveal-ready [data-reveal=\"enter-left\"] { transition-duration: 1.6s !important; }" +
    ".reveal-ready [data-reveal=\"tilt-left\"], " +
    ".reveal-ready [data-reveal=\"tilt-right\"] { transition-duration: 1.1s !important; }" +
    /* Gallery items: alternate slide-in from left/right */
    ".reveal-ready .gallery-item[data-reveal=\"slide-left\"] { transform: translateX(-30px); }" +
    ".reveal-ready .gallery-item[data-reveal=\"slide-right\"] { transform: translateX(30px); }" +
    ".reveal-ready .gallery-item[data-reveal=\"slide-left\"].is-revealed," +
    ".reveal-ready .gallery-item[data-reveal=\"slide-right\"].is-revealed { transform: translateX(0) !important; }" +
    /* Story items: more dramatic */
    ".reveal-ready .timeline-item[data-reveal=\"slide-left\"] { transform: translateX(-60px); }" +
    ".reveal-ready .timeline-item[data-reveal=\"slide-right\"] { transform: translateX(60px); }" +
    /* Event cards: slower rise */
    ".reveal-ready .event-card[data-reveal=\"tilt-left\"] { transform: translateY(36px) rotate(-1deg); }" +
    ".reveal-ready .event-card[data-reveal=\"tilt-right\"] { transform: translateY(36px) rotate(1deg); }"
  );

  /* ─── 5. SWIPER/SLIDER: fade effect, slower speed ─── */
  var swiperPatched = false;
  function patchSwipers() {
    if (swiperPatched) return;
    swiperPatched = true;
    try {
      document.querySelectorAll(".swiper").forEach(function(el) {
        if (!el.swiper) return;
        var s = el.swiper;
        /* Slower autoplay for all — 1 foto tampil penuh dulu */
        if (s.params.autoplay) {
          s.params.autoplay.delay = 7000;
          if (typeof s.autoplay !== "undefined" && s.autoplay.running) {
            s.autoplay.stop();
          }
        }
        s.params.speed = 1800;
        /* Fade transition for smoother look */
        s.params.effect = "fade";
        s.params.fadeEffect = { crossFade: true };
        if (s.params.autoplay && s.autoplay.start) {
          s.autoplay.start();
        }
      });
    } catch(e) { /* Swiper not ready, ignore */ }
  }

  /* ─── 6. COUNTDOWN: dihapus — glass panel grid 4 kolom sekarang
       sepenuhnya diatur stylesheet template (modern-minimal.css) ─── */

  /* ─── 7. MODAL: subtle slide-up ─── */
  injectStyle("mm-modal",
    ".modal:not([hidden]) .modal__panel {" +
    "  animation: mmModalIn 0.38s cubic-bezier(0.16,1,0.3,1);" +
    "}" +
    "@keyframes mmModalIn {" +
    "  from { transform: translateY(36px); opacity: 0; }" +
    "  to { transform: translateY(0); opacity: 1; }" +
    "}"
  );

  /* ─── 8. GALLERY: staggered reveal ─── */
  injectStyle("mm-gallery",
    ".reveal-ready .gallery-item[data-reveal] {" +
    "  transition-delay: calc(var(--reveal-i, 0) * 55ms + 0.15s);" +
    "}" +
    ".reveal-ready .gallery-item[data-reveal=\"pop\"] { transition-delay: calc(var(--reveal-i, 0) * 55ms + 0.1s); }"
  );

  /* ─── 9. COUPLE SLIDERS: ensure image visibility ─── */
  injectStyle("mm-couple",
    ".couple-slider .swiper-slide img { display: block; width: 100%; height: 100%; object-fit: cover; }"
  );

  /* ─── 10. SUbCOVER SLIDESHOW (self-contained) ───
     Foto section subcover dijalankan di sini, TIDAK lewat hero-slideshow.js
     (section ini baru; pola crossfade .active/.exiting + kenburns diambil
     dari CSS generik template, interval & durasi sama dengan hero lain).
     Folder "subcover" mungkin KOSONG — migration 0016 belum di-push atau
     admin belum upload. Kalau kosong, section tetap tampil (overlay + bg
     gelap #1a1816), itu normal, bukan bug. */
  function initSubcoverSlideshow(media) {
    if (!media || !window.getPhotos) return;
    window.getPhotos("subcover").then(function(slides) {
      if (!(slides && slides.length)) return;
      var overlay = media.querySelector(".hero-overlay");
      slides.forEach(function(slide, i) {
        var wrap = document.createElement("picture");
        wrap.className = "hero-slide" + (i === 0 ? " active" : "");
        var src = slide.path && !slide.webp ? window.photoUrl(slide.path) : (slide.webp || slide.jpg);
        var fx = slide.focalX != null ? slide.focalX : 50;
        var fy = slide.focalY != null ? slide.focalY : 50;
        var zoom = slide.zoom != null ? slide.zoom : 1;
        wrap.innerHTML =
          '<source srcset="' + src + '" type="image/webp">' +
          '<img class="kenburns" src="' + src + '" alt="" style="--fx:' + fx + '%; --fy:' + fy + '%; --zoom:' + zoom + '">';
        media.insertBefore(wrap, overlay);
      });
      var items = media.querySelectorAll(".hero-slide");
      if (items.length > 1) {
        var cfg = window.WEDDING_CONFIG || {};
        var interval = cfg.heroSlideInterval || 7000;
        var SLIDE_TRANSITION_MS = 1800;
        var index = 0;
        var awake = true;
        /* Pause saat di luar layar — section biasa yang di-scroll,
           jangan boros GPU di belakang layar. */
        if ("IntersectionObserver" in window) {
          awake = false;
          media.classList.add("hero-media--paused");
          new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
              awake = e.isIntersecting;
              media.classList.toggle("hero-media--paused", !awake);
            });
          }, { rootMargin: "25% 0px 25% 0px" }).observe(document.getElementById("subcover"));
        }
        function cycle() {
          if (!awake) { setTimeout(cycle, 1000); return; }
          var current = items[index];
          var next = items[(index + 1) % items.length];
          current.classList.remove("active");
          current.classList.add("exiting");
          next.classList.add("active");
          setTimeout(function() { current.classList.remove("exiting"); }, SLIDE_TRANSITION_MS);
          index = (index + 1) % items.length;
          setTimeout(cycle, interval + SLIDE_TRANSITION_MS);
        }
        setTimeout(cycle, interval);
      }
    });
  }

  /* ─── INIT ─── */
  function init() {
    /* NOTE: NO reorderSections() — classic DOM order is the canonical order.
       cover → opening → we-found-love → couple → event →
       livestream → quote → love-story → gallery → gift → rsvp → closing */

    /* Observer harus terpasang SEBELUM restructure pertama,
       karena populateContent() di main.js bisa saja sudah/sedang
       menimpa innerHTML tepat setelah init() selesai. */
    /* Monkey-patch window.getPhotos: cover cuma 1 foto (index 0).
       Harus dipasang SEBELUM initHeroSlideshows() di main.js (~baris 413)
       — hero-slideshow.js baca getPhotos('cover'), kalau cuma 1 slide
       logic cycle/swiper tidak jalan. Folder lain tidak terpengaruh. */
    if (window.getPhotos) {
      var _getPhotos = window.getPhotos;
      window.getPhotos = function(folder) {
        var p = _getPhotos(folder);
        if (folder === "cover") {
          return Promise.resolve(p).then(function(list) {
            return Array.isArray(list) ? list.slice(0, 1) : list;
          });
        }
        return p;
      };
    }

    /* Monkey-patch window.initWeFoundLove: slider Swiper section "We Found
       Love" diganti stacked-card carousel gaya CodePen — mekanisme murni
       DOM: pindahkan node (.appendChild/.prepend), CSS nth-child +
       transition yang menggeser tiap kartu, TANPA state/index manual.
       we-found-love.js (shared, template lain masih memakainya) TIDAK
       diubah. main.js memanggil window.initWeFoundLove SETELAH template
       init (baris ~420), jadi menimpa di sini memastikan yang jalan
       carousel ini — Swiper tidak pernah di-init untuk section ini. */
    var _origInitWeFoundLove = window.initWeFoundLove; /* disimpan, tidak dipanggil */
    window.initWeFoundLove = async function () {
      var wrapper = document.getElementById("wfl-slider-wrapper");
      if (!wrapper) return;
      var photos = (await window.getPhotos("wfl")) || [];
      if (!photos.length) return;

      wrapper.classList.add("mm-wfl-slide");
      var sliderRoot = document.querySelector(".wfl-slider");
      if (sliderRoot) sliderRoot.classList.add("mm-wfl-carousel");

      /* Kartu dari payload — bentuk objek SAMA dengan buildPhotoSlide
         (assets/js/photos.js): Supabase {path, focalX, focalY, zoom},
         manifest lokal {jpg, webp} tanpa focal (default 50/1). Pan/zoom
         admin dihormati via custom property --fx/--fy/--zoom, pola sama
         persis dengan hero-slideshow.js. */
      photos.forEach(function (item) {
        var el = document.createElement("div");
        el.className = "item mm-wfl-item";
        var fx = item.focalX ?? 50;
        var fy = item.focalY ?? 50;
        var zoom = item.zoom ?? 1;
        var src = item.path && !item.webp ? window.photoUrl(item.path) : item.webp || item.jpg;
        el.innerHTML =
          '<picture><source srcset="' + src + '" type="image/webp">' +
          '<img src="' + src + '" alt="" style="--fx:' + fx + '%;--fy:' + fy + '%;--zoom:' + zoom + '"></picture>';
        wrapper.appendChild(el);
      });

      /* Tombol ◁/▷ — belum ada di index.html (shared, tidak diubah),
         dibuat dari sini, disisipkan setelah .wfl-slider */
      var btnWrap = document.createElement("div");
      btnWrap.className = "mm-wfl-buttons";
      btnWrap.innerHTML =
        '<button type="button" class="mm-wfl-prev" aria-label="Foto sebelumnya">&#9665;</button>' +
        '<button type="button" class="mm-wfl-next" aria-label="Foto berikutnya">&#9655;</button>';
      sliderRoot.insertAdjacentElement("afterend", btnWrap);

      /* BUG FIX 2026-08-10: applyVisualEditorOverrides() (main.js, dipanggil
         di akhir populateContent(), JAUH sebelum initWeFoundLove ini bahkan
         dipanggil apalagi selesai — getPhotos di atas itu async) sudah lebih
         dulu jalan sebelum 2 tombol ◁/▷ di atas ada di DOM. Tombol ini
         punya teks (jadi ikut ter-auto-index registry Visual Editor,
         assets/js/visual-editor/registry.js men-scan #invitation button dkk)
         — begitu mereka baru muncul SETELAH override pertama diterapkan,
         index semua elemen SESUDAHNYA di DOM (mis. eyebrow "MOMENTS" di
         Galeri, nama "Mita & Andi" di footer closing) bergeser 2 dibanding
         saat admin mengatur override-nya di Visual Editor — override jadi
         salah sasaran/tidak berlaku sama sekali untuk elemen-elemen itu.
         Fix: terapkan ulang overrides SEKARANG, setelah DOM final (foto +
         tombol) benar-benar settle, supaya index-nya konsisten dengan yang
         dilihat admin. Idempoten — aman dipanggil dua kali. */
      if (window.applyVisualEditorOverrides) window.applyVisualEditorOverrides(window.WEDDING_CONFIG);

      function next() {
        var items = wrapper.querySelectorAll(".item");
        if (items.length) wrapper.appendChild(items[0]);
      }
      function prev() {
        var items = wrapper.querySelectorAll(".item");
        if (items.length) wrapper.prepend(items[items.length - 1]);
      }

      /* Auto-advance: section ini didesain "mengalir terus tanpa disentuh"
         — dipertahankan (reuse next() yang sama persis dengan tombol),
         tapi cuma jalan saat section KELIHATAN di layar (Intersection-
         Observer) dan berhenti kalau pointer di atas slider (pause hover,
         biar tidak berebut waktu tamu lagi lihat-lihat). */
      var autoTimer = null;
      var AUTO_MS = 3200;
      function startAutoAdvance() {
        stopAutoAdvance();
        autoTimer = setInterval(next, AUTO_MS);
      }
      function stopAutoAdvance() {
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = null;
      }
      function resetAutoAdvance() { startAutoAdvance(); }

      if (photos.length > 1) {
        if ("IntersectionObserver" in window) {
          new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
              if (e.isIntersecting) startAutoAdvance(); else stopAutoAdvance();
            });
          }, { threshold: 0.3 }).observe(document.getElementById("we-found-love"));
        } else {
          startAutoAdvance();
        }
        sliderRoot.addEventListener("mouseenter", stopAutoAdvance);
        sliderRoot.addEventListener("mouseleave", startAutoAdvance);
      }

      btnWrap.querySelector(".mm-wfl-next").addEventListener("click", function () {
        next(); resetAutoAdvance();
      });
      btnWrap.querySelector(".mm-wfl-prev").addEventListener("click", function () {
        prev(); resetAutoAdvance();
      });
    };

    /* Cover eyebrow: index.html (shared) hardcode "The Wedding Of" (O
       besar). Teks TIDAK bisa diubah di sana → override via JS, pola sama
       seperti restructureCoupleNames. populateContent() di main.js hanya
       menulis #couple-names-cover (bukan eyebrow), jadi sekali cukup. */
    var coverEyebrow = document.querySelector("#cover .eyebrow");
    if (coverEyebrow && coverEyebrow.textContent !== "The Wedding of") {
      coverEyebrow.textContent = "The Wedding of";
    }

    startObservingCoupleNames();
    restructureCoupleNames();
    /* Safety net: populateContent() di main.js (baris ~411) jalan
       SETELAH template init, jadi restructure pertama selalu ditimpa.
       Observer menangani kasus itu, tapi setTimeout ini jaga-jaga
       kalau ada penimpa lain setelah observer (misal VE override). */
    setTimeout(restructureCoupleNames, 200);
    setTimeout(restructureCoupleNames, 600);

    /* ─── OPENING REDESIGN — DOM surgery (pola restructureCoupleNames):
       (1) bungkus .countdown-heading + #btn-add-calendar dalam
           <div class="mm-opening-content"> — zona tengah ~44-66% viewport;
       (2) sisipkan divider dekoratif .mm-divider (garis-diamond-garis)
           antara .eyebrow dan .script-names--small di dalam heading.
       Elemen-elemen ini statis dari index.html (populateContent hanya
       mengisi innerHTML #couple-names-opening, bukan heading/content),
       jadi cukup dijalankan sekali. index.html TIDAK diubah. */
    var openingHero = document.querySelector("#opening .hero-content");
    var openingHeading = document.querySelector("#opening .countdown-heading");
    var openingCalBtn = document.getElementById("btn-add-calendar");
    if (openingHero && openingHeading && openingCalBtn &&
        !openingHero.querySelector(".mm-opening-content")) {
      var mmWrap = document.createElement("div");
      mmWrap.className = "mm-opening-content";
      openingHero.insertBefore(mmWrap, openingHeading);
      mmWrap.appendChild(openingHeading);
      mmWrap.appendChild(openingCalBtn);

      var openingEyebrow = openingHeading.querySelector(".eyebrow");
      var openingNames = openingHeading.querySelector(".script-names--small");
      if (openingEyebrow && openingNames &&
          !openingHeading.querySelector(".mm-divider")) {
        var mmDivider = document.createElement("div");
        mmDivider.className = "mm-divider";
        var mmLineA = document.createElement("span");
        mmLineA.className = "mm-divider__line";
        var mmDiamond = document.createElement("span");
        mmDiamond.className = "mm-divider__diamond";
        var mmLineB = document.createElement("span");
        mmLineB.className = "mm-divider__line";
        mmDivider.appendChild(mmLineA);
        mmDivider.appendChild(mmDiamond);
        mmDivider.appendChild(mmLineB);
        openingHeading.insertBefore(mmDivider, openingNames);
      }
    }

    /* ─── SUbCOVER SECTION — DOM surgery (pola restructureCoupleNames):
       Section quotes layar penuh BARU antara cover dan Save The Date.
       index.html TIDAK diubah — semua elemen dibuat dari sini.
       Toggle tampil/mati lewat content.subcover.enabled (admin, tab Teks):
       kalau mati, section TIDAK dibuat sama sekali (bukan dibuat lalu
       disembunyikan). Foldernya TERSENDIRI ("subcover") — TIDAK memakai
       folder "opening", dan jangan sentuh content.opening.quote (itu
       punya We Found Love). */
    var subcoverCfg = (window.WEDDING_CONFIG && window.WEDDING_CONFIG.subcover) || {};
    if (subcoverCfg.enabled !== false) {
      var openingSec = document.getElementById("opening");
      if (openingSec && openingSec.parentNode && !document.getElementById("subcover")) {
        var subSec = document.createElement("section");
        subSec.id = "subcover";
        subSec.className = "section-hero";

        var subMedia = document.createElement("div");
        subMedia.className = "hero-media";
        subMedia.id = "subcover-media";
        var subOverlay = document.createElement("div");
        subOverlay.className = "hero-overlay hero-overlay--flat";
        subMedia.appendChild(subOverlay);
        subSec.appendChild(subMedia);

        var subQuote = document.createElement("div");
        subQuote.className = "mm-subcover-quote";
        var subQ1 = document.createElement("p");
        subQ1.setAttribute("data-reveal", "up");
        subQ1.textContent = subcoverCfg.quoteLine1 || "";
        var subQ2 = document.createElement("p");
        subQ2.setAttribute("data-reveal", "up");
        subQ2.textContent = subcoverCfg.quoteLine2 || "";
        subQuote.appendChild(subQ1);
        subQuote.appendChild(subQ2);
        subSec.appendChild(subQuote);

        var subNames = document.createElement("div");
        subNames.className = "mm-subcover-names";
        var subN0 = document.createElement("p");
        subN0.setAttribute("data-reveal", "up");
        subN0.textContent = "The Wedding of";
        var coupleCfg = (window.WEDDING_CONFIG && window.WEDDING_CONFIG.couple) || {};
        var subN1 = document.createElement("p");
        subN1.setAttribute("data-reveal", "up");
        subN1.textContent = (coupleCfg.bride && coupleCfg.bride.nickname) || "";
        var subN2 = document.createElement("p");
        subN2.setAttribute("data-reveal", "up");
        var subAnd = document.createElement("span");
        subAnd.className = "mm-subcover-and";
        subAnd.textContent = "and";
        subN2.appendChild(subAnd);
        subN2.appendChild(document.createTextNode(" " + ((coupleCfg.groom && coupleCfg.groom.nickname) || "")));
        subNames.appendChild(subN0);
        subNames.appendChild(subN1);
        subNames.appendChild(subN2);
        subSec.appendChild(subNames);

        openingSec.parentNode.insertBefore(subSec, openingSec);

        /* Slideshow subcover — self-contained (lihat blok 10). Folder
           mungkin kosong → hanya overlay + bg gelap, itu normal. */
        initSubcoverSlideshow(subMedia);
      }
    }

    patchOpenButton();
    startParallax();

    /* Foto hero di-inject async setelah payload Supabase; daftarkan ulang
       layer parallax begitu undangan dibuka (foto sudah pasti ada).
       __openCallbacks mungkin belum dibuat main.js saat template init —
       jangan asumsi, buat array dulu kalau belum ada. */
    if (!window.__openCallbacks) window.__openCallbacks = [];
    window.__openCallbacks.push(function() {
      setTimeout(function() {
        registerParallaxLayers();
        setTimeout(patchSwipers, 400);
      }, 600);
    });

    /* Also try patching after DOM settles */
    setTimeout(patchSwipers, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ─── CLEANUP ─── */
  return function cleanup() {
    if (parallaxRaf) cancelAnimationFrame(parallaxRaf);
    stopObservingCoupleNames();
    /* Remove injected styles */
    injected.forEach(function(el) {
      if (el && el.parentNode) el.remove();
    });
    /* Reset parallax images + perspective wrapper */
    document.querySelectorAll(".parallax-layer").forEach(function(img) {
      img.style.transform = "";
      img.style.transition = "";
      img.style.willChange = "";
      img.style.backfaceVisibility = "";
      img.classList.remove("parallax-layer");
    });
    var wrap = document.querySelector(".app-frame__scroll");
    if (wrap) {
      wrap.style.perspective = "";
      wrap.style.perspectiveOrigin = "";
    }
    depthLayers = [];
  };
})();
