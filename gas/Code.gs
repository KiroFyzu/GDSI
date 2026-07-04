// ============================================================
// CODE.GS — Router utama
// Berisi: CONFIG, doPost (routing semua POST action), doGet
// (routing semua GET action + admin auth), jsonResponse helper.
// File INI yang dipanggil pertama oleh Apps Script saat ada
// request masuk — tapi karena semua file digabung jadi satu
// scope, urutan file tidak masalah.
// ============================================================

// ============================================
// GOOGLE APPS SCRIPT - GDSI Handler
// Deploy: Web App → Execute as: Me → Access: Anyone
// Handles: Registration, QTT Submit, Email Confirmations
// ============================================

// ============================================
// CONFIG — WAJIB DIISI SESUAI EVENT & EMAIL
// ============================================
var CONFIG = {
  // Folder Google Drive
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Season_1_Round_2_QTT",  // ← Ganti per event, atau kosongkan ""
  MAX_FILE_SIZE_MB: 100,

  // Email sender
  // Untuk kirim dari admin@gdsi.my.id:
  //   1. Buka Gmail → Settings → Accounts → Add another email
  //   2. Tambahkan admin@gdsi.my.id
  //   3. ImprovMX akan forward kode verifikasi ke Gmail kamu
  //   4. Verifikasi → selesai
  //   5. Set FROM_EMAIL di bawah ini
  // Kalau belum setup alias, kosongkan → email dikirim dari akun Google kamu
  FROM_EMAIL: "admin@gdsi.my.id",   // ← Isi alias Gmail kamu, atau kosongkan ""
  FROM_NAME: "Tim GDSI",

  // Branding
  SITE_URL: "https://gdsi.my.id",     // ← URL website kamu
  EVENT_NAME: "Grand Drift Series Indonesia 2026"
};

// ============================================
// MAIN: doPost
// ============================================
function doPost(e) {
  try {
    var data;

    // Registration (sheets.js) sends JSON via fetch with Content-Type application/json.
    // QTT (qtt-app.js) sends FormData, accessed via e.parameter in Apps Script.
    // Detect by trying JSON parse first; fall back to e.parameter for FormData.
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      // FormData path — qtt-app.js / donation.html send FormData
      data = e.parameter || {};
    }

    // ── Paywuz webhook detection ──────────────────────────────
    // Paywuz POSTs raw JSON with an "event" field and no "action"
    // field of ours. GAS cannot read the X-Paywuz-Signature header
    // (Google permanently disabled header access in doPost — see
    // notes below), so instead of trusting this payload, treat it
    // only as a trigger: go re-check the real status directly from
    // Paywuz using our own API key before ever marking anything paid.
    if (!data.action && data.event && data.data && data.data.orderId) {
      return handlePaywuzWebhook(data);
    }

    var action = data.action || 'qtt_submit';

    if (action === 'register') {
      return handleRegistration(data);
    } else if (action === 'qtt_submit') {
      return handleQttSubmit(data);
    } else if (action === 'create_donation') {
      return handleCreateDonation(data);
    } else {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }
  } catch (error) {
    console.error("Apps Script Error:", error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// HANDLE: Registration
// ============================================
function doGet(e) {
  var action = e.parameter.action || 'status';
  var auth   = e.parameter.auth   || '';

  // Health check (no auth needed)
  if (action === 'status') {
    return jsonResponse({
      status  : "GDSI Endpoint Active",
      version : "3.0",
      config  : {
        parentFolder : CONFIG.PARENT_FOLDER_NAME,
        eventFolder  : CONFIG.EVENT_FOLDER_NAME || "(none)",
        maxFileSizeMB: CONFIG.MAX_FILE_SIZE_MB,
        emailFrom    : CONFIG.FROM_EMAIL || "(default google account)",
        emailEnabled : true
      }
    });
  }

  // Donation status check (public — any donor can check their OWN
  // orderId; there's nothing sensitive in a status lookup, and
  // requiring admin auth here would break the donation page itself)
  if (action === 'check_donation_status') {
    return checkDonationStatus(e.parameter.orderId || '');
  }

  // All other actions require admin auth
  if (auth !== ADMIN_SECRET) {
    return jsonResponse({ success: false, error: 'Unauthorized' });
  }

  if (action === 'participants') {
    return getParticipants();
  }

  if (action === 'qtt_list') {
    return getQttList();
  }

  return jsonResponse({ success: false, error: 'Unknown action: ' + action });
}

// ============================================
// GET PARTICIPANTS — dari GDSI_Registrations sheet
// ============================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// GET — Status Check
// ============================================
// ============================================
// ADMIN_SECRET — sama dengan PWD_HASH di admin.html
// SHA-256 dari password admin (Winter#12326)
// ============================================
var ADMIN_SECRET = 'cdbece8ec39792cd9670a71dd7f1a01587b8c1f604c078839d3837ffd215ef43';

