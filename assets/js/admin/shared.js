/**
 * Shim kompatibilitas — admin-qr.html dan wa.html masih memuat file ini lewat
 * <script src="assets/js/admin/shared.js">. Implementasi sesungguhnya (client
 * Supabase, AdminAPI, AdminShared, AdminToast) sekarang tinggal di
 * assets/js/panel/core.js, dipakai bersama admin.html v2.
 *
 * document.write di sini MEMUAT SECARA SINKRON — bukan cara lama yang
 * dipertahankan, ini justru sengaja: kedua halaman itu memuat script lain
 * segera sesudah tag ini (mis. admin-qr.js) yang butuh window.AdminAPI sudah
 * ada. Import module/async tidak menjamin urutan itu; document.write dari
 * script sinkron memaksa browser menjeda parsing HTML dan mengeksekusi
 * core.js sebelum lanjut ke tag berikutnya — persis perilaku <script src>
 * biasa yang digantikannya.
 */
document.write('<script src="assets/js/panel/core.js"></script>');
