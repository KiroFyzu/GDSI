// qtt-app.js — QTT Submission Application (FINAL)
// ============================================================
// Architecture:
//   Frontend → Apps Script Web App (JSON + base64 video) → Google Drive + Sheets
//   After success → Firestore (metadata ONLY, no participant data duplication)
//
// MAINTENANCE MODE:
//   Toggle const MAINTENANCE_MODE below to enable/disable QTT submissions
// ============================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { googleProvider } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { showToast, formatTimestamp, escapeHtml } from './utils.js';

// ============================================
// ⚙️ MAINTENANCE MODE — GANTI INI UNTUK ON/OFF
// ============================================
// true  = QTT ditutup, participant lihat maintenance banner
// false = QTT dibuka, normal operation
const MAINTENANCE_MODE = false;

// ============================================
// CONFIG
// ============================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyzohhmODuY3JAY3igFrjNPJeVd57lkF4cxeA5yvx4WcidFhp5osBUd7g96-M1u-fMf/exec';
// ^ REPLACE WITH YOUR ACTUAL APPS SCRIPT WEB APP URL

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_EXTS = ['.mp4', '.mov', '.webm'];
const MAX_SIZE_MB = 100;

// ============================================
// DOM REFERENCES
// ============================================
const els = {
  authOverlay: document.getElementById('auth-overlay'),
  profileName: document.getElementById('profile-name'),
  profileAvatar: document.getElementById('profile-avatar'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  loadingState: document.getElementById('loading-state'),
  submitMode: document.getElementById('submit-mode'),
  viewMode: document.getElementById('view-mode'),
  errorState: document.getElementById('error-state'),
  maintenanceBanner: document.getElementById('maintenance-banner'),
  // Display fields (read-only) — populated from users/{uid}
  dispUsername: document.getElementById('disp-username'),
  dispVehicle: document.getElementById('disp-vehicle'),
  dispEngine: document.getElementById('disp-engine'),
  dispCountry: document.getElementById('disp-country'),
  // View mode fields — populated from users/{uid} + qtt_submissions/{uid}
  viewUsername: document.getElementById('view-username'),
  viewVehicle: document.getElementById('view-vehicle'),
  viewEngine: document.getElementById('view-engine'),
  viewCountry: document.getElementById('view-country'),
  viewSubmittedAt: document.getElementById('view-submitted-at'),
  viewStatus: document.getElementById('view-status'),
  viewVideoLink: document.getElementById('view-video-link'),
  viewVideoText: document.getElementById('view-video-text'),
  videoPreviewContainer: document.getElementById('video-preview-container'),
  viewVideoPreview: document.getElementById('view-video-preview'),
  // Upload
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('video-file-input'),
  uploadPlaceholder: document.getElementById('upload-placeholder'),
  uploadFileInfo: document.getElementById('upload-file-info'),
  fileName: document.getElementById('file-name'),
  fileSize: document.getElementById('file-size'),
  removeFileBtn: document.getElementById('remove-file-btn'),
  uploadError: document.getElementById('upload-error'),
  errorMessage: document.getElementById('error-message'),
  previewContainer: document.getElementById('preview-container'),
  videoPreview: document.getElementById('video-preview'),
  // Submit
  submitBtn: document.getElementById('qtt-submit-btn'),
  submitText: document.getElementById('submit-text'),
  submitSpinner: document.getElementById('submit-spinner'),
  // Modal
  modalSuccess: document.getElementById('modal-success'),
  modalUsername: document.getElementById('modal-username'),
  modalVehicle: document.getElementById('modal-vehicle'),
  modalEngine: document.getElementById('modal-engine'),
  modalDate: document.getElementById('modal-date')
};

// ============================================
// STATE
// ============================================
let currentUser = null;
let registrationData = null;
let selectedFile = null;
let isSubmitting = false;

// ============================================
// INIT
// ============================================
function init() {
  // Check maintenance mode FIRST
  if (MAINTENANCE_MODE) {
    showMaintenanceMode();
  }

  els.loginBtn?.addEventListener('click', handleLogin);
  els.logoutBtn?.addEventListener('click', handleLogout);
  initUpload();
  initModals();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      updateProfileBar(user);
      hideAuthOverlay();

      if (!MAINTENANCE_MODE) {
        await loadParticipantData(user.uid);
      } else {
        showLoading(false);
      }
    } else {
      currentUser = null;
      showAuthOverlay();
      showLoading(false);
    }
  });
}

