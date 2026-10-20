/**
 * Renderer Template Senja Golden Hour
 * Template ID: senja
 */
(function () {
  "use strict";

  window.WeddingTemplates = window.WeddingTemplates || {};

  let activeCleanup = [];

  function safeText(el, text) {
    if (el && typeof text === "string" && text.trim()) {
      el.textContent = text;
    }
  }

  function resolveFirstPhoto(photos) {
    if (!photos) return null;
    if (Array.isArray(photos)) return photos[0] || null;
    return photos;
  }

  function getPhotoSrc(photo) {
    if (!photo) return "";
    if (typeof photo === "string") return photo;
    if (photo.url) return photo.url;
    if (photo.path) {
      if (typeof window.photoUrl === "function") return window.photoUrl(photo.path);
      return photo.path;
    }
    return "";
  }

  window.WeddingTemplates["senja"] = {
    async render(ctx) {
      const root = ctx.mount || document.getElementById("inv-root") || document;
      const data = ctx.data || window.WEDDING_CONFIG || {};
      const tpl = ctx.tpl || {};
      const guest = ctx.guest || (window.WeddingCore && window.WeddingCore.buildGuest ? window.WeddingCore.buildGuest(data) : { name: "Tamu Undangan", greeting: "Kepada Yth. Bapak/Ibu/Saudara/i:" });
      const getPhotos = typeof ctx.photos === "function" ? ctx.photos : (slot => (window.WeddingPhotos && window.WeddingPhotos.forSlot ? window.WeddingPhotos.forSlot(slot, {}) : []));
      const panStyle = typeof ctx.panStyle === "function" ? ctx.panStyle : (photo => (window.WeddingPhotos && window.WeddingPhotos.panStyle ? window.WeddingPhotos.panStyle(photo) : ""));

      // 1. Data Mempelai
      const bride = (data.couple && data.couple.bride) || {};
      const groom = (data.couple && data.couple.groom) || {};
      const brideNick = bride.nickname || bride.name || "Fitri";
      const groomNick = groom.nickname || groom.name || "Andi";
      const brideFull = bride.name || brideNick;
      const groomFull = groom.name || groomNick;
      const coupleNames = brideNick + " & " + groomNick;

      // Cover & Headings
      safeText(root.querySelector("#couple-names-cover"), coupleNames);
      safeText(root.querySelector("#couple-names-opening"), coupleNames);
      safeText(root.querySelector("#couple-names-closing"), coupleNames);

      // Subtitle khas Senja
      const senjaSub = (tpl.extras && tpl.extras.senjaSubtitle) || (data.extras && data.extras.senjaSubtitle) || "Matahari Terbenam, Awal Bahagia Selamanya";
      safeText(root.querySelector("#cover-senja-subtitle"), senjaSub);

      // Sapaan Tamu
      safeText(root.querySelector("#guest-label"), guest.greeting || "Kepada Yth. Bapak/Ibu/Saudara/i:");
      safeText(root.querySelector("#guest-name"), guest.name || "Tamu Undangan");

      // Detail Mempelai Wanita
      safeText(root.querySelector("#bride-name"), brideFull);
      const brideParentsText = (bride.father || bride.mother)
        ? ("Putri tercinta dari Bpk. " + (bride.father || "—") + " & Ibu " + (bride.mother || "—"))
        : "Putri tercinta dari keluarga";
      safeText(root.querySelector("#bride-parents"), brideParentsText);

      const brideIgEl = root.querySelector("#bride-ig");
      if (brideIgEl) {
        if (bride.instagram) {
          const igClean = bride.instagram.replace(/^@/, "");
          brideIgEl.href = "https://instagram.com/" + encodeURIComponent(igClean);
          safeText(brideIgEl.querySelector("span"), "@" + igClean);
        } else {
          brideIgEl.hidden = true;
        }
      }

      // Detail Mempelai Pria
      safeText(root.querySelector("#groom-name"), groomFull);
      const groomParentsText = (groom.father || groom.mother)
        ? ("Putra tercinta dari Bpk. " + (groom.father || "—") + " & Ibu " + (groom.mother || "—"))
        : "Putra tercinta dari keluarga";
      safeText(root.querySelector("#groom-parents"), groomParentsText);

      const groomIgEl = root.querySelector("#groom-ig");
      if (groomIgEl) {
        if (groom.instagram) {
          const igClean = groom.instagram.replace(/^@/, "");
          groomIgEl.href = "https://instagram.com/" + encodeURIComponent(igClean);
          safeText(groomIgEl.querySelector("span"), "@" + igClean);
        } else {
          groomIgEl.hidden = true;
        }
      }

      // 2. Acara & Tanggal
      const event = data.event || {};
      const dateLabel = event.dateLabel || "Sabtu, 25 Agustus 2026";
      safeText(root.querySelector("#event-date-label"), dateLabel);
      safeText(root.querySelector(".event-date-highlight"), dateLabel);

      // Countdown target
      const cdTarget = event.countdownTarget || event.dateISO;
      if (cdTarget) {
        root.querySelectorAll(".countdown-container, .countdown-grid").forEach(el => {
          el.dataset.countdownTarget = cdTarget;
        });
      }

      // Google Calendar Button
      const btnCal = root.querySelector("#btn-add-calendar");
      if (btnCal) {
        try {
          if (ctx.fmt && typeof ctx.fmt.calendarUrl === "function") {
            btnCal.href = ctx.fmt.calendarUrl(data) || "#";
          } else if (window.WeddingCore && window.WeddingCore.fmt && typeof window.WeddingCore.fmt.calendarUrl === "function") {
            btnCal.href = window.WeddingCore.fmt.calendarUrl(data) || "#";
          } else {
            btnCal.href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Pernikahan " + coupleNames);
          }
        } catch (e) {
          btnCal.href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent("Pernikahan " + coupleNames);
        }
      }

      // Akad
      const akad = event.akad || {};
      safeText(root.querySelector(".event-card--akad .event-block__title"), akad.label || "Akad Nikah");
      if (akad.start) {
        const akadTime = akad.start + (akad.end ? " - " + akad.end + " WIB" : " WIB");
        safeText(root.querySelector("#event-time-akad"), akadTime);
      }
      safeText(root.querySelector("#venue-name-akad"), (akad.venue && akad.venue.name) || "Tempat Akad");
      safeText(root.querySelector("#venue-address-akad"), (akad.venue && akad.venue.address) || "");
      const akadMaps = root.querySelector("#akad-maps");
      if (akadMaps) {
        if (akad.venue && akad.venue.mapsUrl) {
          akadMaps.href = akad.venue.mapsUrl;
        } else {
          akadMaps.hidden = true;
        }
      }

      // Resepsi
      const resepsi = event.resepsi || {};
      safeText(root.querySelector(".event-card--resepsi .event-block__title"), resepsi.label || "Resepsi Pernikahan");
      if (resepsi.start) {
        const resepsiTime = resepsi.start + (resepsi.end ? " - " + resepsi.end + " WIB" : " WIB");
        safeText(root.querySelector("#event-time-resepsi"), resepsiTime);
      }
      safeText(root.querySelector("#venue-name-resepsi"), (resepsi.venue && resepsi.venue.name) || "Tempat Resepsi");
      safeText(root.querySelector("#venue-address-resepsi"), (resepsi.venue && resepsi.venue.address) || "");
      const resepsiMaps = root.querySelector("#resepsi-maps");
      if (resepsiMaps) {
        if (resepsi.venue && resepsi.venue.mapsUrl) {
          resepsiMaps.href = resepsi.venue.mapsUrl;
        } else {
          resepsiMaps.hidden = true;
        }
      }

      // Dresscode
      const dresscode = data.dresscode || {};
      const dresscodeBlock = root.querySelector("#dresscode-block");
      if (dresscodeBlock) {
        if (dresscode.text && dresscode.text.trim()) {
          safeText(dresscodeBlock.querySelector(".dresscode-text"), dresscode.text);
          const paletteContainer = dresscodeBlock.querySelector("#dresscode-palette");
          if (paletteContainer && Array.isArray(dresscode.colors) && dresscode.colors.length) {
            paletteContainer.innerHTML = dresscode.colors.map(col =>
              '<span class="dresscode-swatch" style="background-color:' + (ctx.esc ? ctx.esc(col) : col) + '"></span>'
            ).join("");
          }
        } else {
          dresscodeBlock.hidden = true;
        }
      }

      // Ayat Pembuka
      const opening = data.opening || {};
      const quoteBox = root.querySelector(".opening-quote-box");
      if (quoteBox) {
        if (opening.quote && opening.quote.trim()) {
          safeText(root.querySelector("#wfl-arabic"), opening.arabicQuote || "");
          safeText(root.querySelector("#wfl-quote"), opening.quote);
          safeText(root.querySelector("#wfl-source"), opening.source || "");
        } else {
          quoteBox.hidden = true;
        }
      }

      // 3. Foto-foto
      // Cover Photo
      const coverPhotos = getPhotos("cover");
      const coverPhoto = resolveFirstPhoto(coverPhotos);
      const coverImg = root.querySelector("#senja-cover-photo");
      if (coverImg && coverPhoto) {
        coverImg.src = getPhotoSrc(coverPhoto);
        if (coverPhoto.alt) coverImg.alt = coverPhoto.alt;
        const pan = panStyle(coverPhoto);
        if (pan) coverImg.style.objectPosition = pan;
      }

      // Opening Photo
      const openingPhotos = getPhotos("opening");
      const std2Photos = getPhotos("std2");
      const openingPhoto = resolveFirstPhoto(openingPhotos) || resolveFirstPhoto(std2Photos) || coverPhoto;
      const openingImg = root.querySelector("#senja-opening-photo");
      if (openingImg && openingPhoto) {
        openingImg.src = getPhotoSrc(openingPhoto);
        if (openingPhoto.alt) openingImg.alt = openingPhoto.alt;
        const pan = panStyle(openingPhoto);
        if (pan) openingImg.style.objectPosition = pan;
      }

      // Bride & Groom Photos
      const bridePhoto = resolveFirstPhoto(getPhotos("bride"));
      const brideImg = root.querySelector("#bride-photo-slot");
      if (brideImg && bridePhoto) {
        brideImg.src = getPhotoSrc(bridePhoto);
        if (bridePhoto.alt) brideImg.alt = bridePhoto.alt;
        const pan = panStyle(bridePhoto);
        if (pan) brideImg.style.objectPosition = pan;
      }

      const groomPhoto = resolveFirstPhoto(getPhotos("groom"));
      const groomImg = root.querySelector("#groom-photo-slot");
      if (groomImg && groomPhoto) {
        groomImg.src = getPhotoSrc(groomPhoto);
        if (groomPhoto.alt) groomImg.alt = groomPhoto.alt;
        const pan = panStyle(groomPhoto);
        if (pan) groomImg.style.objectPosition = pan;
      }

      // Event Photo
      const eventPhoto = resolveFirstPhoto(getPhotos("event"));
      const eventImg = root.querySelector("#event-hero-img");
      if (eventImg) {
        if (eventPhoto) {
          eventImg.src = getPhotoSrc(eventPhoto);
          if (eventPhoto.alt) eventImg.alt = eventPhoto.alt;
          const pan = panStyle(eventPhoto);
          if (pan) eventImg.style.objectPosition = pan;
        } else {
          const heroWrap = root.querySelector(".event-hero-photo");
          if (heroWrap) heroWrap.hidden = true;
        }
      }

      // Love Story
      const loveStory = data.loveStory || [];
      const storySec = root.querySelector("#love-story");
      const storyList = root.querySelector("#love-story-list");
      if (storySec && storyList) {
        if (Array.isArray(loveStory) && loveStory.length) {
          const esc = ctx.esc || (s => String(s || ""));
          storyList.innerHTML = loveStory.map(item =>
            '<div class="story-item" data-reveal="up">' +
              (item.date ? '<div class="story-item__date">' + esc(item.date) + '</div>' : '') +
              (item.title ? '<h4 class="story-item__title">' + esc(item.title) + '</h4>' : '') +
              (item.text ? '<p class="story-item__text">' + esc(item.text) + '</p>' : '') +
            '</div>'
          ).join("");
        } else {
          storySec.hidden = true;
        }
      }

      // Galeri Foto
      const galleryPhotos = getPhotos("gallery");
      const gallerySec = root.querySelector("#gallery");
      const galleryWrap = root.querySelector("#gallery-wrapper");
      if (gallerySec && galleryWrap) {
        if (Array.isArray(galleryPhotos) && galleryPhotos.length) {
          const esc = ctx.esc || (s => String(s || ""));
          galleryWrap.innerHTML = galleryPhotos.map((photo, i) => {
            const src = getPhotoSrc(photo);
            const alt = photo.alt ? esc(photo.alt) : "Foto Galeri " + (i + 1);
            return '<div class="gallery-item" data-full="' + src + '">' +
              '<img src="' + src + '" alt="' + alt + '" loading="lazy" decoding="async">' +
            '</div>';
          }).join("");

          // Pasang handler lightbox galeri
          const lightbox = root.querySelector("#lightbox");
          const lightboxImg = root.querySelector("#lightbox-img");
          const lightboxClose = root.querySelector("#lightbox-close");

          if (lightbox && lightboxImg) {
            const onThumbClick = function (e) {
              const item = e.target.closest(".gallery-item");
              if (!item) return;
              const fullSrc = item.dataset.full || (item.querySelector("img") && item.querySelector("img").src);
              if (fullSrc) {
                lightboxImg.src = fullSrc;
                lightbox.hidden = false;
              }
            };

            const onCloseClick = function () {
              lightbox.hidden = true;
              lightboxImg.src = "";
            };

            galleryWrap.addEventListener("click", onThumbClick);
            activeCleanup.push(() => galleryWrap.removeEventListener("click", onThumbClick));

            if (lightboxClose) {
              lightboxClose.addEventListener("click", onCloseClick);
              activeCleanup.push(() => lightboxClose.removeEventListener("click", onCloseClick));
            }

            lightbox.addEventListener("click", function (e) {
              if (e.target === lightbox) onCloseClick();
            });
          }
        } else {
          gallerySec.hidden = true;
        }
      }

      // Quote Photo
      const quotePhotos = getPhotos("quote");
      const quotePhoto = resolveFirstPhoto(quotePhotos);
      const quoteCard = root.querySelector("#quote-photo-card");
      if (quoteCard) {
        const quoteText = (data.quotePhoto && data.quotePhoto.quote) || "";
        if (quotePhoto || quoteText) {
          const quoteImg = root.querySelector("#quote-photo-img");
          if (quoteImg && quotePhoto) {
            quoteImg.src = getPhotoSrc(quotePhoto);
            if (quotePhoto.alt) quoteImg.alt = quotePhoto.alt;
          }
          safeText(root.querySelector(".quote-photo__text"), quoteText);
        } else {
          quoteCard.hidden = true;
        }
      }

      // Closing Text
      const closing = data.closing || {};
      if (closing.text) {
        let txt = closing.text;
        txt = txt.replace(/\$\{tamu\}/g, guest.name || "Tamu Undangan");
        txt = txt.replace(/\$\{CPP\}/g, groomNick);
        txt = txt.replace(/\$\{CPW\}/g, brideNick);
        safeText(root.querySelector("#closing-text"), txt);
      }

      // 4. Perilaku Buka Undangan (#btn-open)
      const btnOpen = root.querySelector("#btn-open");
      const invitation = root.querySelector("#invitation");

      if (btnOpen && invitation) {
        const handleOpen = function () {
          invitation.classList.remove("is-locked");
          document.documentElement.classList.remove("no-scroll");

          // Jalankan pemutar audio
          if (typeof window.playBackgroundAudio === "function") {
            try { window.playBackgroundAudio(); } catch (e) {}
          }

          // Callback buka
          if (Array.isArray(window.__openCallbacks)) {
            window.__openCallbacks.forEach(fn => {
              try { fn(); } catch (e) {}
            });
          }

          // Refresh modul reveal & motion
          if (typeof window.revealScan === "function") {
            window.revealScan(root);
          }
          if (window.MotionScrollScene && typeof window.MotionScrollScene.update === "function") {
            window.MotionScrollScene.update();
          }

          // Gulir halus ke adegan pembuka
          const openingSec = root.querySelector("#opening");
          if (openingSec) {
            openingSec.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        };

        btnOpen.addEventListener("click", handleOpen);
        activeCleanup.push(() => btnOpen.removeEventListener("click", handleOpen));
      }

      // 5. Inisialisasi Modul Bersama
      if (typeof window.initCountdown === "function") {
        try { window.initCountdown(); } catch (e) {}
      }
      if (typeof window.initAudioPlayer === "function") {
        try { window.initAudioPlayer(); } catch (e) {}
      }
      if (typeof window.initGift === "function") {
        try { window.initGift(); } catch (e) {}
      }
      if (typeof window.initRsvp === "function") {
        try { window.initRsvp(); } catch (e) {}
      }
      if (typeof window.initLivestream === "function") {
        try { window.initLivestream(); } catch (e) {}
      }
      if (typeof window.initNavMenu === "function") {
        try { window.initNavMenu(); } catch (e) {}
      }
      if (typeof window.initQrCheckin === "function") {
        try { window.initQrCheckin(); } catch (e) {}
      }

      // Wajib panggil initReveal() untuk memenuhi kontrak test
      if (typeof window.initReveal === "function") {
        window.initReveal();
      }

      // Motion Toolkit Init
      if (window.MotionScrollScene && typeof window.MotionScrollScene.init === "function") {
        window.MotionScrollScene.init(root);
      }
      if (window.MotionTilt && typeof window.MotionTilt.init === "function") {
        window.MotionTilt.init(root);
      }
      if (window.MotionCounter && typeof window.MotionCounter.init === "function") {
        window.MotionCounter.init(root);
      }
      if (window.MotionSplitText && typeof window.MotionSplitText.init === "function") {
        window.MotionSplitText.init(root);
      }

      // Visual Editor Overrides
      if (typeof window.applyVisualEditorOverrides === "function") {
        try { window.applyVisualEditorOverrides(); } catch (e) {}
      }
    },

    destroy() {
      activeCleanup.forEach(fn => {
        try { fn(); } catch (e) {}
      });
      activeCleanup = [];
    }
  };
})();
