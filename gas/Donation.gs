// ============================================================
// DONATION.GS — Integrasi pembayaran Paywuz
// Berisi: buat transaksi, terima webhook (dengan pola re-verify
// karena GAS tidak bisa baca header X-Paywuz-Signature), cek
// status, dan helper Sheet donasi.
//
// WAJIB: set PAYWUZ_API_KEY di Script Properties sebelum jalan.
// (⚙️ Project Settings → Script Properties → Add)
// ============================================================

var PAYWUZ_CONFIG = {
  BASE_URL: 'https://api.paywuz.id/v1',
  DEFAULT_PAYMENT_METHOD: 'QRIS',
  MIN_AMOUNT: 10000,
  SHEET_NAME: 'GDSI_Donations'
};

function getPaywuzApiKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('PAYWUZ_API_KEY');
  if (!key) throw new Error('PAYWUZ_API_KEY belum diset di Script Properties. Lihat komentar setup di atas.');
  return key;
}

// ── Low-level Paywuz API call helper ──────────────────────────
function paywuzApiCall_(method, path, body) {
  var options = {
    method: method,
    headers: { 'Authorization': 'Bearer ' + getPaywuzApiKey_() },
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (body) options.payload = JSON.stringify(body);

  var response = UrlFetchApp.fetch(PAYWUZ_CONFIG.BASE_URL + path, options);
  var code = response.getResponseCode();
  var json;
  try {
    json = JSON.parse(response.getContentText());
  } catch (e) {
    throw new Error('Paywuz response tidak valid JSON (HTTP ' + code + ')');
  }

  if (code >= 400) {
    var msg = (json.error || 'error') + ': ' + (json.message || 'Unknown error');
    throw new Error(msg);
  }
  return json.data;
}

// ============================================================
// HANDLE: Create Donation Transaction
// Dipanggil dari donation.html via action=create_donation
// ============================================================
function handleCreateDonation(data) {
  try {
    var amount = parseInt(data.amount, 10);
    if (!amount || amount < PAYWUZ_CONFIG.MIN_AMOUNT) {
      return jsonResponse({ success: false, error: 'Nominal minimal Rp ' + PAYWUZ_CONFIG.MIN_AMOUNT.toLocaleString('id-ID') });
    }

    var donorName  = (data.donorName  || '').toString().trim().slice(0, 100);
    var donorEmail = (data.donorEmail || '').toString().trim().slice(0, 120);

    // Unique orderId per Paywuz's idempotency rules (1–64 chars, unique per project)
    var orderId = 'DONATE-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    var txData = paywuzApiCall_('POST', '/transactions', {
      orderId: orderId,
      amount: amount,
      paymentMethod: PAYWUZ_CONFIG.DEFAULT_PAYMENT_METHOD,
      redirectUrl: (CONFIG.SITE_URL || 'https://gdsi.my.id') + '/donation?orderId=' + orderId,
      metadata: { donorName: donorName, donorEmail: donorEmail }
    });

    // Log to Sheet as pending — webhook / status-check will update later
    logDonationRow_({
      timestamp: new Date(),
      orderId: orderId,
      donorName: donorName || '(anonim)',
      donorEmail: donorEmail,
      amount: amount,
      fee: '',
      totalPayment: txData.totalPayment || amount,
      paymentMethod: txData.paymentMethod || PAYWUZ_CONFIG.DEFAULT_PAYMENT_METHOD,
      status: 'pending',
      paidAt: ''
    });

    return jsonResponse({
      success: true,
      orderId: orderId,
      paymentUrl: txData.paymentUrl
    });
  } catch (err) {
    console.error('handleCreateDonation error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// WEBHOOK: Paywuz notification receiver
// GAS cannot read the X-Paywuz-Signature header (Google disabled
// header access in doPost permanently, Sept 2023). So instead of
// trusting this payload's claimed status, we use it only as a
// trigger — the ORDERID is extracted, then we make our OWN
// authenticated GET call back to Paywuz to learn the REAL status.
// Only that re-verified result is ever trusted.
// ============================================================
function handlePaywuzWebhook(payload) {
  try {
    var orderId = payload.data && payload.data.orderId;
    if (!orderId) return jsonResponse({ success: false, error: 'Missing orderId in webhook payload' });

    verifyAndSyncDonationStatus_(orderId);

    // Always respond 200 quickly (Paywuz requires response within 15s,
    // retries 3x on non-2xx) — even if sync had an issue, we don't want
    // Paywuz endlessly retrying; the admin can re-check manually via Sheet.
    return jsonResponse({ success: true });
  } catch (err) {
    console.error('handlePaywuzWebhook error:', err);
    // Still return 200 — see note above about retry policy
    return jsonResponse({ success: true, warning: err.toString() });
  }
}

// ============================================================
// GET: Check donation status (called by donation.html on return
// from Paywuz's redirect, and by the webhook handler above)
// ============================================================
function checkDonationStatus(orderId) {
  if (!orderId) return jsonResponse({ success: false, error: 'orderId required' });
  try {
    var result = verifyAndSyncDonationStatus_(orderId);
    return jsonResponse({
      success: true,
      status: result.status,
      amount: result.amount,
      orderId: orderId
    });
  } catch (err) {
    console.error('checkDonationStatus error:', err);
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================================
// CORE: Re-verify a donation's real status directly from Paywuz,
// update the Sheet if it changed, send thank-you email exactly
// once when a donation transitions into "success".
// Shared by both the webhook handler and the status-check endpoint.
// ============================================================
function verifyAndSyncDonationStatus_(orderId) {
  var txData = paywuzApiCall_('GET', '/transactions/' + encodeURIComponent(orderId), null);

  var sheet = getOrCreateDonationSheet_();
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var previousStatus = null;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] === orderId) { // column B = orderId
      rowIndex = i + 1; // 1-indexed for sheet API
      previousStatus = rows[i][8]; // column I = status
      break;
    }
  }

  var newlyPaid = (previousStatus !== 'success' && txData.status === 'success');

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 6).setValue(txData.fee || '');            // F: fee
    sheet.getRange(rowIndex, 7).setValue(txData.totalPayment || '');   // G: totalPayment
    sheet.getRange(rowIndex, 9).setValue(txData.status);               // I: status
    sheet.getRange(rowIndex, 10).setValue(txData.paidAt || '');        // J: paidAt
  }

  if (newlyPaid) {
    var donorEmail = rowIndex > 0 ? rows[rowIndex - 1][3] : ''; // column D = donorEmail
    var donorName  = rowIndex > 0 ? rows[rowIndex - 1][2] : '(anonim)';
    if (donorEmail) {
      try {
        sendDonationThankYouEmail_({
          email: donorEmail,
          name: donorName,
          amount: txData.amount,
          orderId: orderId,
          paidAt: txData.paidAt
        });
      } catch (emailErr) {
        console.error('Donation thank-you email failed:', emailErr);
      }
    }
  }

  return { status: txData.status, amount: txData.amount };
}

// ============================================================
// Sheet helper — GDSI_Donations
// Columns: Timestamp, OrderId, DonorName, DonorEmail, Amount,
//          Fee, TotalPayment, PaymentMethod, Status, PaidAt
// ============================================================
function getOrCreateDonationSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PAYWUZ_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PAYWUZ_CONFIG.SHEET_NAME);
    var headers = ['Timestamp', 'OrderId', 'DonorName', 'DonorEmail', 'Amount', 'Fee', 'TotalPayment', 'PaymentMethod', 'Status', 'PaidAt'];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#b70013');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

function logDonationRow_(d) {
  var sheet = getOrCreateDonationSheet_();
  sheet.appendRow([
    d.timestamp, d.orderId, d.donorName, d.donorEmail, d.amount,
    d.fee, d.totalPayment, d.paymentMethod, d.status, d.paidAt
  ]);
}

// ============================================================
// Email: Donation thank-you
// ============================================================
