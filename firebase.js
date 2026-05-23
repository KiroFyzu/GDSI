// firebase.js - Firebase v9 Modular Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// ============================================
// KONFIGURASI FIREBASE - GANTI DENGAN MILIKMU
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyBT78SupL8dxOyPRenFoxLdfyFG9NeJbA8",
  authDomain: "gdsi-registration.firebaseapp.com",
  projectId: "gdsi-registration",
  storageBucket: "gdsi-registration.firebasestorage.app",
  messagingSenderId: "826400626073",
  appId: "1:826400626073:web:2d0e6095b07dc9837caf08"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Scope tambahan jika diperlukan
googleProvider.addScope('email');
googleProvider.addScope('profile');
