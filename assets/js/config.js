/**
 * Satu sumber data untuk seluruh undangan. Edit file ini untuk mengubah
 * nama, tanggal, lokasi, rekening, dsb — tidak perlu menyentuh HTML/JS lain.
 */
window.WEDDING_CONFIG = {
  siteTitle: "Mita & Andi — The Wedding",
  guestParam: "to",
  defaultGuestName: "Bapak/Ibu/Saudara/i",

  couple: {
    bride: {
      name: "Mita Meliana",
      nickname: "Mita",
      instagram: "",
      father: "Yayan Taryana",
      mother: "Ani Kuswati",
      photo: "assets/img/foto_profile/bride.jpg"
    },
    groom: {
      name: "Andi Pramana",
      nickname: "Andi",
      instagram: "",
      father: "Nandar Suhendar",
      mother: "Elin Herlina",
      photo: "assets/img/foto_profile/groom.jpg"
    }
  },

  opening: {
    arabicQuote: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    quote:
      "“Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan dari jenismu sendiri, supaya kamu cenderung dan merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.”",
    source: "QS. Ar-Rum: 21"
  },

  event: {
    dateISO: "2026-08-25",
    dateLabel: "25 Agustus 2026",
    dayLabel: "Selasa",
    countdownTarget: "2026-08-25T08:00:00+07:00",
    // Venue TIDAK lagi shared satu untuk kedua acara — masing-masing punya
    // venue sendiri (kadang tempat akad beda dengan resepsi). Nilai default
    // keduanya sama; diubah lewat tab Teks admin per acara.
    akad: {
      label: "Akad Nikah", start: "08.00", end: "10.00",
      venue: {
        name: "Gedung Serba Guna Mayang Arum",
        address:
          "Jl. Raya Ciwidey Km 27 No. 66, Pasir Jambu, Ciwidey, Jawa Barat",
        mapsUrl:
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(
            "Gedung Serba Guna Mayang Arum, Jl. Raya Ciwidey Km 27 No. 66, Pasir Jambu, Ciwidey, Jawa Barat"
          )
      }
    },
    resepsi: {
      label: "Resepsi", start: "11.00", end: "14.00",
      venue: {
        name: "Gedung Serba Guna Mayang Arum",
        address:
          "Jl. Raya Ciwidey Km 27 No. 66, Pasir Jambu, Ciwidey, Jawa Barat",
        mapsUrl:
          "https://www.google.com/maps/search/?api=1&query=" +
          encodeURIComponent(
            "Gedung Serba Guna Mayang Arum, Jl. Raya Ciwidey Km 27 No. 66, Pasir Jambu, Ciwidey, Jawa Barat"
          )
      }
    },
    // Slider foto pasangan di kartu event (4/10 atas kartu) — di-fetch dari
    // manifest folder foto_slider_section_2, urutan by name. Minimal 6 foto utk loop.
    manifest: "assets/img/foto_slider_section_2/manifest.json"
  },

  dresscode: {
    // Kartu kecil 1/4 layar di bawah kartu event. Ubah warna sesuka hati (5 warna).
    text:
      "Dengan hormat, kami mengundang Anda untuk mengenakan warna pilihan ini di hari pernikahan kami.",
    colors: ["#c9a668", "#b5c4a8", "#93a9c2", "#e6c3c0", "#f1ead9"]
  },

  livestream: {
    // URL siaran langsung per platform. Kosong = platform itu tidak
    // ditampilkan; semuanya kosong = section Live Streaming tidak dirender
    // sama sekali (bukan kotak kosong yang disembunyikan).
    youtube: "",
    instagram: "",
    tiktok: ""
  },

  galleryVideo: {
    // Video YouTube opsional di atas galeri: thumbnail dulu, baru diputar
    // saat diklik. Kosong = tidak dirender. BUKAN bagian dari foto galeri —
    // tidak menggeser pan/zoom yang sudah diatur admin.
    youtube: ""
  },

  quotePhoto: {
    // Foto full-width 1:1 di bawah kartu dresscode. Ganti isi folder
    // foto_quote (jpg + webp, nama photo) untuk memakai foto lain.
    photo: "assets/img/foto_quote/photo.jpg",
    quote: "Marriage is not about age; it's about finding the right person."
  },

  subcover: {
    // Section quotes layar penuh antara cover dan Save The Date (baru).
    // Foto DIAMBIL DARI SUPABASE folder "subcover" (tab Foto admin) — TIDAK
    // ada cadangan foto lokal, pola sama seperti quote/story/gift_item yang
    // lebih baru. Folder lokal lama (cover/opening/closing/bride/groom/
    // event/gallery/wfl) masih punya fallback manifest; folder baru ini
    // sengaja tidak.
    enabled: true,
    quoteLine1: "All because two people",
    quoteLine2: "fell in love ..."
  },

  loveStory: [
    {
      date: "2022",
      title: "Awal Perkenalan",
      photo: "assets/img/foto_story/01.jpg",
      text: "Dipertemukan lewat teman yang sama, obrolan singkat berlanjut jadi kebiasaan menanyakan kabar setiap hari."
    },
    {
      date: "2023",
      title: "Mulai Menjalin Kasih",
      photo: "assets/img/foto_story/02.jpg",
      text: "Setelah saling mengenal lebih dekat, kami memutuskan untuk melangkah bersama dan saling menguatkan."
    },
    {
      date: "2025",
      title: "Lamaran",
      photo: "assets/img/foto_story/03.jpg",
      text: "Direstui kedua keluarga, hari lamaran menjadi langkah awal menuju jenjang yang lebih serius."
    },
    {
      date: "25 Agustus 2026",
      title: "Hari Bahagia",
      photo: "assets/img/foto_story/04.jpg",
      text: "Dengan mengucap Bismillah, kami memutuskan untuk melanjutkan hubungan ke jenjang pernikahan."
    }
  ],

  gift: {
    // Nomor WA tujuan tombol "Konfirmasi Pengiriman" — format 62812xxxxxxx
    // (tanpa awalan 0 atau +; JS menormalisasi otomatis, tapi lebih aman
    // diisi rapi). Dipilih otomatis dari field `owner` tiap rekening.
    contactCPP: "", // calon pengantin pria
    contactCPW: "", // calon pengantin wanita
    // Selama masih placeholder (placeholder: true), nomor rekening TIDAK ditampilkan
    // ke tamu. Isi nomor asli lalu hapus "placeholder: true" agar nomor + tombol Salin muncul.
    // `owner: "cpp" | "cpw"` menandai rekening milik siapa — menentukan nomor WA
    // tujuan di modal konfirmasi pengiriman ("" = tidak ikut di dropdown).
    accounts: [
      { bank: "Bank BCA", number: "1234567890", holder: "Mita Meliana", owner: "cpw" },
      { bank: "Bank Mandiri", number: "0987654321", holder: "Andi Pramana", owner: "cpp" }
    ],
    address: {
      recipient: "Mita Meliana",
      phone: "0812-0000-0000",
      detail: "Alamat pengiriman kado — silakan diperbarui sesuai kebutuhan."
    },
  },

  giftRecommendations: [
    // Rekomendasi kado (modal kartu + tombol Beli). Foto kado diunggah di
    // panel admin, folder "Rekomendasi Kado" (gift_item) — foto ke-i
    // dipasangkan dengan rekomendasi ke-i: jumlah & urutan keduanya harus
    // sinkron (admin diingatkan lewat hint di tab Foto).
    // { name: "Perabot Rumah Tangga", price: "Rp 250.000", link: "https://shopee.co.id/..." }
  ],

  hero: {
    // Slideshow cover / opening / closing — di-fetch dari manifest per folder
    // (urutan by name). Ganti foto = timpa file jpg+webp di folder lalu jalankan
    // scripts/build-manifests.mjs.
    coverManifest: "assets/img/foto_cover/manifest.json",
    openingManifest: "assets/img/foto_opening/manifest.json",
    closingManifest: "assets/img/foto_closing/manifest.json"
  },
  heroSlideInterval: 4500,

  coupleSlides: {
    // Slideshow besar 3/4 layar di section Kedua Mempelai (auto + bisa digeser).
    // Di-fetch dari manifest folder foto_bride / foto_groom, urutan by name.
    // Catatan: foto groom masih placeholder dari sesi ENGAGEMENT — tinggal ganti
    // isi folder assets/img/foto_groom lalu jalankan scripts/build-manifests.mjs.
    // Minimal 6 foto agar loop Swiper aman.
    brideManifest: "assets/img/foto_bride/manifest.json",
    groomManifest: "assets/img/foto_groom/manifest.json"
  },

  weFoundLove: {
    // Foto slider "We Found Love" — ratio 1:1 (di-crop otomatis CSS), bisa digeser user,
    // loop tak terbatas. Di-fetch dari manifest foto_slider_section_1, urutan by name.
    manifest: "assets/img/foto_slider_section_1/manifest.json"
  },

  gallery: {
    // Galeri foto (pola baris dibangun gallery.js) — di-fetch dari manifest
    // folder foto_gallery, urutan by name. Tambah foto = taruh file di folder
    // lalu jalankan scripts/build-manifests.mjs (tanpa ubah config).
    manifest: "assets/img/foto_gallery/manifest.json"
  },

  audio: {
    src: "assets/audio/backsound.mp3",
    title: "Backsound"
  },

  supabase: {
    url: "https://rxqolwczphehbzrzmisa.supabase.co",
    anonKey: "sb_publishable_Jzx2_m5-93yZfJu7SVuMUg_ZPVOg7xg",
    wishesTable: "wishes"
  },

  closing: {
    text:
      "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu."
  }
};
