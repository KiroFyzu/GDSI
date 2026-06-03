// qtt-app.js — QTT Submission via Cloudinary (Backup) + Google Drive (Primary)
// ============================================================
// Flow:
//   Frontend → Cloudinary Upload (unsigned, auto folder per user)
//            → Dapat URL + public_id
//            → Kirim URL ke Apps Script (payload ~2KB)
//            → Apps Script: download URL → save ke GD folder
//            → Firestore (simpan GD link)
//
// Cloudinary: video tetap tersimpan di folder gdsi_qtt/Username/ sebagai backup
// Google Drive: primary storage, link yang dishare
// ============================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { googleProvider } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { showToast, formatTimestamp, escapeHtml } from './utils.js';

// ============================================
// ⚙️ MAINTENANCE MODE
// ============================================
const MAINTENANCE_MODE = import.meta.env.VITE_QTT_MAINTENANCE_MODE === 'true';

// ============================================
// CONFIG
// ============================================
const APPS_SCRIPT_URL = import.meta.env.VITE_GDSI_APPS_SCRIPT_URL;
// ^ REPLACE WITH YOUR ACTUAL APPS SCRIPT WEB APP URL

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;           // ← GANTI
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // ← GANTI

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_EXTS = ['.mp4', '.mov', '.webm'];
const MAX_SIZE_MB = 100;

// ============================================
// DOM REFERENCES
// ============================================
function $(id) { return document.getElementById(id); }

const els = {
  authOverlay: $('auth-overlay'),
  profileName: $('profile-name'),
  profileAvatar: $('profile-avatar'),
  loginBtn: $('login-btn'),
  logoutBtn: $('logout-btn'),
  loadingState: $('loading-state'),
  submitMode: $('submit-mode'),
  viewMode: $('view-mode'),
  errorState: $('error-state'),
  maintenanceBanner: $('maintenance-banner'),
  dispUsername: $('disp-username'),
  dispVehicle: $('disp-vehicle'),
  dispEngine: $('disp-engine'),
  dispCountry: $('disp-country'),
  viewUsername: $('view-username'),
  viewVehicle: $('view-vehicle'),
  viewEngine: $('view-engine'),
  viewCountry: $('view-country'),
  viewSubmittedAt: $('view-submitted-at'),
  viewStatus: $('view-status'),
  viewVideoLink: $('view-video-link'),
  viewVideoText: $('view-video-text'),
  videoPreviewContainer: $('video-preview-container'),
  viewVideoPreview: $('view-video-preview'),
  uploadZone: $('upload-zone'),
  fileInput: $('video-file-input'),
  uploadPlaceholder: $('upload-placeholder'),
  uploadFileInfo: $('upload-file-info'),
  fileName: $('file-name'),
  fileSize: $('file-size'),
  removeFileBtn: $('remove-file-btn'),
  uploadError: $('upload-error'),
  errorMessage: $('error-message'),
  previewContainer: $('preview-container'),
  videoPreview: $('video-preview'),
  cloudinaryOverlay: $('cloudinary-overlay'),
  cloudinaryText: $('cloudinary-text'),
  cloudinaryProgress: $('cloudinary-progress'),
  submitBtn: $('qtt-submit-btn'),
  submitText: $('submit-text'),
  submitSpinner: $('submit-spinner'),
  modalSuccess: $('modal-success'),
  modalUsername: $('modal-username'),
  modalVehicle: $('modal-vehicle'),
  modalEngine: $('modal-engine'),
  modalDate: $('modal-date')
};

let currentUser = null;
let registrationData = null;
let selectedFile = null;
let cloudinaryUrl = null;
let cloudinaryOriginalUrl = null;
let cloudinaryPublicId = null;
let isSubmitting = false;

// ============================================
// INIT
// ============================================
function init() {
  if (MAINTENANCE_MODE) showMaintenanceMode();
  els.loginBtn?.addEventListener('click', handleLogin);
  els.logoutBtn?.addEventListener('click', handleLogout);
  initUpload();
  initModals();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      updateProfileBar(user);
      hideAuthOverlay();
      if (!MAINTENANCE_MODE) await loadParticipantData(user.uid);
      else showLoading(false);
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
  els.maintenanceBanner?.classList.remove('hidden');
  if (els.submitBtn) {
    els.submitBtn.disabled = true;
    els.submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    els.submitBtn.title = 'QTT sedang ditutup sementara';
  }
  els.uploadZone?.classList.add('pointer-events-none', 'opacity-50');
  els.uploadZone?.setAttribute('title', 'QTT sedang ditutup sementara');
}

