# Panduan menjalankan Night Bite dengan MySQL XAMPP

## A. Siapkan database

1. Buka **XAMPP Control Panel**.
2. Klik **Start** pada MySQL. Klik **Start** pada Apache juga supaya phpMyAdmin bisa dibuka lewat browser.
3. Buka http://localhost/phpmyadmin.
4. Pilih tab **Import**.
5. Pilih file `database/nightbite_mysql.sql` dari folder project Night Bite.
6. Klik **Import** / **Go**. File ini akan membuat database bernama `nightbite` beserta 11 tabelnya.

## B. Siapkan koneksi Node.js

Buka PowerShell di folder `night-bite-web` (folder yang berisi `server.js`), lalu jalankan:

```powershell
Copy-Item .env.example .env
npm install
```

Buka file `.env`. Untuk pengaturan XAMPP standar, pastikan isinya seperti ini:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=nightbite
PORT=3000
NB_TZ=Asia/Jakarta
NB_SECURE=0
```

Kalau akun MySQL `root` kamu memakai password, isi nilai `DB_PASSWORD` dengan password tersebut.

## C. Jalankan website

Masih dari folder yang berisi `server.js`, jalankan:

```powershell
npm start
```

Buka http://localhost:3000. Jangan tutup jendela PowerShell selama website sedang digunakan.

**Penting:** Jangan pindahkan seluruh project ke `htdocs`. Website ini berjalan dengan Node.js. XAMPP digunakan untuk menyediakan MySQL dan phpMyAdmin, bukan untuk menjalankan file website ini sebagai PHP.

## D. Pastikan data masuk ke MySQL

Pertama kali server dinyalakan, aplikasi akan mengisi sembilan toko dan paket contoh secara otomatis jika tabel `merchants` masih kosong. Database MySQL ini dimulai dari data baru; akun, pesanan, atau chat dari file SQLite versi lama tidak otomatis dipindahkan.

Setelah itu, coba:

- Register akun pelanggan, lalu cek tabel `users`.
- Buat pesanan, lalu cek tabel `orders`.
- Login Food Partner dan ubah harga, lalu cek tabel `listings`.
- Kirim chat, lalu cek tabel `chats` dan `chat_messages`.

Pendaftaran Food Partner membuat profil toko baru dari nama toko, alamat, area, dan akun pegawai. Untuk deployment publik, tambahkan verifikasi email dan persetujuan admin agar orang luar tidak dapat membuat toko palsu.

Halaman customer: `http://localhost:3000/customer.html` (atau `/`). Halaman Food Partner: `http://localhost:3000/food-partner.html`.

QRIS sungguhan belum aktif sampai akun Midtrans terverifikasi dan API key serta webhook dikonfigurasi. Lokasi browser memerlukan izin pengguna; di hosting publik, website harus menggunakan HTTPS.
