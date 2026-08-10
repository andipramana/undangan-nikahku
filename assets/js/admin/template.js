/** Tab Template admin — daftar template tersedia, pratinjau kecil,
 *  dan pilihan disimpan ke site_content.template. Template berlaku
 *  untuk undangan tamu (index.html membaca payload ini).
 *
 *  Template = JSON statis /templates/*.json yang ditarik saat dibutuhkan.
 *  Setiap template mendefinisikan: sections, theme, transitions, parallax,
 *  features. Detail di template-engine.js.
 */
(function () {
  "use strict";

  const sb = window.supabase && window.WEDDING_CONFIG && window.WEDDING_CONFIG.supabase
    ? window.supabase.createClient(window.WEDDING_CONFIG.supabase.url, window.WEDDING_CONFIG.supabase.anonKey)
    : null;

  /** Template yang dikenal — daftar manual, satu sumber kebenaran. */
  const KNOWN_TEMPLATES = [
    { id: "classic-elegance", name: "Classic Elegance", path: "/templates/classic-elegance.json" },
    { id: "modern-minimal", name: "Modern Minimal", path: "/templates/modern-minimal.json" },
  ];

  /** Informasi visual per template (warna dominan, preview deskripsi). */
  const VISUAL_INFO = {
    "classic-elegance": { colors: ["#14120f", "#c9a668", "#f7f3ea"], desc: "Klasik, hangat, emas — tone pernikahan timeless." },
    "modern-minimal": { colors: ["#1D1B17", "#B89149", "#F5F0E6"], desc: "Modern, bersih, sage-ivory — minimalis elegan." },
  };

  let activeId = "classic-elegance"; // default sebelum dibaca dari DB

  function toast(msg, isErr) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("toast--error", !!isErr);
    el.classList.add("show");
    clearTimeout(window.__tplToast);
    window.__tplToast = setTimeout(() => el.classList.remove("show"), 2500);
  }

  async function load() {
    const root = document.getElementById("template-root");
    if (!root) return;

    // 1) Baca template aktif dari site_content.template
    if (sb && window.AdminAPI && window.AdminAPI.tenant) {
      try {
        const { data, error } = await window.AdminAPI.query(
          sb.from("site_content").select("content").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1).maybeSingle(),
          "Baca template"
        );
        if (!error && data && data.content && data.content.template) {
          activeId = data.content.template;
        }
      } catch {}
    }
    // fallback: cek ?template=... di URL (preview admin)
    const urlTpl = new URLSearchParams(location.search).get("template");
    if (urlTpl && KNOWN_TEMPLATES.some((t) => t.id === urlTpl)) activeId = urlTpl;

    render(root);
  }

  function render(root) {
    const items = KNOWN_TEMPLATES.map((t) => {
      const info = VISUAL_INFO[t.id] || {};
      const active = t.id === activeId;
      return `<article class="tpl-card${active ? " tpl-card--active" : ""}" data-id="${t.id}">
        <div class="tpl-card__swatches">
          ${(info.colors || ["#ccc","#999","#666"]).map((c) => `<span style="background:${c}" title="${c}"></span>`).join("")}
        </div>
        <div class="tpl-card__body">
          <h3>${t.name}${active ? " ✓" : ""}</h3>
          <p>${info.desc || ""}</p>
        </div>
        <div class="tpl-card__actions">
          <button type="button" class="btn btn--primary" ${active ? "disabled" : ""} data-action="apply" data-id="${t.id}">${active ? "Aktif" : "Pakai"}</button>
          <button type="button" class="btn btn--ghost" data-action="preview" data-id="${t.id}">Preview</button>
        </div>
      </article>`;
    }).join("");

    root.innerHTML = `<div class="template-list">
      <p class="muted">Pilih tampilan undangan. Template mengubah warna, font, transisi, dan urutan section. Data (teks, foto, tamu) tetap aman.</p>
      ${items}
    </div>`;

    // Event delegation
    root.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === "apply") await applyTemplate(id);
        else previewTemplate(id);
      });
    });
  }

  async function applyTemplate(tplId) {
    const tpl = KNOWN_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return toast("Template tidak ditemukan.", true);
    if (tplId === activeId) return;

    // Simpan pilihan ke site_content.template
    if (sb && window.AdminAPI && window.AdminAPI.tenant) {
      const { data, error } = await window.AdminAPI.query(
        sb.from("site_content").select("content").eq("invitation_id", window.AdminAPI.tenant.invitationId).eq("id", 1).maybeSingle(),
        "Baca konten"
      );
      if (error && error.code !== "PGRST116") return toast("Gagal membaca konten: " + error.message, true);

      const content = (data && data.content) ? JSON.parse(JSON.stringify(data.content)) : window.AdminAPI.contentFromConfig(window.WEDDING_CONFIG);
      content.template = tplId;

      const { error: saveErr } = await window.AdminAPI.query(
        sb.from("site_content").upsert({ invitation_id: window.AdminAPI.tenant.invitationId, id: 1, content }),
        "Simpan template"
      );
      if (saveErr) return toast("Gagal menyimpan template: " + saveErr.message, true);
    }

    activeId = tplId;
    toast("Template diterapkan. Buka ulang undangan untuk melihat hasilnya.");
    render(document.getElementById("template-root"));
  }

  function previewTemplate(tplId) {
    const tpl = KNOWN_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return toast("Template tidak ditemukan.", true);

    const slug = window.AdminAPI && window.AdminAPI.tenant
      ? window.AdminAPI.tenant.slug
      : (new URLSearchParams(location.search).get("slug") || "demo");
    const url = `/${slug}/?template=${tplId}`;
    window.open(url, "_blank", "noopener");
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    // Tunggu AdminAPI siap, lalu muat tab template
    const check = setInterval(() => {
      if (window.AdminAPI && window.AdminAPI.tenant) {
        clearInterval(check);
        load();
      }
    }, 300);
    // Timeout: tetap render meski AdminAPI belum siap (fallback)
    setTimeout(() => { clearInterval(check); load(); }, 5000);
  });

  // Re-render ketika tab Template diklik
  const observer = new MutationObserver(() => {
    const panel = document.getElementById("tab-template");
    if (panel && !panel.hasAttribute("hidden")) load();
  });
  const tab = document.querySelector('[data-tab="template"]');
  if (tab) observer.observe(tab, { attributes: true, attributeFilter: ["class"] });
})();
