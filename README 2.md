# Portofolio Haytsam Suchandra Wiranegara

Portofolio bertema satelit geospasial dengan dua tampilan:

- `index.html`: tampilan publik. Pengunjung membaca portofolio dan mengisi formulir kolaborasi.
- `admin.html`: halaman pribadi berkata sandi untuk mengedit semua kalimat.

## Struktur
```
index.html   Halaman publik
admin.html   Halaman pribadi (kata sandi + editor)
content.js   Seluruh isi teks portofolio dan hash kata sandi
style.css    Tampilan bersama
admin.css    Tampilan khusus admin
effects.js   Bintang dan satelit yang mengorbit
script.js    Logika halaman publik
admin.js     Logika admin
```

## Cara mengubah isi
1. Buka `admin.html` di situs, masuk dengan kata sandi.
2. Edit teks. Perubahan tersimpan otomatis sebagai draf di browser itu.
3. Klik Pratinjau untuk melihat hasilnya.
4. Klik "Unduh content.js", lalu ganti file `content.js` di repositori ini dan Commit.
5. Tunggu 1-2 menit, situs publik ikut berubah.

## Keamanan
GitHub Pages hanya hosting statis tanpa server. Kata sandi dicek di browser, jadi ini
pagar untuk mencegah orang awam, bukan keamanan penuh. Tapi pengunjung tidak bisa
mengubah situs publik: yang tayang hanya isi `content.js` di repositori, dan hanya
pemilik repositori yang bisa menggantinya.

Kata sandi awal: `satelit-2026`. Ganti segera lewat tab "Kata sandi", lalu terbitkan
`content.js` yang baru.

## Formulir kolaborasi
Tanpa pengaturan, tombol Kirim membuka aplikasi email pengunjung. Untuk pesan masuk
langsung ke inboxmu, buat formulir gratis di formspree.io, lalu tempel alamat
formulirnya (https://formspree.io/f/xxxx) di admin, tab Kolaborasi.
