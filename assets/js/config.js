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
      photo: "assets/img/hero/profile-bride.jpg"
    },
    groom: {
      name: "Andi Pramana",
      nickname: "Andi",
      instagram: "",
      father: "Nandar Suhendar",
      mother: "Elin Herlina",
      photo: "assets/img/hero/profile-groom.jpg"
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
    akad: { label: "Akad Nikah", start: "08.00", end: "10.00" },
    resepsi: { label: "Resepsi", start: "11.00", end: "14.00" },
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

  loveStory: [
    {
      date: "2022",
      title: "Awal Perkenalan",
      photo: "assets/img/gallery/gallery-001.jpg",
      text: "Dipertemukan lewat teman yang sama, obrolan singkat berlanjut jadi kebiasaan menanyakan kabar setiap hari."
    },
    {
      date: "2023",
      title: "Mulai Menjalin Kasih",
      photo: "assets/img/gallery/gallery-005.jpg",
      text: "Setelah saling mengenal lebih dekat, kami memutuskan untuk melangkah bersama dan saling menguatkan."
    },
    {
      date: "2025",
      title: "Lamaran",
      photo: "assets/img/hero/lamaran.jpg",
      text: "Direstui kedua keluarga, hari lamaran menjadi langkah awal menuju jenjang yang lebih serius."
    },
    {
      date: "25 Agustus 2026",
      title: "Hari Bahagia",
      photo: "assets/img/gallery/gallery-015.jpg",
      text: "Dengan mengucap Bismillah, kami memutuskan untuk melanjutkan hubungan ke jenjang pernikahan."
    }
  ],

  gift: {
    accounts: [
      { bank: "Bank BCA", number: "1234567890", holder: "Mita Meliana" },
      { bank: "Bank Mandiri", number: "0987654321", holder: "Andi Pramana" }
    ],
    address: {
      recipient: "Mita Meliana",
      phone: "0812-0000-0000",
      detail: "Alamat pengiriman kado — silakan diperbarui sesuai kebutuhan."
    },
    note: "Nomor rekening di atas masih contoh (placeholder) — silakan ganti dengan data asli sebelum disebar ke tamu."
  },

  hero: {
    cover: [
      { jpg: "assets/img/hero/cover-1.jpg", webp: "assets/img/hero/cover-1.webp" },
      { jpg: "assets/img/hero/cover-2.jpg", webp: "assets/img/hero/cover-2.webp" }
    ],
    opening: [
      { jpg: "assets/img/hero/opening-1.jpg", webp: "assets/img/hero/opening-1.webp" },
      { jpg: "assets/img/hero/opening-2.jpg", webp: "assets/img/hero/opening-2.webp" }
    ],
    closing: [
      { jpg: "assets/img/hero/closing-1.jpg", webp: "assets/img/hero/closing-1.webp" },
      { jpg: "assets/img/hero/closing-2.jpg", webp: "assets/img/hero/closing-2.webp" }
    ]
  },
  heroSlideInterval: 7000,

  gallery: {
    manifestUrl: "assets/img/gallery/manifest.json"
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