// ============================================
// AUTH
// ============================================
async function handleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    showToast(`Selamat datang, ${result.user.displayName || 'Racer'}!`, 'success');
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') showToast('Login dibatalkan', 'warning');
    else if (err.code === 'auth/network-request-failed') showToast('Koneksi bermasalah. Cek internet Anda.', 'error');
    else showToast('Login gagal. Coba lagi.', 'error');
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

function showAuthOverlay() { els.authOverlay?.classList.remove('hidden'); }
function hideAuthOverlay() { els.authOverlay?.classList.add('hidden'); }
function showLoading(show) { if (els.loadingState) els.loadingState.style.display = show ? 'flex' : 'none'; }

// ============================================
// LOAD PARTICIPANT DATA
// ============================================
async function loadParticipantData(uid) {
  showLoading(true);
  els.submitMode?.classList.add('hidden');
  els.viewMode?.classList.add('hidden');
  els.errorState?.classList.add('hidden');

  try {
    const regRef = doc(db, 'users', uid);
    const regSnap = await getDoc(regRef);
    if (!regSnap.exists() || !regSnap.data().isRegistered) {
      showErrorState();
      showLoading(false);
      return;
    }
    registrationData = regSnap.data();
    const qttRef = doc(db, 'qtt_submissions', uid);
    const qttSnap = await getDoc(qttRef);

    if (qttSnap.exists()) showViewMode(registrationData, qttSnap.data());
    else if (!MAINTENANCE_MODE) showSubmitMode(registrationData);
    else showMaintenanceSubmitState();
    showLoading(false);
  } catch (err) {
    console.error('Load data error:', err);
    showToast('Gagal memuat data. Coba lagi.', 'error');
    showLoading(false);
  }
}

function showViewMode(userData, qttData) {
  els.viewMode?.classList.remove('hidden');
  els.submitMode?.classList.add('hidden');
  els.errorState?.classList.add('hidden');
  if (els.viewUsername) els.viewUsername.textContent = userData.usernameId || '-';
  if (els.viewVehicle) els.viewVehicle.textContent = userData.car || '-';
  if (els.viewEngine) els.viewEngine.textContent = userData.engine || '-';
  if (els.viewCountry) els.viewCountry.textContent = userData.country || '-';
  if (els.viewSubmittedAt) els.viewSubmittedAt.textContent = formatTimestamp(qttData.submittedAt);
  if (els.viewStatus) els.viewStatus.textContent = qttData.submissionStatus || 'Submitted';

  // Prioritize Cloudinary URL for preview (fallback: videoUrl, gdUrl)
  const cloudinaryUrl = qttData.cloudinaryUrl || qttData.cloudinaryOriginalUrl || '';
  const videoUrl = cloudinaryUrl || qttData.videoUrl || '';

  if (videoUrl && els.viewVideoLink) {
    els.viewVideoLink.href = videoUrl;
    els.viewVideoLink.target = '_blank';
    els.viewVideoText.textContent = cloudinaryUrl ? 'Open Video (Cloudinary)' : 'Open Video';
    els.viewVideoLink.classList.remove('hidden');
    if (els.videoPreviewContainer && els.viewVideoPreview) {
      els.viewVideoPreview.src = videoUrl;
      els.videoPreviewContainer.classList.remove('hidden');
    }
  } else {
    els.viewVideoLink?.classList.add('hidden');
    els.videoPreviewContainer?.classList.add('hidden');
  }
}

function showSubmitMode(data) {
  els.submitMode?.classList.remove('hidden');
  els.viewMode?.classList.add('hidden');
  els.errorState?.classList.add('hidden');
  if (els.dispUsername) els.dispUsername.value = data.usernameId || '-';
  if (els.dispVehicle) els.dispVehicle.value = data.car || '-';
  if (els.dispEngine) els.dispEngine.value = data.engine || '-';
  if (els.dispCountry) els.dispCountry.value = data.country || '-';
}

function showMaintenanceSubmitState() {
  els.submitMode?.classList.remove('hidden');
  els.viewMode?.classList.add('hidden');
  els.errorState?.classList.add('hidden');
  if (els.dispUsername) els.dispUsername.value = registrationData?.usernameId || '-';
  if (els.dispVehicle) els.dispVehicle.value = registrationData?.car || '-';
  if (els.dispEngine) els.dispEngine.value = registrationData?.engine || '-';
  if (els.dispCountry) els.dispCountry.value = registrationData?.country || '-';
  const inputs = els.submitMode?.querySelectorAll('input, select, button');
  inputs?.forEach(input => { input.disabled = true; input.classList.add('opacity-50', 'cursor-not-allowed'); });
}