// ============================================
// MAINTENANCE MODE
// ============================================
function showMaintenanceMode() {
  if (els.maintenanceBanner) {
    els.maintenanceBanner.classList.remove('hidden');
  }
  // Disable submit button permanently
  if (els.submitBtn) {
    els.submitBtn.disabled = true;
    els.submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    els.submitBtn.title = 'QTT sedang ditutup sementara';
  }
  // Disable upload zone
  if (els.uploadZone) {
    els.uploadZone.classList.add('pointer-events-none', 'opacity-50');
    els.uploadZone.title = 'QTT sedang ditutup sementara';
  }
}

// ============================================
// AUTH
// ============================================
async function handleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast(`Selamat datang, ${result.user.displayName || 'Racer'}!`, 'success');
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      showToast('Login dibatalkan', 'warning');
    } else if (err.code === 'auth/network-request-failed') {
      showToast('Koneksi bermasalah. Cek internet Anda.', 'error');
    } else {
      showToast('Login gagal. Coba lagi.', 'error');
    }
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    showToast('Berhasil logout', 'info');
  } catch (err) {
    showToast('Logout gagal', 'error');
  }
}

function updateProfileBar(user) {
  if (els.profileName) els.profileName.textContent = user.displayName || user.email || 'Racer';
  if (els.profileAvatar) {
    if (user.photoURL) {
      els.profileAvatar.innerHTML = `<img src="${escapeHtml(user.photoURL)}" class="w-full h-full object-cover" alt="avatar">`;
    } else {
      els.profileAvatar.innerHTML = '<span class="material-symbols-outlined text-primary text-[20px]">person</span>';
    }
  }
}

function showAuthOverlay() {
  if (els.authOverlay) els.authOverlay.classList.remove('hidden');
}

function hideAuthOverlay() {
  if (els.authOverlay) els.authOverlay.classList.add('hidden');
}

function showLoading(show) {
  if (els.loadingState) els.loadingState.style.display = show ? 'flex' : 'none';
}

// ============================================
// LOAD PARTICIPANT DATA (NO DUPLICATION)
// ============================================
async function loadParticipantData(uid) {
  showLoading(true);
  els.submitMode?.classList.add('hidden');
  els.viewMode?.classList.add('hidden');
  els.errorState?.classList.add('hidden');

  try {
    // STEP 1: Fetch registration data from users/{uid} — ALWAYS source of truth
    const regRef = doc(db, 'users', uid);
    const regSnap = await getDoc(regRef);

    if (!regSnap.exists() || !regSnap.data().isRegistered) {
      showErrorState();
      showLoading(false);
      return;
    }

    registrationData = regSnap.data();

    // STEP 2: Check if QTT already submitted
    const qttRef = doc(db, 'qtt_submissions', uid);
    const qttSnap = await getDoc(qttRef);

    if (qttSnap.exists()) {
      // STEP 3: View Mode — merge data from users/{uid} + qtt_submissions/{uid}
      showViewMode(registrationData, qttSnap.data());
    } else {
      // STEP 4: Submission Mode
      if (!MAINTENANCE_MODE) {
        showSubmitMode(registrationData);
      } else {
        showMaintenanceSubmitState();
      }
    }

    showLoading(false);

  } catch (err) {
    console.error('Load data error:', err);
    showToast('Gagal memuat data. Coba lagi.', 'error');
    showLoading(false);
  }
}

// ============================================
// VIEW MODE (already submitted)
// ============================================
function showViewMode(userData, qttData) {
  if (els.viewMode) els.viewMode.classList.remove('hidden');
  if (els.submitMode) els.submitMode.classList.add('hidden');
  if (els.errorState) els.errorState.classList.add('hidden');

  // Participant info — ALWAYS from users/{uid} (source of truth)
  if (els.viewUsername) els.viewUsername.textContent = userData.usernameId || '-';
  if (els.viewVehicle) els.viewVehicle.textContent = userData.car || '-';
  if (els.viewEngine) els.viewEngine.textContent = userData.engine || '-';
  if (els.viewCountry) els.viewCountry.textContent = userData.country || '-';

  // QTT metadata — from qtt_submissions/{uid}
  if (els.viewSubmittedAt) els.viewSubmittedAt.textContent = formatTimestamp(qttData.submittedAt);
  if (els.viewStatus) els.viewStatus.textContent = qttData.submissionStatus || 'Submitted';

  if (qttData.videoUrl && els.viewVideoLink) {
    els.viewVideoLink.href = qttData.videoUrl;
    els.viewVideoText.textContent = 'Open Video';
    els.viewVideoLink.classList.remove('hidden');

    if (els.videoPreviewContainer && els.viewVideoPreview) {
      if (qttData.videoUrl.match(/\.(mp4|mov|webm)(\?.*)?$/i) || qttData.videoUrl.includes('drive.google.com')) {
        els.viewVideoPreview.src = qttData.videoUrl;
        els.videoPreviewContainer.classList.remove('hidden');
      }
    }
  } else {
    if (els.viewVideoLink) els.viewVideoLink.classList.add('hidden');
    if (els.videoPreviewContainer) els.videoPreviewContainer.classList.add('hidden');
  }
}

