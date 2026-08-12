/* Halaman workspace WA: memakai renderer/action yang sudah teruji di
 * admin/wa-blast.js, tetapi memisahkan alur login, identitas tenant, dan
 * tampilan terang dari panel admin umum. */
(function () {
  function coupleLabel(content) {
    const fallback = window.WEDDING_CONFIG.couple;
    const couple = (content && content.couple) || fallback;
    const bride = (couple.bride && (couple.bride.nickname || couple.bride.name)) || fallback.bride.nickname;
    const groom = (couple.groom && (couple.groom.nickname || couple.groom.name)) || fallback.groom.nickname;
    return { bride, groom };
  }

  async function loadWorkspaceIdentity() {
    const { sb, tenant, query } = window.AdminAPI;
    const { data, error } = await query(
      sb.from("site_content").select("content").eq("invitation_id", tenant.invitationId).eq("id", 1).maybeSingle(),
      "Permintaan identitas undangan"
    );
    if (error) {
      window.AdminAPI.toast("Nama pasangan memakai data cadangan: " + error.message, true);
    }
    const names = coupleLabel(data && data.content);
    // Renderer WA lama membaca WEDDING_CONFIG. Sinkronkan hanya bagian couple
    // setelah tenant tervalidasi agar token pesan tidak pernah memakai pasangan root.
    window.WEDDING_CONFIG.couple = {
      ...window.WEDDING_CONFIG.couple,
      bride: { ...window.WEDDING_CONFIG.couple.bride, ...((data && data.content && data.content.couple && data.content.couple.bride) || {}) },
      groom: { ...window.WEDDING_CONFIG.couple.groom, ...((data && data.content && data.content.couple && data.content.couple.groom) || {}) }
    };
    document.getElementById("wa-page-title").textContent = `${names.bride} & ${names.groom}`;
    document.title = `WhatsApp — ${names.bride} & ${names.groom}`;
    document.getElementById("wa-back-invitation").href = tenant.path();
  }

  window.AdminShared.initAdminAuth({
    // Data kontak dan template memiliki RLS role admin; admin_qr berhenti di
    // tahap akses sebelum renderer WA melakukan query apa pun.
    allowedRoles: ["admin", "root_owner"],
    onSignedIn: async () => {
      await loadWorkspaceIdentity();
      if (window.WaBlast) window.WaBlast.load();
    }
  });
})();
