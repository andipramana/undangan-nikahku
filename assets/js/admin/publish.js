/** Pita status Publish di topbar admin — selalu terlihat lintas tab.
 *
 * Perubahan admin (site_content/photos) TIDAK langsung tampil ke tamu:
 * get_invitation() guest membaca kolom invitations.published_content/
 * published_photos yang dibekukan, bukan data live. "Dirty" dideteksi
 * di DB (trigger membumping invitations.content_updated_at tiap
 * site_content/photos berubah — lihat migration 0020) supaya tidak perlu
 * hook di tiap file tab (content.js/theme.js/fonts.js/template.js/
 * visual-editor.js/photos.js semuanya upsert langsung, tanpa helper
 * bersama).
 */
(function () {
  "use strict";

  let banner, statusText, btn;

  function fmtTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  async function refreshStatus() {
    const api = window.AdminAPI;
    if (!api || !api.tenant || !api.tenant.invitationId || !banner) return;
    const { data, error } = await api.query(
      api.sb.from("invitations").select("content_updated_at, published_at").eq("id", api.tenant.invitationId).single(),
      "Status publikasi"
    );
    if (error || !data) return;

    const dirty = !data.published_at || new Date(data.content_updated_at) > new Date(data.published_at);
    banner.hidden = !dirty;
    statusText.textContent = dirty
      ? "Ada perubahan belum dipublikasikan."
      : `Dipublikasikan ${fmtTime(data.published_at)}.`;
  }

  async function publishNow() {
    const api = window.AdminAPI;
    if (!api || !api.tenant || !api.tenant.invitationId) return;
    btn.disabled = true;
    try {
      const { error } = await api.query(
        api.sb.rpc("publish_invitation", { p_invitation_id: api.tenant.invitationId }),
        "Publikasi"
      );
      if (error) throw error;
      api.toast("Berhasil dipublikasikan.");
      await refreshStatus();
    } catch (err) {
      api.toast("Gagal publikasi: " + (err && err.message ? err.message : err), true);
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    banner = document.getElementById("publish-banner");
    statusText = document.getElementById("publish-status-text");
    btn = document.getElementById("btn-publish");
    if (!banner || !btn) return;

    btn.addEventListener("click", publishNow);
    // Klik tab mana pun cukup untuk mendeteksi ulang status — hindari hook
    // di tiap file tab (lihat komentar berkas ini).
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", refreshStatus));
    // Fallback berkala: menangkap perubahan yang tidak disertai klik tab,
    // mis. drag-reorder foto di tab yang sedang aktif.
    setInterval(refreshStatus, 10000);

    refreshStatus();
  }

  const check = setInterval(() => {
    if (window.AdminAPI && window.AdminAPI.tenant && window.AdminAPI.tenant.invitationId) {
      clearInterval(check);
      init();
    }
  }, 300);
  setTimeout(() => clearInterval(check), 15000);
})();
