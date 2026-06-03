// auth.js - Firebase Authentication Logic
import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { showToast } from './utils.js';
import { setFormMode, updateProfileBar, showAuthOverlay, hideAuthOverlay } from './ui.js';
import { checkRegistration } from './firestore.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      updateProfileBar(user);
      hideAuthOverlay();

      try {
        const existing = await checkRegistration(user.uid);
        if (existing && existing.isRegistered) {
          setFormMode('readonly', existing);
          showToast('Data registrasi ditemukan. Form dalam mode read-only.', 'info', 5000);
        } else {
          setFormMode('editable');
        }
      } catch (err) {
        console.error('Auth state check error:', err);
        showToast('Gagal memeriksa status registrasi', 'error');
        setFormMode('editable');
      }
    } else {
      currentUser = null;
      setFormMode('locked');
      showAuthOverlay();
    }
  });
}

export async function login() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;
    showToast(`Selamat datang, ${result.user.displayName || 'Racer'}!`, 'success');
  } catch (err) {
    console.error('Login error:', err);
    if (err.code === 'auth/popup-closed-by-user') {
      showToast('Login dibatalkan', 'warning');
    } else if (err.code === 'auth/network-request-failed') {
      showToast('Koneksi bermasalah. Cek internet Anda.', 'error');
    } else {
      showToast('Login gagal. Coba lagi.', 'error');
    }
  }
}

export async function logout() {
  try {
    await signOut(auth);
    showToast('Berhasil logout', 'info');
  } catch (err) {
    console.error('Logout error:', err);
    showToast('Logout gagal', 'error');
  }
}
