/** QR code untuk berbagi tautan + unduh section cover sebagai gambar. */
window.initShare = function () {
  const qrContainer = document.getElementById("qr-container");
  const copyBtn = document.getElementById("btn-copy-link");
  const downloadBtn = document.getElementById("btn-download-card");
  const url = location.href.split("#")[0];

  if (qrContainer && window.QRCode) {
    const canvas = document.createElement("canvas");
    qrContainer.appendChild(canvas);
    QRCode.toCanvas(canvas, url, {
      width: 160,
      margin: 1,
      color: { dark: "#14120f", light: "#ffffff" }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(url).then(() => window.showToast && window.showToast("Tautan disalin"));
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      if (!window.html2canvas) return;
      const cover = document.getElementById("cover");
      downloadBtn.disabled = true;
      const originalLabel = downloadBtn.textContent;
      downloadBtn.textContent = "Memproses...";
      try {
        const canvas = await html2canvas(cover, { useCORS: true, scale: 2 });
        const link = document.createElement("a");
        link.download = "undangan-mita-andi.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      } catch (err) {
        console.error(err);
        window.showToast && window.showToast("Gagal mengunduh gambar");
      }
      downloadBtn.disabled = false;
      downloadBtn.textContent = originalLabel;
    });
  }
};
