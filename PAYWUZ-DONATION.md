# Setup Donasi Paywuz

Fitur donasi memakai alur:

1. `donation.html` mengirim nominal dan metode bayar ke Google Apps Script.
2. Apps Script membuat transaksi Paywuz.
3. Donatur diarahkan ke halaman pembayaran resmi Paywuz.
4. Paywuz mengirim webhook ke `/api/webhook` di domain website.
5. Webhook diteruskan ke Apps Script, lalu Apps Script mengecek status asli transaksi ke API Paywuz.

## Environment Website

Set di Vercel:

```env
VITE_GDSI_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

## Apps Script

Di Apps Script, buka `Project Settings`, lalu tambahkan Script Property:

```text
PAYWUZ_API_KEY=pk_sand_xxxxx
```

Untuk production, ganti nilainya menjadi API key live dari Paywuz:

```text
PAYWUZ_API_KEY=pk_live_xxxxx
```

Setelah update file `gas/Code.gs`, `gas/Donation.gs`, dan `gas/Email.gs`, deploy Apps Script sebagai Web App:

```text
Execute as: Me
Access: Anyone
```

## Paywuz Dashboard

Set webhook URL ke:

```text
https://gdsi.my.id/api/webhook
```

Metode yang dikirim dari form:

```text
QRIS
VA
```

Jika `VA` belum aktif di project Paywuz, transaksi akan ditolak oleh Paywuz. Gunakan `QRIS` sebagai default.

## Test Manual

Di Apps Script editor:

1. Jalankan `testPaywuzConnection()`.
2. Jalankan `testCreateDonation()`.
3. Buka Sheet `GDSI_Donations` dan pastikan transaksi pending tercatat.
4. Selesaikan pembayaran sandbox/live sesuai mode API key.
5. Pastikan status berubah menjadi `success` atau `settlement`.
