#!/usr/bin/env python3
"""Kompres foto undangan tanpa penurunan kualitas yang kelihatan.

Dua hal yang dikerjakan, berurutan sesuai besarnya dampak:

1. DOWNSCALE ke ukuran tampil sebenarnya. Ini sumber penghematan terbesar dan
   sekaligus paling aman — kalau foto 933px lebar cuma ditampilkan selebar 240px,
   browser toh mengecilkannya sendiri; piksel selebihnya murni ongkos unduh.
   Target per folder di TARGETS dihitung dari CSS-nya (lihat komentar), sudah
   dikali headroom untuk layar HP ber-DPR tinggi.

2. RE-ENCODE dengan setelan hemat (progressive, tanpa metadata, subsampling
   4:2:0 untuk JPEG; method=6 untuk WebP).

Pengaman:
  * Default DRY RUN — tidak ada file yang disentuh sampai dijalankan dengan --apply.
  * File asli disalin ke assets/img_backup/ sebelum ditimpa.
  * Hasil yang tidak lebih kecil minimal MIN_GAIN dibuang, file asli dipertahankan.
    Jadi foto yang sudah optimal tidak akan di-re-encode berulang kali (setiap
    re-encode JPEG menurunkan kualitas sedikit, walau setelannya sama).

Pemakaian:
    python scripts/compress-images.py            # laporan saja, tidak menulis
    python scripts/compress-images.py --apply    # betulan menimpa
    python scripts/compress-images.py --apply --folder foto_slider_section_1
"""

import argparse
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "assets", "img")
BACKUP_DIR = os.path.join(ROOT, "assets", "img_backup")

JPEG_QUALITY = 82
WEBP_QUALITY = 80
MIN_GAIN = 0.03  # hasil harus >=3% lebih kecil, kalau tidak file asli dipertahankan

# Lebar maksimum per folder, diturunkan dari ukuran tampil di style.css lalu
# dikali ~2-3x untuk layar HP ber-DPR tinggi.
TARGETS = {
    # Hero full-screen (cover / Save The Date / closing): selebar viewport.
    "foto_cover": 1280,
    "foto_opening": 1280,
    "foto_closing": 1280,
    # Slider mempelai: full-width, tinggi 75vh.
    "foto_bride": 1280,
    "foto_groom": 1280,
    # We Found Love: slide 1:1, 3 per layar di HP (~120px) / 5 di desktop (~240px).
    # Ini folder yang fotonya paling jauh kelebihan ukuran.
    "foto_slider_section_1": 560,
    # Slider kartu event: kartu selebar min(96%, 720px).
    "foto_slider_section_2": 1200,
    # Galeri: grid maks 720px; .jpg-nya juga dipakai lightbox (maks 92vw).
    "foto_gallery": 1200,
    # Foto quote: full-width 1:1.
    "foto_quote": 1280,
    # Timeline Our Story: kontainer maks 480px, rasio 16/10.
    "foto_story": 960,
}

# foto_profile sengaja TIDAK didaftarkan: config.js masih menyebut
# couple.bride.photo / couple.groom.photo, tapi main.js tidak pernah
# merendernya. Folder itu tidak pernah diunduh tamu, jadi percuma diproses.


def human(n):
    return "%.0f KB" % (n / 1024.0)


def encode(im, path, fmt):
    """Simpan ke `path` dengan setelan hemat sesuai formatnya."""
    if fmt == "JPEG":
        im.convert("RGB").save(
            path,
            "JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
            progressive=True,
            subsampling="4:2:0",
        )
    else:
        im.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def process(src, target_width, apply_changes):
    """Kembalikan (ukuran_lama, ukuran_baru, catatan)."""
    old_size = os.path.getsize(src)
    fmt = "JPEG" if src.lower().endswith(".jpg") else "WEBP"

    # Adanya backup = file ini sudah pernah diproses. Berhenti di sini, jangan
    # di-encode ulang. Tanpa penjaga ini, setiap kali script dijalankan ia akan
    # menemukan sisa penghematan 3-5% lalu meng-encode lagi, dan kualitasnya
    # terkikis sedikit demi sedikit tiap putaran.
    backup = os.path.join(BACKUP_DIR, os.path.relpath(src, IMG_DIR))
    if os.path.exists(backup):
        return old_size, old_size, "sudah diproses sebelumnya"

    im = Image.open(src)
    im.load()
    width, height = im.size

    resized = False
    if width > target_width:
        new_h = max(1, round(height * target_width / float(width)))
        im = im.resize((target_width, new_h), Image.LANCZOS)
        resized = True

    tmp = src + ".tmp"
    encode(im, tmp, fmt)
    new_size = os.path.getsize(tmp)

    gain = (old_size - new_size) / float(old_size)
    if gain < MIN_GAIN:
        os.remove(tmp)
        return old_size, old_size, "sudah optimal, dilewati"

    note = "%dpx -> %dpx" % (width, target_width) if resized else "re-encode"
    if not apply_changes:
        os.remove(tmp)
        return old_size, new_size, note

    os.makedirs(os.path.dirname(backup), exist_ok=True)
    shutil.copy2(src, backup)
    os.replace(tmp, src)
    return old_size, new_size, note


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="betulan menimpa file (default: dry run)")
    ap.add_argument("--folder", help="proses satu folder saja")
    args = ap.parse_args()

    if not args.apply:
        print(">> DRY RUN — tidak ada file yang diubah. Tambahkan --apply untuk menulis.\n")

    folders = [args.folder] if args.folder else sorted(TARGETS)
    grand_old = grand_new = 0

    for folder in folders:
        if folder not in TARGETS:
            print("Folder '%s' tidak ada di TARGETS." % folder)
            return 1
        path = os.path.join(IMG_DIR, folder)
        if not os.path.isdir(path):
            continue

        files = sorted(
            f for f in os.listdir(path) if f.lower().endswith((".jpg", ".webp"))
        )
        f_old = f_new = 0
        details = []
        for name in files:
            old, new, note = process(os.path.join(path, name), TARGETS[folder], args.apply)
            f_old += old
            f_new += new
            if old != new:
                details.append("      %-12s %8s -> %8s  (%s)" % (name, human(old), human(new), note))

        grand_old += f_old
        grand_new += f_new
        pct = (f_old - f_new) / float(f_old) * 100 if f_old else 0
        print("%-24s %2d file  %9s -> %9s  hemat %5.1f%%" % (folder, len(files), human(f_old), human(f_new), pct))
        for line in details:
            print(line)

    pct = (grand_old - grand_new) / float(grand_old) * 100 if grand_old else 0
    print("\n%-24s        %9s -> %9s  hemat %5.1f%%" % ("TOTAL", human(grand_old), human(grand_new), pct))

    if args.apply:
        print("\nFile asli disalin ke %s" % os.path.relpath(BACKUP_DIR, ROOT))
        print("Manifest tidak berubah (nama file tetap sama).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