function showErrorState() {
  els.errorState?.classList.remove('hidden');
  els.submitMode?.classList.add('hidden');
  els.viewMode?.classList.add('hidden');
}

// ============================================
// UPLOAD HANDLING
// ============================================
function initUpload() {
  if (!els.uploadZone || !els.fileInput || MAINTENANCE_MODE) return;

  els.uploadZone.addEventListener('click', (e) => {
    if (e.target !== els.removeFileBtn) els.fileInput.click();
  });
  els.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
  });
  els.uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); els.uploadZone.classList.add('dragover'); });
  els.uploadZone.addEventListener('dragleave', () => els.uploadZone.classList.remove('dragover'));
  els.uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  });
  els.removeFileBtn?.addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });
  els.submitBtn?.addEventListener('click', handleQttSubmit);
}

async function handleFileSelect(file) {
  if (MAINTENANCE_MODE) return;
  clearError();
  clearFileState();

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!isValidType) { showError('Invalid file type. Only .mp4, .mov, .webm allowed.'); return; }
  if (file.size / (1024*1024) > MAX_SIZE_MB) { showError(`File too large. Max ${MAX_SIZE_MB}MB.`); return; }

  selectedFile = file;
  const sizeMB = file.size / (1024 * 1024);

  showFileInfo(file, false);
  previewFile(file);
  showToast(`Video ${sizeMB.toFixed(1)}MB — siap upload ke Cloudinary`, 'success');
  enableSubmit(true);
}

// ============================================
// CLOUDINARY UPLOAD
// ============================================
async function uploadToCloudinary(file, username) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `gdsi_qtt/${sanitizeFolderName(username)}`);
  formData.append('resource_type', 'video');
  formData.append('tags', 'gdsi,qtt,2026');

  showCloudinary(true, 'Uploading to Cloudinary...', 0);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        showCloudinary(true, `Uploading to Cloudinary... ${pct}%`, pct);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        console.log('[Cloudinary] upload OK:', result);
        showCloudinary(false, '', 0);
        // Build compressed URL with auto-quality transformation
        // q_auto:eco = agresif compress, w_1280 = 720p max, vc_h264 = optimal codec
        const baseUrl = result.secure_url;
        const compressedUrl = baseUrl.replace('/upload/', '/upload/q_auto:eco,w_1280,vc_h264/');

        resolve({
          url: compressedUrl,        // ← URL compressed (20-30MB untuk file 100MB)
          originalUrl: baseUrl,      // ← backup URL original
          publicId: result.public_id,
          folder: result.folder
        });
      } else {
        console.error('[Cloudinary] upload failed:', xhr.status, xhr.responseText);
        showCloudinary(false, '', 0);
        reject(new Error('Cloudinary upload failed: ' + xhr.status));
      }
    });

    xhr.addEventListener('error', () => {
      showCloudinary(false, '', 0);
      reject(new Error('Cloudinary upload network error'));
    });

    xhr.open('POST', url);
    xhr.send(formData);
  });
}

function sanitizeFolderName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

function showCloudinary(show, text = '', progress = 0) {
  if (els.cloudinaryOverlay) els.cloudinaryOverlay.style.display = show ? 'flex' : 'none';
  if (els.cloudinaryText) els.cloudinaryText.textContent = text;
  if (els.cloudinaryProgress) {
    els.cloudinaryProgress.style.width = progress + '%';
    els.cloudinaryProgress.classList.toggle('hidden', !show);
  }
}

// ============================================
// FILE UI
// ============================================
function showFileInfo(file, isCompressed) {
  if (els.uploadPlaceholder) els.uploadPlaceholder.classList.add('hidden');
  if (els.uploadFileInfo) {
    els.uploadFileInfo.classList.remove('hidden');
    if (els.fileName) els.fileName.textContent = file.name + (isCompressed ? ' (compressed)' : '');
    if (els.fileSize) els.fileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
  }
  els.uploadZone?.classList.add('has-file');
}

function previewFile(file) {
  const url = URL.createObjectURL(file);
  if (els.videoPreview) {
    els.videoPreview.src = url;
    els.previewContainer?.classList.remove('hidden');
  }
}

function clearFile() {
  selectedFile = null;
  cloudinaryUrl = null;
  cloudinaryOriginalUrl = null;
  cloudinaryPublicId = null;
  if (els.fileInput) els.fileInput.value = '';
  if (els.uploadPlaceholder) els.uploadPlaceholder.classList.remove('hidden');
  if (els.uploadFileInfo) els.uploadFileInfo.classList.add('hidden');
  els.uploadZone?.classList.remove('has-file', 'error');
  els.previewContainer?.classList.add('hidden');
  if (els.videoPreview) els.videoPreview.src = '';
  enableSubmit(false);
  clearError();
  showCloudinary(false, '', 0);
}

