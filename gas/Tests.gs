// ============================================================
// TESTS.GS — Fungsi test manual
// Jalankan langsung dari Apps Script editor (pilih nama fungsi
// di dropdown sebelah ▶️ Jalankan) untuk cek tanpa buka website.
// ============================================================

function testRegistrationEmail() {
  sendRegistrationEmail({
    name: "Test User",
    email: Session.getActiveUser().getEmail(), // kirim ke email kamu sendiri untuk test
    whatsapp: "+6281234567890",
    usernameId: "TestUser#1234",
    country: "Indonesia",
    clubTeam: "Tim Test",
    car: "Toyota AE86",
    engine: "2JZ",
    registeredAt: new Date().toISOString()
  });
  Logger.log("Registration email sent!");
}

function testQttEmail() {
  sendQttEmail({
    email: Session.getActiveUser().getEmail(),
    username: "TestUser#1234",
    vehicle: "Toyota AE86",
    engine: "2JZ",
    country: "Indonesia",
    videoUrl: "https://drive.google.com/file/d/test",
    fileName: "TestUser_20260101_120000.mp4",
    fileSize: "45.2 MB",
    submittedAt: new Date().toISOString()
  });
  Logger.log("QTT email sent!");
}

// ============================================================
// ============================================================
//   PAYWUZ DONATION INTEGRATION
// ============================================================
// ============================================================
//
// SETUP WAJIB sebelum fitur ini jalan:
//   1. Apps Script Editor → ikon ⚙️ (Project Settings)
//   2. Scroll ke "Script Properties" → Add script property
//   3. Property: PAYWUZ_API_KEY
//      Value: pk_sand_xxxxx  (sandbox) atau pk_live_xxxxx (production)
//   4. Save
//
// Kenapa Script Properties, bukan ditulis di CONFIG langsung:
// API key pembayaran ini kredensial finansial — kalau file .gs
// ini ke-share/ke-paste ke suatu tempat, Script Properties TIDAK
// ikut ter-copy (beda dari kode biasa), jadi API key tetap aman.
//
// GANTI KE PRODUCTION: cukup ganti value PAYWUZ_API_KEY di
// Script Properties dari pk_sand_... ke pk_live_..., tidak perlu
// ubah kode sama sekali.
// ============================================================

function testPaywuzConnection() {
  try {
    var methods = paywuzApiCall_('GET', '/payment-methods', null);
    Logger.log('SUCCESS — Paywuz connected. Payment methods available:');
    Logger.log(JSON.stringify(methods, null, 2));
  } catch (err) {
    Logger.log('FAILED — ' + err.toString());
    Logger.log('Cek: sudah set PAYWUZ_API_KEY di Script Properties?');
  }
}

function testCreateDonation() {
  var result = handleCreateDonation({
    amount: '15000',
    donorName: 'Test Donor',
    donorEmail: Session.getActiveUser().getEmail()
  });
  Logger.log(result.getContent());
}