// ============================================
// SUBMIT MODE (not yet submitted)
// ============================================
function showSubmitMode(data) {
  if (els.submitMode) els.submitMode.classList.remove('hidden');
  if (els.viewMode) els.viewMode.classList.add('hidden');
  if (els.errorState) els.errorState.classList.add('hidden');

  if (els.dispUsername) els.dispUsername.value = data.usernameId || '-';
  if (els.dispVehicle) els.dispVehicle.value = data.car || '-';
  if (els.dispEngine) els.dispEngine.value = data.engine || '-';
  if (els.dispCountry) els.dispCountry.value = data.country || '-';
}

// ============================================
// MAINTENANCE SUBMIT STATE
// ============================================
function showMaintenanceSubmitState() {
  if (els.submitMode) els.submitMode.classList.remove('hidden');
  if (els.viewMode) els.viewMode.classList.add('hidden');
  if (els.errorState) els.errorState.classList.add('hidden');

  if (els.dispUsername) els.dispUsername.value = registrationData?.usernameId || '-';
  if (els.dispVehicle) els.dispVehicle.value = registrationData?.car || '-';
  if (els.dispEngine) els.dispEngine.value = registrationData?.engine || '-';
  if (els.dispCountry) els.dispCountry.value = registrationData?.country || '-';

  const inputs = els.submitMode?.querySelectorAll('input, select, button');
  inputs?.forEach(input => {
    input.disabled = true;
    input.classList.add('opacity-50', 'cursor-not-allowed');
  });
}

// ============================================
// ERROR STATE (no registration found)
// ============================================
function showErrorState() {
  if (els.errorState) els.errorState.classList.remove('hidden');
  if (els.submitMode) els.submitMode.classList.add('hidden');
  if (els.viewMode) els.viewMode.classList.add('hidden');
}

// ============================================
// UPLOAD HANDLING
// ============================================
function initUpload() {
  if (!els.uploadZone || !els.fileInput) return;
  if (MAINTENANCE_MODE) return;

  els.uploadZone.addEventListener('click', (e) => {
    if (e.target !== els.removeFileBtn) {
      els.fileInput.click();
    }
  });

  els.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  els.uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.uploadZone.classList.add('dragover');
  });

  els.uploadZone.addEventListener('dragleave', () => {
    els.uploadZone.classList.remove('dragover');
  });

  els.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  els.removeFileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  els.submitBtn?.addEventListener('click', handleQttSubmit);
}

function handleFileSelect(file) {
  if (MAINTENANCE_MODE) return;
  clearError();

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);

  if (!isValidType) {
    showError('Invalid file type. Only video files (.mp4, .mov, .webm) are allowed.');
    return;
  }

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_SIZE_MB) {
    showError(`File too large. Maximum ${MAX_SIZE_MB}MB allowed.`);
    return;
  }

  selectedFile = file;
  showFileInfo(file);
  enableSubmit(true);

  const url = URL.createObjectURL(file);
  if (els.videoPreview) {
    els.videoPreview.src = url;
    els.previewContainer?.classList.remove('hidden');
  }
}

function showFileInfo(file) {
  if (els.uploadPlaceholder) els.uploadPlaceholder.classList.add('hidden');
  if (els.uploadFileInfo) {
    els.uploadFileInfo.classList.remove('hidden');
    if (els.fileName) els.fileName.textContent = file.name;
    if (els.fileSize) els.fileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
  }
  if (els.uploadZone) els.uploadZone.classList.add('has-file');
}

function clearFile() {
  selectedFile = null;
  if (els.fileInput) els.fileInput.value = '';
  if (els.uploadPlaceholder) els.uploadPlaceholder.classList.remove('hidden');
  if (els.uploadFileInfo) els.uploadFileInfo.classList.add('hidden');
  if (els.uploadZone) {
    els.uploadZone.classList.remove('has-file', 'error');
  }
  if (els.previewContainer) els.previewContainer.classList.add('hidden');
  if (els.videoPreview) els.videoPreview.src = '';
  enableSubmit(false);
  clearError();
}

