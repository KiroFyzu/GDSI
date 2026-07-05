# Setup Donasi Paywuz

Alur donasi sekarang tidak bergantung ke Google Apps Script.

1. `donation.html` membuat transaksi ke `/api/donation`.
2. `/api/donation` membuat transaksi ke Paywuz memakai server env `PAYWUZ_API_KEY`.
3. Donatur diarahkan ke halaman pembayaran resmi Paywuz.
4. Setelah balik ke `/donation?orderId=...`, halaman mengecek status ke `/api/donation?orderId=...`.
5. `/api/webhook` tetap tersedia untuk menerima notifikasi Paywuz, tetapi status halaman donasi tidak bergantung ke webhook.

## Vercel Environment Variables

Set di Vercel Project Settings:

```env
PAYWUZ_API_KEY=pk_sand_xxxxx
GDSI_SITE_URL=https://gdsi.my.id
PAYWUZ_BASE_URL=https://api.paywuz.id/v1
```

Untuk production, ganti `PAYWUZ_API_KEY` menjadi key live:

```env
PAYWUZ_API_KEY=pk_live_xxxxx
```

`PAYWUZ_API_KEY` jangan diberi prefix `VITE_`, karena key ini harus tetap server-only.

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

Jika `VA` belum aktif di project Paywuz, pilih `QRIS` dulu.

## Test

1. Deploy ke Vercel.
2. Buka `https://gdsi.my.id/donation`.
3. Buat donasi kecil dengan sandbox/live key yang sesuai.
4. Setelah pembayaran, halaman harus menampilkan sukses untuk status Paywuz `success` atau `settlement`.

Jika status Paywuz belum terbaca saat redirect kembali, halaman akan menampilkan status menunggu pembayaran, bukan langsung gagal.
