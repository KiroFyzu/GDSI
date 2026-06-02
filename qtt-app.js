// qtt-app.js — QTT Submission with FormData Binary Upload + Auto-Compress Fallback
// ============================================================
// Apps Script: Binary Upload Version (FormData, NOT base64)
// Logic:
//   File <=20MB → kirim original via FormData
//   File 20-35MB → coba ffmpeg compress. Gagal → kirim original (aman <50MB)
//   File >35MB → wajib compress. Gagal → error manual
// ============================================================

import { auth, db } from './firebase.js';
import { onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { googleProvider } from './firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { showToast, formatTimestamp, escapeHtml } from './utils.js';

// ============================================
// ⚙️ MAINTENANCE MODE
// ============================================
const MAINTENANCE_MODE = false;

// ============================================
// CONFIG
// ============================================
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyzohhmODuY3JAY3igFrjNPJeVd57lkF4cxeA5yvx4WcidFhp5osBUd7g96-M1u-fMf/exec';
// ^ REPLACE WITH YOUR ACTUAL APPS SCRIPT WEB APP URL

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_EXTS = ['.mp4', '.mov', '.webm'];
const MAX_SIZE_MB = 100;
const COMPRESS_THRESHOLD_MB = 20;
const BASE64_SAFE_MB = 35; // FormData binary ~same size, no base64 bloat

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
  compressionOverlay: $('compression-overlay'),
  compressionText: $('compression-text'),
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
let compressedFile = null;
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
  if (qttData.videoUrl && els.viewVideoLink) {
    els.viewVideoLink.href = qttData.videoUrl;
    els.viewVideoText.textContent = 'Open Video';
    els.viewVideoLink.classList.remove('hidden');
    if (els.videoPreviewContainer && els.viewVideoPreview) {
      els.viewVideoPreview.src = qttData.videoUrl;
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

  if (sizeMB <= COMPRESS_THRESHOLD_MB) {
    // <=20MB: langsung, no compress
    compressedFile = file;
    showFileInfo(file, false);
    previewFile(file);
    showToast(`Video ${sizeMB.toFixed(1)}MB — siap submit`, 'success');
    enableSubmit(true);
  } else if (sizeMB <= BASE64_SAFE_MB) {
    // 20-35MB: coba compress. Gagal → fallback original
    showToast(`Video ${sizeMB.toFixed(1)}MB — mengompres...`, 'info', 3000);
    try {
      compressedFile = await tryCompress(file);
      const finalMB = compressedFile.size / (1024 * 1024);
      showToast(`Kompresi OK: ${finalMB.toFixed(1)}MB`, 'success');
      showFileInfo(compressedFile, true);
      previewFile(compressedFile);
      enableSubmit(true);
    } catch (err) {
      console.warn('Compress failed, fallback to original:', err);
      compressedFile = file;
      showToast(`Kompresi gagal, pakai original ${sizeMB.toFixed(1)}MB`, 'warning');
      showFileInfo(file, false);
      previewFile(file);
      enableSubmit(true);
    }
  } else {
    // >35MB: wajib kompresi
    showToast(`Video ${sizeMB.toFixed(1)}MB — wajib kompresi...`, 'info', 4000);
    try {
      compressedFile = await tryCompress(file);
      const finalMB = compressedFile.size / (1024 * 1024);
      showToast(`Kompresi OK: ${finalMB.toFixed(1)}MB`, 'success');
      showFileInfo(compressedFile, true);
      previewFile(compressedFile);
      enableSubmit(true);
    } catch (err) {
      console.error('Compress failed (file >35MB):', err);
      showError('Gagal kompres video. File terlalu besar. Kompres manual di HP (export 720p) lalu coba lagi.');
      selectedFile = null;
      compressedFile = null;
      return;
    }
  }
}

// ============================================
// FFMPEG COMPRESSION (Lazy Load)
// ============================================
async function tryCompress(file) {
  let FFmpeg, fetchFile;

  try {
    const ffmpegMod = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
    const utilMod = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
    FFmpeg = ffmpegMod.FFmpeg;
    fetchFile = utilMod.fetchFile;
  } catch (importErr) {
    throw new Error('Failed to load ffmpeg module: ' + importErr.message);
  }

  const ffmpeg = new FFmpeg();
  showCompression(true, 'Loading ffmpeg... (pertama kali, ~24MB)');

  try {
    await ffmpeg.load();
    console.log('[ffmpeg] load OK');
  } catch (loadErr) {
    console.error('[ffmpeg] load failed:', loadErr);
    showCompression(false);
    throw new Error('ffmpeg load failed: ' + loadErr.message);
  }

  showCompression(true, 'Mengompres video...');
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.mp4';
  const inputName = 'input' + ext;
  const outputName = 'output.mp4';

  try {
    console.log('[ffmpeg] writing file...');
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    console.log('[ffmpeg] write OK');
  } catch (writeErr) {
    console.error('[ffmpeg] write failed:', writeErr);
    showCompression(false);
    throw new Error('ffmpeg write failed: ' + writeErr.message);
  }

  const sizeMB = file.size / (1024 * 1024);
  let crf = '30', scale = 'scale=-2:480';
  if (sizeMB > 80) { crf = '33'; scale = 'scale=-2:360'; }
  else if (sizeMB > 50) { crf = '32'; scale = 'scale=-2:420'; }
  else if (sizeMB <= 35) { crf = '28'; scale = 'scale=-2:540'; }

  ffmpeg.on('progress', ({ progress }) => {
    const pct = Math.min(Math.round(progress * 100), 99);
    showCompression(true, `Mengompres... ${pct}%`);
  });

  try {
    console.log('[ffmpeg] exec start, CRF=' + crf + ', scale=' + scale);
    await ffmpeg.exec([
      '-i', inputName, '-c:v', 'libx264', '-crf', crf, '-preset', 'fast',
      '-vf', scale, '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', '-y', outputName
    ]);
    console.log('[ffmpeg] exec OK');
  } catch (execErr) {
    console.error('[ffmpeg] exec failed:', execErr);
    showCompression(false);
    throw new Error('ffmpeg exec failed: ' + execErr.message);
  }

  try {
    console.log('[ffmpeg] reading output...');
    const data = await ffmpeg.readFile(outputName);
    console.log('[ffmpeg] read OK, size:', data.byteLength);
    const compressed = new File([data], file.name.replace(/\.[^.]+$/, '_compressed.mp4'), { type: 'video/mp4' });

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
    showCompression(false);
    return compressed;
  } catch (readErr) {
    console.error('[ffmpeg] read failed:', readErr);
    showCompression(false);
    throw new Error('ffmpeg read failed: ' + readErr.message);
  }
}

function showCompression(show, text = '') {
  if (els.compressionOverlay) els.compressionOverlay.style.display = show ? 'flex' : 'none';
  if (els.compressionText) els.compressionText.textContent = text;
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
  compressedFile = null;
  if (els.fileInput) els.fileInput.value = '';
  if (els.uploadPlaceholder) els.uploadPlaceholder.classList.remove('hidden');
  if (els.uploadFileInfo) els.uploadFileInfo.classList.add('hidden');
  els.uploadZone?.classList.remove('has-file', 'error');
  els.previewContainer?.classList.add('hidden');
  if (els.videoPreview) els.videoPreview.src = '';
  enableSubmit(false);
  clearError();
  showCompression(false);
}

function clearFileState() {
  selectedFile = null;
  compressedFile = null;
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
// QTT SUBMISSION — FORMDATA BINARY (NOT base64)
// ============================================
async function handleQttSubmit() {
  if (MAINTENANCE_MODE) { showToast('QTT sedang ditutup sementara.', 'warning'); return; }
  if (!compressedFile || !currentUser || !registrationData) return;
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
    showToast('Mengupload video, mohon tunggu...', 'info', 3000);

    // Build FormData with binary file
    const formData = new FormData();
    formData.append('action', 'qtt_submit');
    formData.append('uid', currentUser.uid);
    formData.append('username', registrationData.usernameId);
    formData.append('vehicle', registrationData.car);
    formData.append('engine', registrationData.engine);
    formData.append('country', registrationData.country);
    formData.append('email', currentUser.email || '');
    formData.append('videoName', compressedFile.name);
    formData.append('videoMime', compressedFile.type || 'video/mp4');
    formData.append('videoFile', compressedFile); // ← BINARY BLOB, not base64!

    console.log('[submit] FormData built, file size:', compressedFile.size);

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // NO Content-Type header! Browser sets it automatically with boundary for FormData
      body: formData
    });

    console.log('[submit] response status:', response.status);
    const result = await response.json();
    console.log('[submit] result:', result);

    if (!result.success) throw new Error(result.error || 'Upload failed');

    const qttData = {
      uid: currentUser.uid,
      videoUrl: result.videoUrl,
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
    els.submitBtn.disabled = !compressedFile || MAINTENANCE_MODE;
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