function showError(msg) {
  if (els.uploadError) {
    els.uploadError.classList.remove('hidden');
    if (els.errorMessage) els.errorMessage.textContent = msg;
  }
  if (els.uploadZone) els.uploadZone.classList.add('error');
}

function clearError() {
  if (els.uploadError) els.uploadError.classList.add('hidden');
  if (els.uploadZone) els.uploadZone.classList.remove('error');
}

function enableSubmit(enabled) {
  if (els.submitBtn) els.submitBtn.disabled = !enabled || MAINTENANCE_MODE;
}

// ============================================
// HELPER: Convert file to base64
// ============================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove data URL prefix (e.g., "data:video/mp4;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// QTT SUBMISSION (BASE64 → Apps Script)
// ============================================
async function handleQttSubmit() {
  if (MAINTENANCE_MODE) {
    showToast('QTT sedang ditutup sementara.', 'warning');
    return;
  }

  if (!selectedFile || !currentUser || !registrationData) return;
  if (isSubmitting) return;

  // Double-check: ensure no existing submission
  const qttRef = doc(db, 'qtt_submissions', currentUser.uid);
  const qttSnap = await getDoc(qttRef);
  if (qttSnap.exists()) {
    showToast('Anda sudah pernah submit QTT.', 'warning');
    loadParticipantData(currentUser.uid);
    return;
  }

  isSubmitting = true;
  setSubmitLoading(true);

  try {
    showToast('Mengkonversi video, mohon tunggu...', 'info', 3000);

    // STEP 1: Convert video to base64
    const videoBase64 = await fileToBase64(selectedFile);

    // STEP 2: Send JSON payload to Apps Script
    const payload = {
      action: 'qtt_submit',
      uid: currentUser.uid,
      username: registrationData.usernameId,
      vehicle: registrationData.car,
      engine: registrationData.engine,
      country: registrationData.country,
      email: currentUser.email || '',
      videoBase64: videoBase64,
      videoName: selectedFile.name,
      videoMime: selectedFile.type || 'video/mp4'
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',  // ← BISA pake CORS karena sekarang JSON!
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    // STEP 3: Save metadata to Firestore — NO participant data duplication
    const qttData = {
      uid: currentUser.uid,
      videoUrl: result.videoUrl,  // ← REAL URL dari Apps Script!
      submittedAt: serverTimestamp(),
      submissionStatus: 'submitted',
      fileName: result.fileName,
      fileSize: result.fileSize
    };

    await setDoc(doc(db, 'qtt_submissions', currentUser.uid), qttData);

    // STEP 4: Show success
    showToast('QTT submitted successfully!', 'success');
    showSuccessModal({
      username: registrationData.usernameId,
      vehicle: registrationData.car,
      engine: registrationData.engine
    });

    // STEP 5: Switch to view mode
    setTimeout(() => {
      loadParticipantData(currentUser.uid);
    }, 2000);

  } catch (err) {
    console.error('QTT submit error:', err);
    showToast('Gagal mengirim QTT: ' + err.message, 'error');
  } finally {
    isSubmitting = false;
    setSubmitLoading(false);
  }
}

// ============================================
// UI HELPERS
// ============================================
function setSubmitLoading(loading) {
  if (!els.submitBtn) return;
  if (loading) {
    els.submitBtn.disabled = true;
    els.submitBtn.classList.add('opacity-80', 'cursor-wait');
    if (els.submitText) els.submitText.classList.add('hidden');
    if (els.submitSpinner) els.submitSpinner.classList.remove('hidden');
  } else {
    els.submitBtn.disabled = !selectedFile || MAINTENANCE_MODE;
    els.submitBtn.classList.remove('opacity-80', 'cursor-wait');
    if (els.submitText) els.submitText.classList.remove('hidden');
    if (els.submitSpinner) els.submitSpinner.classList.add('hidden');
  }
}

function showSuccessModal(data) {
  if (els.modalSuccess) {
    if (els.modalUsername) els.modalUsername.textContent = data.username || '-';
    if (els.modalVehicle) els.modalVehicle.textContent = data.vehicle || '-';
    if (els.modalEngine) els.modalEngine.textContent = data.engine || '-';
    if (els.modalDate) els.modalDate.textContent = formatTimestamp(new Date());
    els.modalSuccess.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
      document.body.style.overflow = '';
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  });
}

// ============================================
// START
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
