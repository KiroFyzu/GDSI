// ============================================================
// /api/webhook — Paywuz Webhook Relay
// ============================================================
// KENAPA FILE INI ADA:
// Paywuz mewajibkan webhook URL punya root domain yang SAMA
// dengan domain website terdaftar (gdsi.my.id). URL Apps Script
// (script.google.com) tidak akan pernah lolos aturan itu, jadi
// kita butuh satu titik penerima DI gdsi.my.id sendiri.
//
// TUGAS FILE INI CUMA SATU: terima POST dari Paywuz di sini,
// lalu terusin (relay) mentah-mentah ke Apps Script yang
// sebenarnya ngerjain semua logika (simpan Sheet, kirim email).
// Tidak ada logika bisnis apapun di sini — sengaja setipis
// mungkin, supaya kalau ada bug, kita tau itu bukan dari sini.
//
// SETUP YANG DIBUTUHKAN:
// Tidak ada env var baru! File ini pakai ULANG env var yang
// sudah ada di Vercel: VITE_GDSI_APPS_SCRIPT_URL. Vercel selalu
// expose SEMUA env var project ke runtime serverless function,
// terlepas dari prefix VITE_ (prefix itu cuma soal apakah Vite
// ikut nge-bundle nilainya ke kode client saat build, bukan soal
// akses di server).
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const gasUrl = process.env.VITE_GDSI_APPS_SCRIPT_URL;

  if (!gasUrl) {
    // Config belum lengkap — retry dari Paywuz gak akan nolongin
    // masalah ini, jadi balas 200 supaya gak nge-spam retry sia-sia.
    // Cek log function ini di Vercel Dashboard buat lihat pesan ini.
    console.error('[webhook relay] VITE_GDSI_APPS_SCRIPT_URL belum diset di Vercel env vars');
    return res.status(200).json({ received: true, warning: 'gas_url_missing' });
  }

  try {
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    // Kita gak perlu peduli isi balasan GAS secara detail di sini —
    // yang penting relay-nya berhasil terkirim. GAS sendiri yang
    // nentuin sukses/gagal donasi via re-check langsung ke Paywuz.
    console.log('[webhook relay] Forwarded to GAS, status:', gasResponse.status);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook relay] Gagal terusin ke GAS:', err.message);
    // 502 sengaja — ini bikin Paywuz otomatis retry (kebijakan retry
    // mereka: 5xx DI-retry, beda dari 4xx yang tidak). Kalau ini cuma
    // gangguan jaringan sesaat, percobaan berikutnya biasanya berhasil.
    return res.status(502).json({ error: 'relay_failed' });
  }
}
