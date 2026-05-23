// sheets.js - Google Sheets Sync via Apps Script Web App
import { showToast } from './utils.js';
import { isOnline } from './utils.js';

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
    // FIX CORS: pake no-cors mode biar request tetep kekirim
    await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('[Sheets] Sync berhasil');
    return { success: true };
  } catch (err) {
    console.error('[Sheets] Sync gagal:', err);
    return { success: false, reason: err.message };
  }
}

/*
============================================
GOOGLE APPS SCRIPT CODE (simpan sebagai .gs di Google Apps Script):
============================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.sheetName || 'GDSI_Registrations';
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = [
        'Timestamp', 'UID', 'Name', 'Email', 'WhatsApp',
        'UsernameID', 'ClubTeam', 'Car', 'Engine', 'RegisteredAt'
      ];
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#ff5540');
      headerRange.setFontColor('#ffffff');
      sheet.autoResizeColumns(1, headers.length);
    }

    sheet.appendRow([
      new Date(),
      data.uid || '',
      data.name || '',
      data.email || '',
      data.whatsapp || '',
      data.usernameId || '',
      data.clubTeam || '',
      data.car || '',
      data.engine || '',
      data.registeredAt || new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      result: 'success',
      message: 'Data saved to sheet'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      result: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Deploy sebagai Web App, akses: Anyone
============================================
*/
