// firestore.js - Firestore Operations with Transaction Safety
import { db } from './firebase.js';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

/**
 * Check if user already registered
 */
export async function checkRegistration(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}

/**
 * Submit registration using Firestore Transaction
 * Race-condition safe: checks UID and username atomically
 */
export async function submitRegistration(uid, formData) {
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', formData.usernameId.toLowerCase().trim());

  return await runTransaction(db, async (transaction) => {
    // 1. Check if UID already registered
    const userDoc = await transaction.get(userRef);
    if (userDoc.exists() && userDoc.data().isRegistered === true) {
      throw { code: 'already-registered', message: 'Akun ini sudah pernah terdaftar.' };
    }

    // 2. Check username uniqueness (case-insensitive)
    const usernameDoc = await transaction.get(usernameRef);
    if (usernameDoc.exists()) {
      throw { code: 'username-taken', message: 'Username ID sudah digunakan. Pilih yang lain.' };
    }

    const now = serverTimestamp();

    // 3. Write user data
    const userPayload = {
      uid: uid,
      name: formData.name,
      email: formData.email,
      photoURL: formData.photoURL || '',
      provider: formData.provider || 'google',
      whatsapp: formData.whatsapp,
      usernameId: formData.usernameId,
      country: formData.country,
      clubTeam: formData.clubTeam,
      car: formData.car,
      engine: formData.engine,
      isRegistered: true,
      registeredAt: now,
      updatedAt: now
    };

    // 4. Write username reservation
    const usernamePayload = {
      uid: uid,
      registeredAt: now
    };

    transaction.set(userRef, userPayload);
    transaction.set(usernameRef, usernamePayload);

    return userPayload;
  });
}
