# GDSI Registration System

## Grand Drift Series Indonesia — Official Driver Registration

Sistem registrasi driver berbasis web dengan **Firebase Auth + Firestore**, sinkronisasi ke **Google Sheets**, dan validasi ketat **1 User = 1 Form**.

---

## 📁 Struktur File

```
gdsi-registration/
├── index.html          # Halaman utama (full-page form, no clutter)
├── style.css           # Custom CSS (glassmorphism, racing theme)
├── app.js              # Orchestrator utama & event handlers
├── firebase.js         # Firebase v9 Modular init
├── auth.js             # Google Auth logic (login/logout/state)
├── firestore.js        # Firestore operations (transaction-safe)
├── sheets.js           # Google Sheets sync via Apps Script
├── ui.js               # UI state, modals, country dropdown
├── utils.js            # Validation, sanitization, toast, retry
├── countries.js        # 240 negara dengan kode dial
└── firestore.rules       # Security rules (production ready)
```

---

## 🚀 Setup Firebase

### 1. Buat Project Firebase
- Buka [Firebase Console](https://console.firebase.google.com)
- Buat project baru
- Aktifkan **Authentication** → Google provider
- Aktifkan **Firestore Database** → mode locked/test

### 2. Konfigurasi `firebase.js`
Ganti placeholder di `firebase.js` dengan config project Anda:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Ambil dari: Project Settings → General → Your apps → Web app

### 3. Deploy Firestore Rules
Buka Firebase Console → Firestore Database → Rules.

Copy isi `firestore.rules` ke editor, lalu **Publish**.

Rules ini menjamin:
- **1 UID = 1 dokumen** (tidak bisa overwrite)
- **Email harus match** dengan auth token (anti-spoofing)
- **Username unik** via collection terpisah
- **No update/delete** setelah registrasi (form lock)
- **Field validation** di server-side

### 4. Firestore Indexes (jika diperlukan)
Tidak diperlukan untuk schema flat ini.

---

## 📊 Setup Google Sheets Sync

### Langkah 1: Buat Spreadsheet
- Buat Google Spreadsheet baru
- Rename sheet pertama menjadi: `GDSI_Registrations`
- Atau biarkan default, script akan auto-create

### Langkah 2: Buat Apps Script
- Spreadsheet → Extensions → Apps Script
- Paste kode berikut:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(data.sheetName || 'GDSI_Registrations');

  if (!sheet) {
    sheet = ss.insertSheet(data.sheetName || 'GDSI_Registrations');
    sheet.appendRow([
      'Timestamp', 'UID', 'Name', 'Email', 'WhatsApp',
      'UsernameID', 'ClubTeam', 'Car', 'Engine', 'RegisteredAt'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
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
```

### Langkah 3: Deploy Web App
- Klik **Deploy** → **New deployment**
- Type: **Web app**
- Execute as: **Me**
- Access: **Anyone** (atau **Anyone with Google account**)
- Klik **Deploy** dan copy **Web App URL**

### Langkah 4: Update `sheets.js`
Ganti URL di `sheets.js`:

```javascript
const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **1 UID = 1 Form** | Firestore rules: `!exists()` check + no update/delete |
| **1 Email = 1 Form** | Rules enforce `email == auth.token.email` |
| **Username Unique** | Separate `/usernames` collection + transaction lock |
| **Anti Duplicate** | Firestore transaction atomically checks UID + username |
| **Form Lock** | `readonly` + `disabled` attributes + hidden submit button |
| **XSS Prevention** | `sanitizeInput()` strips tags, `escapeHtml()` for display |
| **Spam Protection** | `SubmitLock` class disables double-click |
| **Race Condition** | Firestore `runTransaction()` atomic write |
| **Network Resilience** | `withRetry()` 3x retry + timeout + offline detection |
| **Input Validation** | Client + Server (Firestore rules) |
| **Trim & Sanitize** | All inputs trimmed, HTML stripped |

---

## 🎨 UI Features

- **Hero UI** — Full-page form, no landing page clutter
- **Glassmorphism** — Backdrop blur, subtle borders
- **Premium Racing** — Red neon glows, dark cinematic background
- **Mobile Optimized** — Responsive grid, touch-friendly inputs
- **240 Countries** — Searchable WhatsApp country dropdown
- **Toast Notifications** — Success, error, warning, info
- **Loading States** — Spinner on submit, disabled inputs
- **Modals** — Success popup (first time) & Info popup (already registered)

---

## 📝 Firestore Schema

```
Collection: users
Document: {uid}
{
  "uid": "abc123",
  "name": "Racer One",
  "email": "racer@email.com",
  "photoURL": "https://...",
  "provider": "google.com",
  "whatsapp": "+628123456789",
  "usernameId": "RacerOne#8888",
  "clubTeam": "Team Drift Jakarta",
  "car": "Nissan Silvia S15",
  "engine": "SR",
  "isRegistered": true,
  "registeredAt": Timestamp,
  "updatedAt": Timestamp
}

Collection: usernames
Document: "racerone#8888" (lowercase)
{
  "uid": "abc123",
  "registeredAt": Timestamp
}
```

---

## 🛠️ Development Notes

### Modular ES Modules
Semua file menggunakan native ES modules (`type="module"`). Tidak perlu bundler untuk development.

### Firebase v9 Modular
Menggunakan syntax tree-shakeable:
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
```

### Hosting
Rekomendasi deploy ke:
- **Firebase Hosting** (paling mudah, same domain)
- **Vercel / Netlify** (jangan lupa tambahkan domain ke Firebase Auth authorized domains)

### CORS
Jika Google Sheets Web App mengalami CORS issue:
1. Pastikan deploy dengan access **Anyone**
2. Atau gunakan `mode: 'no-cors'` di `sheets.js` (response tidak bisa dibaca tapi request tetap terkirim)

---

## ⚠️ Production Checklist

- [ ] Ganti Firebase config dengan project production
- [ ] Deploy Firestore rules
- [ ] Setup Google Apps Script & update URL
- [ ] Tambahkan domain hosting ke Firebase Auth → Authorized domains
- [ ] Enable Firestore backups (daily automated backup)
- [ ] Setup Firebase App Check (anti abuse)
- [ ] Review quota limits (Firestore writes, Auth users)
- [ ] Test dengan multiple akun untuk verify 1-user-1-form logic
- [ ] Test offline mode & retry behavior
- [ ] Test XSS dengan input `<script>alert(1)</script>`

---

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari iOS 14+
- Chrome Android 90+

---

**Built for GDSI — Grand Drift Series Indonesia**
