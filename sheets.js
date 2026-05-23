// sheets.js - Google Sheets Sync via Apps Script Web App
import { showToast } from './utils.js';
import { withRetry, isOnline } from './utils.js';

// ============================================
// KONFIGURASI - GANTI URL WEB APP ANDA
// ============================================
const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyzohhmODuY3JAY3igFrjNPJeVd57lkF4cxeA5yvx4WcidFhp5osBUd7g96-M1u-fMf/exec';

/**
 * Sinkronisasi data ke Google Sheets (backup/admin log)
 * Non-blocking: tidak mengganggu UX jika gagal
 */
export async function syncToGoogleSheets(data) {
  if (!isOnline()) {
    console.warn('[Sheets] Offline, sync ditunda');
    return { success: false, reason: 'offline' };
  }

  const payload = {
    uid: data.uid,
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    usernameId: data.usernameId,
    clubTeam: data.clubTeam,
    car: data.car,
    engine: data.engine,
    registeredAt: data.registeredAt || new Date().toISOString(),
    sheetName: 'GDSI_Registrations'
  };

  try {
    await withRetry(
      () =>
        fetch(SHEETS_WEB_APP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          // mode: 'no-cors' // Aktifkan jika CORS bermasalah, tapi response tidak bisa dibaca
        }),
      3,
      1500,
      10000
    );

    console.log('[Sheets] Sync berhasil');
    return { success: true };
  } catch (err) {
    console.error('[Sheets] Sync gagal:', err);
    // Tidak showToast error agar tidak mengganggu UX sukses
    return { success: false, reason: err.message };
  }
}

/*
============================================
GOOGLE APPS SCRIPT CODE (simpan sebagai .gs di Google Apps Script):
============================================

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.sheetName || 'GDSI_Registrations');

  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(data.sheetName || 'GDSI_Registrations');
    sheet.appendRow(['Timestamp', 'UID', 'Name', 'Email', 'WhatsApp', 'UsernameID', 'ClubTeam', 'Car', 'Engine', 'RegisteredAt']);
  }

  sheet.appendRow([
    new Date(),
    data.uid,
    data.name,
    data.email,
    data.whatsapp,
    data.usernameId,
    data.clubTeam,
    data.car,
    data.engine,
    data.registeredAt
  ]);

  return ContentService.createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Deploy sebagai Web App, akses: Anyone
============================================
*/
