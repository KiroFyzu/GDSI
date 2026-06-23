// app.js - Main Application Orchestrator
import { initAuth, getCurrentUser, login, logout } from './auth.js';
import { submitRegistration } from './firestore.js';
import { syncToGoogleSheets } from './sheets.js';
import {
  initCountryDropdown,
  initCountrySelect,
  getSelectedCountryDial,
  setFormMode,
  setSubmitLoading,
  showSuccessModal,
  showInfoModal,
  closeAllModals
} from './ui.js';
import {
  sanitizeInput,
  validateUsername,
  validateWhatsApp,
  validateRequired,
  validateEngine,
  showToast,
  isOnline,
  watchNetwork,
  SubmitLock
} from './utils.js';

const submitLock = new SubmitLock();

// ============================================
// ⚙️ MAINTENANCE MODE (set via Vercel env var)
// VITE_FORM_MAINTENANCE_MODE=true in .env or Vercel dashboard
// ============================================
const FORM_MAINTENANCE_MODE = import.meta.env.VITE_FORM_MAINTENANCE_MODE === 'true';


// ============================================
// MAINTENANCE MODE — disable entire form
// ============================================
function showFormMaintenanceMode() {
  // Show maintenance banner
  const banner = document.getElementById('maintenance-banner');
  if (banner) banner.classList.remove('hidden');

  // Hide readonly banner (we show maintenance one instead)
  const readonlyBanner = document.getElementById('readonly-banner');
  if (readonlyBanner) readonlyBanner.classList.add('hidden');

  // Disable all form inputs
  const form = document.getElementById('registration-form');
  if (form) {
    form.querySelectorAll('input, select, button[type="submit"]').forEach(el => {
      el.setAttribute('disabled', 'true');
      el.classList.add('opacity-50', 'cursor-not-allowed');
    });
  }

  // Disable submit button
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    submitBtn.title = 'Registrasi sedang ditutup sementara';
  }

  // Also disable dial trigger
  const dialTrigger = document.getElementById('dial-trigger');
  if (dialTrigger) {
    dialTrigger.disabled = true;
    dialTrigger.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

function init() {
  if (FORM_MAINTENANCE_MODE) {
    showFormMaintenanceMode();
  }
  initCountryDropdown();
  initCountrySelect();
  initAuth();
  initEventListeners();
  watchNetwork((online) => {
    if (!online) showToast('Koneksi terputus. Data tidak dapat dikirim.', 'warning', 5000);
  });
}

function initEventListeners() {
  const form = document.getElementById('registration-form');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
  if (loginBtn) {
    loginBtn.addEventListener('click', login);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  if (FORM_MAINTENANCE_MODE) {
    showToast('Registrasi sedang ditutup sementara. Pantau pengumuman kami.', 'warning');
    return;
  }

  if (submitLock.isLocked()) {
    showToast('Mohon tunggu, proses sedang berjalan...', 'warning');
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    showToast('Anda harus login terlebih dahulu', 'error');
    return;
  }

  if (!isOnline()) {
    showToast('Tidak ada koneksi internet. Coba lagi nanti.', 'error');
    return;
  }

  // ============================================
  // VALIDATION & SANITIZATION
  // ============================================
  const form = e.target;
  const rawName = form.querySelector('[name="full-name"]').value;
  const rawWhatsApp = form.querySelector('[name="whatsapp-number"]').value;
  const rawUsername = form.querySelector('[name="username-id"]').value;
  const rawCountry = form.querySelector('[name="country"]').value;
  const rawTeam = form.querySelector('[name="club-team"]').value;
  const rawCar = form.querySelector('[name="car"]').value;
  const engine = form.querySelector('[name="engine"]').value;

  const nameCheck = validateRequired(rawName, 'Nama Lengkap');
  if (!nameCheck.valid) { showToast(nameCheck.message, 'error'); return; }

  const teamCheck = validateRequired(rawTeam, 'Club / Team');
  if (!teamCheck.valid) { showToast(teamCheck.message, 'error'); return; }

  const carCheck = validateRequired(rawCar, 'Mobil');
  if (!carCheck.valid) { showToast(carCheck.message, 'error'); return; }

  const countryCheck = validateRequired(rawCountry, 'Country');
  if (!countryCheck.valid) { showToast(countryCheck.message, 'error'); return; }

  const usernameCheck = validateUsername(rawUsername);
  if (!usernameCheck.valid) { showToast(usernameCheck.message, 'error'); return; }

  const dial = getSelectedCountryDial();
  const waCheck = validateWhatsApp(rawWhatsApp, dial);
  if (!waCheck.valid) { showToast(waCheck.message, 'error'); return; }

  const engineCheck = validateEngine(engine);
  if (!engineCheck.valid) { showToast(engineCheck.message, 'error'); return; }

  // Sanitize all text inputs
  const formData = {
    name: sanitizeInput(nameCheck.value),
    email: user.email || '',
    photoURL: user.photoURL || '',
    provider: user.providerData[0]?.providerId || 'google',
    whatsapp: waCheck.normalized,
    usernameId: sanitizeInput(rawUsername),
    country: sanitizeInput(countryCheck.value),
    clubTeam: sanitizeInput(teamCheck.value),
    car: sanitizeInput(carCheck.value),
    engine: engine
  };

  // ============================================
  // SUBMIT WITH LOCK
  // ============================================
  submitLock.lock();
  setSubmitLoading(true);

  try {
    const result = await submitRegistration(user.uid, formData);

    // FIX: Add client-side timestamp for display since serverTimestamp returns FieldValue
    const now = new Date();
    const displayData = {
      ...result,
      registeredAt: now
    };

    // Sync to Google Sheets (non-blocking)
    try {
      await syncToGoogleSheets({ ...formData, uid: user.uid, registeredAt: now.toISOString() });
    } catch (sheetErr) {
      console.warn('Sheets sync error (non-critical):', sheetErr);
    }

    showToast('Registrasi berhasil disimpan!', 'success');
    showSuccessModal(displayData);
    setFormMode('readonly', displayData);

  } catch (err) {
    console.error('Submit error:', err);

    if (err.code === 'already-registered') {
      showToast('Anda sudah pernah mendaftar. 1 akun = 1 form.', 'warning');
      setFormMode('readonly', { ...formData, uid: user.uid, registeredAt: new Date() });
    } else if (err.code === 'username-taken') {
      showToast('Username ID sudah dipakai racer lain.', 'error');
    } else if (err.code === 'permission-denied') {
      showToast('Izin ditolak. Hubungi admin GDSI.', 'error');
    } else {
      showToast('Gagal menyimpan. Coba lagi dalam beberapa saat.', 'error');
    }
  } finally {
    submitLock.unlock();
    setSubmitLoading(false);
  }
}

// Initialize app when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
