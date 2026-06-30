// sheets.js - Google Sheets Sync via Apps Script Web App
// Registration ONLY — QTT is handled directly by Apps Script
// ============================================================

import { showToast } from './utils.js';
import { isOnline } from './utils.js';

// ============================================
// KONFIGURASI - GANTI URL WEB APP ANDA
// ============================================
const SHEETS_WEB_APP_URL = import.meta.env.VITE_GDSI_APPS_SCRIPT_URL;

/**
 * Sinkronisasi data registrasi ke Google Sheets
 * Sheet: GDSI_Registrations
 * Non-blocking: tidak mengganggu UX jika gagal
 */
export async function syncToGoogleSheets(data) {
  if (!isOnline()) {
    console.warn('[Sheets] Offline, sync ditunda');
    return { success: false, reason: 'offline' };
  }

  const payload = {
    action: 'register',
    sheetName: 'GDSI_Registrations',
    uid: data.uid,
    name: data.name,
    email: data.email,
    whatsapp: data.whatsapp,
    usernameId: data.usernameId,
    country: data.country,
    clubTeam: data.clubTeam,
    car: data.car,
    engine: data.engine,
    registeredAt: data.registeredAt || new Date().toISOString()
  };

  try {
    // FIX CORS: pake no-cors mode biar request tetep kekirim
    await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('[Sheets] Sync to GDSI_Registrations berhasil');
    return { success: true };
  } catch (err) {
    console.error('[Sheets] Sync gagal:', err);
    return { success: false, reason: err.message };
  }
}

/*
============================================
NOTE: QTT submission does NOT use this file.
QTT is handled directly by the Apps Script Web App
which receives FormData and writes to GDSI_QTT_Submissions sheet.
============================================
*/