function clearFileState() {
  selectedFile = null;
  cloudinaryUrl = null;
  cloudinaryOriginalUrl = null;
  cloudinaryPublicId = null;
}

function showError(msg) {
  if (els.uploadError) {
    els.uploadError.classList.remove('hidden');
    if (els.errorMessage) els.errorMessage.textContent = msg;
  }
  els.uploadZone?.classList.add('error');
}

function clearError() {
  els.uploadError?.classList.add('hidden');
  els.uploadZone?.classList.remove('error');
}

function enableSubmit(enabled) {
  if (els.submitBtn) els.submitBtn.disabled = !enabled || MAINTENANCE_MODE;
}

// ============================================
// QTT SUBMISSION — CLOUDINARY → GD
// ============================================
async function handleQttSubmit() {
  if (MAINTENANCE_MODE) { showToast('QTT sedang ditutup sementara.', 'warning'); return; }
  if (!selectedFile || !currentUser || !registrationData) return;
  if (isSubmitting) return;

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
    // STEP 1: Upload to Cloudinary (with progress)
    if (!cloudinaryUrl) {
      showToast('Mengupload ke Cloudinary...', 'info', 3000);
      const cloudResult = await uploadToCloudinary(selectedFile, registrationData.usernameId);
      cloudinaryUrl = cloudResult.url;            // ← compressed URL (q_auto:eco)
      cloudinaryOriginalUrl = cloudResult.originalUrl;  // ← original URL (backup)
      cloudinaryPublicId = cloudResult.publicId;
      showToast('Upload Cloudinary OK!', 'success');
    }

    // STEP 2: Send URL to Apps Script (payload kecil, 2KB)
    showToast('Mengirim ke Google Drive...', 'info', 3000);
    const formData = new FormData();
    formData.append('action', 'qtt_submit');
    formData.append('uid', currentUser.uid);
    formData.append('username', registrationData.usernameId);
    formData.append('vehicle', registrationData.car);
    formData.append('engine', registrationData.engine);
    formData.append('country', registrationData.country);
    formData.append('email', currentUser.email || '');
    formData.append('videoUrl', cloudinaryUrl);              // ← compressed URL for download
    formData.append('originalUrl', cloudinaryOriginalUrl || '');  // ← original URL (backup)
    formData.append('publicId', cloudinaryPublicId || '');
    formData.append('videoName', selectedFile.name);
    formData.append('videoMime', selectedFile.type || 'video/mp4');

    console.log('[submit] sending to Apps Script, URL:', cloudinaryUrl);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: formData
    });

    console.log('[submit] response status:', response.status);
    const result = await response.json();
    console.log('[submit] result:', result);

    if (!result.success) throw new Error(result.error || 'Upload failed');

    // STEP 3: Save metadata to Firestore (GD link as primary)
    const qttData = {
      uid: currentUser.uid,
      videoUrl: cloudinaryUrl,          // ← Cloudinary link (primary, for preview & open)
      cloudinaryUrl: cloudinaryUrl,   // ← explicit Cloudinary field (for backward compat)
      gdUrl: result.videoUrl,           // ← GD link (backup, for admin)
      cloudinaryOriginalUrl: cloudinaryOriginalUrl || '',  // ← Cloudinary original (backup 2)
      cloudinaryPublicId: cloudinaryPublicId || '',
      submittedAt: serverTimestamp(),
      submissionStatus: 'submitted',
      fileName: result.fileName,
      fileSize: result.fileSize
    };

    await setDoc(doc(db, 'qtt_submissions', currentUser.uid), qttData);
    showToast('QTT submitted successfully!', 'success');
    showSuccessModal({
      username: registrationData.usernameId,
      vehicle: registrationData.car,
      engine: registrationData.engine
    });
    setTimeout(() => loadParticipantData(currentUser.uid), 2000);
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
    els.submitText?.classList.add('hidden');
    els.submitSpinner?.classList.remove('hidden');
  } else {
    els.submitBtn.disabled = !selectedFile || MAINTENANCE_MODE;
    els.submitBtn.classList.remove('opacity-80', 'cursor-wait');
    els.submitText?.classList.remove('hidden');
    els.submitSpinner?.classList.add('hidden');
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
      if (e.target === backdrop) { backdrop.classList.add('hidden'); document.body.style.overflow = ''; }
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
