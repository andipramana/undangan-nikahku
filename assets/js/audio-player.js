/** Floating background-music player. Play dipicu oleh gesture user (tombol Buka Undangan / FAB). */
window.initAudioPlayer = function () {
  const audio = document.getElementById("bg-audio");
  const btn = document.getElementById("audio-toggle");
  const icon = document.getElementById("audio-toggle-icon");
  if (!audio || !btn) return;

  const audioConfig = window.WEDDING_CONFIG.audio || {};
  // Audio (>200 KB) JANGAN dimuat saat boot: pasang preload="none" dan baru isi
  // audio.src saat tamu benar-benar membuka undangan / menekan play.
  audio.preload = "none";
  const resolvedSrc = audioConfig.path && window.audioUrl
    ? window.audioUrl(audioConfig.path)
    : audioConfig.src || "";
  audio.volume = 0.6;

  function ensureSrc() {
    if (!audio.getAttribute("src") && resolvedSrc) {
      audio.src = resolvedSrc;
    }
  }

  /* Icon fa-play/fa-pause mengikuti status sebenarnya (bukan cuma niat
     play()/pause()) — supaya kalau autoplay diblokir browser, icon tetap
     nunjukin "play" (belum benar-benar jalan), bukan telanjur "pause". */
  function syncIcon() {
    if (!icon) return;
    icon.classList.toggle("fa-play", audio.paused);
    icon.classList.toggle("fa-pause", !audio.paused);
  }

  function play() {
    ensureSrc();
    audio
      .play()
      .then(() => {
        btn.classList.add("playing");
        syncIcon();
      })
      .catch(() => {
        /* autoplay diblokir browser — user bisa tap tombol FAB */
      });
  }

  function pause() {
    audio.pause();
    btn.classList.remove("playing");
    syncIcon();
  }

  btn.addEventListener("click", () => {
    if (audio.paused) play();
    else pause();
  });

  // Musik berhenti saat tab ditinggalkan / aplikasi di-minimize, lalu jalan lagi
  // saat dibuka kembali.
  //
  // Penandanya penting: HANYA yang kita hentikan sendiri yang boleh dijalankan
  // lagi. Kalau tamu sengaja mematikan musik lewat tombol FAB lalu berpindah tab,
  // musiknya tidak boleh menyala sendiri begitu ia kembali — itu melawan
  // pilihannya. Begitu juga kalau undangan belum dibuka sama sekali: audio memang
  // masih diam, jadi penanda ini tidak pernah aktif dan tidak ada musik yang
  // menyala tanpa disentuh lebih dulu (browser pun memblokirnya).
  //
  // Dipakai visibilitychange, bukan window.blur — blur ikut menyala saat tamu
  // sekadar mengklik jendela lain di sebelah, padahal undangannya masih terlihat.
  let pausedByVisibility = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (!audio.paused) {
        pausedByVisibility = true;
        pause();
      }
    } else if (pausedByVisibility) {
      pausedByVisibility = false;
      play();
    }
  });

  window.playBackgroundAudio = play;

  // Tombol musik baru muncul setelah amplop dibuka — sebelum itu audio memang
  // belum bisa autoplay (diblokir browser) jadi tombolnya tidak ada gunanya
  // terlihat lebih dulu.
  window.whenInvitationOpen(() => { btn.hidden = false; });
};
