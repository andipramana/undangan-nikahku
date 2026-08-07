/**
 * Tab Ucapan: lihat siapa saja yang sudah mengirim RSVP + ucapan, dan hapus
 * yang perlu dihapus (spam / salah kirim).
 *
 * Hanya baca & hapus — ucapan tidak bisa diedit dari sini. Mengubah kalimat
 * orang lain lalu menampilkannya sebagai ucapan mereka bukan sesuatu yang
 * pantas disediakan; kalau salah, hapus dan minta kirim ulang.
 *
 * Butuh policy dari supabase/migrations/0003_admin_wishes.sql. Tanpa itu,
 * daftar ini tampil KOSONG tanpa pesan error — policy di 0001 hanya berlaku
 * untuk role `anon`, sedangkan admin yang login berperan `authenticated`.
 */
(function () {
  const { sb, toast } = window.AdminAPI;

  const LABEL = { hadir: "Hadir", tidak_hadir: "Tidak Hadir", ragu: "Ragu-ragu" };

  let wishes = [];

  window.WishesPanel = { load };

  async function load() {
    const root = document.getElementById("wishes-root");
    root.innerHTML = "<p class='muted'>Memuat ucapan…</p>";

    const table = (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes";
    const { data, error, count } = await sb
      .from(table)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (error) {
      root.innerHTML =
        `<p class="warning">Gagal memuat ucapan: ${esc(error.message)}</p>` +
        `<button type="button" class="btn btn--primary" id="wishes-retry">Coba lagi</button>`;
      document.getElementById("wishes-retry").addEventListener("click", load);
      return;
    }

    wishes = data || [];
    paint(count);
  }

  function paint(count) {
    const root = document.getElementById("wishes-root");

    if (!wishes.length) {
      root.innerHTML =
        `<p class="muted">Belum ada ucapan yang masuk.</p>` +
        `<p class="muted" style="font-size:.8rem">Kalau Anda yakin sudah ada ucapan tapi daftar ini kosong, ` +
        `migration <code>0003_admin_wishes.sql</code> kemungkinan belum dijalankan — tanpa itu admin tidak ` +
        `berhak membaca tabel ucapan, dan hasilnya nol baris tanpa pesan error.</p>`;
      return;
    }

    // Ringkasan per status kehadiran — angka yang paling sering dicari
    // (berapa yang datang, bawa berapa orang) tanpa perlu menghitung manual.
    const tally = { hadir: 0, tidak_hadir: 0, ragu: 0 };
    let guests = 0;
    wishes.forEach((w) => {
      if (tally[w.attendance] !== undefined) tally[w.attendance] += 1;
      if (w.attendance === "hadir") guests += Number(w.guest_count) || 0;
    });

    root.innerHTML = `
      <div class="wish-summary">
        <span><strong>${count ?? wishes.length}</strong> ucapan</span>
        <span class="wish-chip wish-chip--hadir">Hadir ${tally.hadir}</span>
        <span class="wish-chip wish-chip--ragu">Ragu ${tally.ragu}</span>
        <span class="wish-chip wish-chip--tidak">Tidak hadir ${tally.tidak_hadir}</span>
        <span class="muted">total ${guests} orang dari yang menyatakan hadir</span>
      </div>
      <div class="wish-list">
        ${wishes
          .map(
            (w, i) => `
          <article class="wish-row">
            <div class="wish-row__head">
              <strong>${esc(w.name)}</strong>
              <span class="wish-chip wish-chip--${chipClass(w.attendance)}">${esc(LABEL[w.attendance] || w.attendance || "-")}</span>
              <span class="muted">${Number(w.guest_count) || 1} orang</span>
              <time class="muted">${fmtDate(w.created_at)}</time>
              <button type="button" class="btn btn--tiny btn--danger" data-del="${i}" aria-label="Hapus ucapan dari ${esc(w.name)}">Hapus</button>
            </div>
            <p class="wish-row__msg">${esc(w.message)}</p>
          </article>`
          )
          .join("")}
      </div>`;

    root.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => remove(wishes[Number(btn.dataset.del)], btn));
    });
  }

  async function remove(item, btn) {
    if (!item) return;
    // Penghapusan tidak bisa dibatalkan dan ucapan ini kiriman orang lain —
    // tampilkan potongan isinya supaya yang terhapus benar-benar yang dimaksud.
    const preview = (item.message || "").slice(0, 60);
    if (!confirm(`Hapus ucapan dari "${item.name}"?\n\n"${preview}${item.message.length > 60 ? "…" : ""}"\n\nTidak bisa dibatalkan.`)) {
      return;
    }
    btn.disabled = true;
    const table = (window.WEDDING_CONFIG.supabase && window.WEDDING_CONFIG.supabase.wishesTable) || "wishes";
    const { error, count } = await sb.from(table).delete({ count: "exact" }).eq("id", item.id);
    if (error) {
      btn.disabled = false;
      toast("Gagal menghapus: " + error.message, true);
      return;
    }
    if (!count) {
      // RLS menolak diam-diam: nol baris terhapus, tanpa error. Tanpa pesan ini
      // tombolnya terasa "tidak melakukan apa-apa" dan sulit ditebak sebabnya.
      btn.disabled = false;
      toast("Tidak ada yang terhapus — jalankan migration 0003_admin_wishes.sql dulu.", true);
      return;
    }
    toast("Ucapan dihapus.");
    load();
  }

  function chipClass(a) {
    if (a === "hadir") return "hadir";
    if (a === "ragu") return "ragu";
    return "tidak";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
