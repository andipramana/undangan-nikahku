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

  window.playBackgroundAudio = play;
};
