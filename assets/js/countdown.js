/** Hitung mundur ke tanggal akad, update tiap detik. */
window.initCountdown = function () {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== value) el.textContent = value;
  }

  function tick() {
    const target = new Date(window.WEDDING_CONFIG.event.countdownTarget).getTime();
    let diff = Math.max(0, target - Date.now());

    const days = Math.floor(diff / 86400000);
    diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000);
    diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000);
    diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);

    setText("cd-days", pad(days));
    setText("cd-hours", pad(hours));
    setText("cd-minutes", pad(minutes));
    setText("cd-seconds", pad(seconds));
  }

  tick();
  setInterval(tick, 1000);
};
