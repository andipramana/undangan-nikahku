/** Floating background-music player. Play dipicu oleh gesture user (tombol Buka Undangan / FAB). */
window.initAudioPlayer = function () {
  const audio = document.getElementById("bg-audio");
  const btn = document.getElementById("audio-toggle");
  if (!audio || !btn) return;

  audio.src = window.WEDDING_CONFIG.audio.src;
  audio.volume = 0.6;

  function play() {
    audio
      .play()
      .then(() => btn.classList.add("playing"))
      .catch(() => {
        /* autoplay diblokir browser — user bisa tap tombol FAB */
      });
  }

  function pause() {
    audio.pause();
    btn.classList.remove("playing");
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
};
