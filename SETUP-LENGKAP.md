# 🏎️ GDSI QTT — Setup Lengkap & Troubleshoot

## 🔴 Masalah: QTT Putih + "Gagal Memuat Data"

### Penyebab Utama
| Error | Penyebab | Solusi |
|-------|----------|--------|
| `permission-denied` | Firestore Rules belum allow read ke `users/{uid}` | Update Rules |
| `Missing or insufficient permissions` | Rules default block semua | Update Rules |
| QTT putih/blank | Auth sukses tapi Firestore gagal → nggak ada data | Fix Rules |

---

## 🛠️ STEP 1: Update Firestore Rules (WAJIB!)

### Cara:
1. Buka [Firebase Console](https://console.firebase.google.com)
2. Pilih project GDSI-mu
3. Kiri sidebar → **Firestore Database** → **Rules**
4. Hapus semua kode lama
5. **Paste kode di bawah ini**
6. Klik **Publish**

### Firestore Rules Final (dengan QTT support):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isValidString(val, minLen, maxLen) {
      return val is string
        && val.size() >= minLen
        && val.size() <= maxLen;
    }

    function isValidUsername(username) {
      return username.matches('^[a-zA-Z0-9_]+#\d{4}$');
    }

    function isValidEngine(engine) {
      return engine in ['ProDrift', 'SR', '2JZ', 'V6TT', 'V8S', 'V8na', 'ROTARY'];
    }

    function isValidWhatsApp(wa) {
      return wa.matches('^\+\d{7,18}$');
    }

    // ============================================
    // USERS COLLECTION — Source of Truth
    // ============================================
    match /users/{userId} {
      allow read: if isOwner(userId);

      allow create: if isOwner(userId)
        && !exists(/databases/$(database)/documents/users/$(userId))
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.isRegistered == true
        && isValidString(request.resource.data.name, 1, 100)
        && isValidString(request.resource.data.clubTeam, 1, 100)
        && isValidString(request.resource.data.car, 1, 100)
        && isValidString(request.resource.data.country, 1, 100)
        && isValidUsername(request.resource.data.usernameId)
        && isValidEngine(request.resource.data.engine)
        && isValidWhatsApp(request.resource.data.whatsapp)
        && request.resource.data.registeredAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if false;
      allow delete: if false;
    }

    // ============================================
    // USERNAMES COLLECTION
    // ============================================
    match /usernames/{username} {
      allow read: if true;

      allow create: if isAuthenticated()
        && request.resource.data.uid == request.auth.uid
        && !exists(/databases/$(database)/documents/usernames/$(username));

      allow update: if false;
      allow delete: if false;
    }

    // ============================================
    // QTT SUBMISSIONS — Metadata Only
    // ============================================
    match /qtt_submissions/{userId} {
      allow read: if isOwner(userId);

      allow create: if isOwner(userId)
        && !exists(/databases/$(database)/documents/qtt_submissions/$(userId))
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.keys().hasAll(['videoUrl', 'submittedAt', 'submissionStatus'])
        && !request.resource.data.keys().hasAny(['username', 'vehicle', 'engine', 'country', 'name', 'email'])
        && request.resource.data.submissionStatus in ['submitted', 'reviewed', 'scored']
        && request.resource.data.videoUrl is string
        && request.resource.data.videoUrl.size() > 0;

      allow update: if false;
      allow delete: if false;
    }

    // ============================================
    // DEFAULT — Deny everything else
    // ============================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 🛠️ STEP 2: Update Apps Script (1 Project, 1 Spreadsheet, 2 Sheets)

### Spreadsheet-mu yang sudah aktif:
- Spreadsheet: `GDSI_Registrations` (atau nama apapun)
- Sheet 1: `GDSI_Registrations` ← udah ada dari form.html
- Sheet 2: `GDSI_QTT_Submissions` ← baru, auto-create

### Cara Update:
1. Buka spreadsheet yang sudah aktif
2. **Extensions** → **Apps Script**
3. Ini project yang sama dipakai `form.html`
4. **Hapus semua kode lama**
5. **Paste kode dari `gdsi-apps-script.gs`**
6. **Ganti CONFIG:**
   ```javascript
   var CONFIG = {
     PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
     EVENT_FOLDER_NAME: "Event_2026_Q1",  // ← GANTI per event
   };
   ```
7. **Deploy** → **Manage deployments** → **Edit** → **New version**
8. URL tetap SAMA

---

## 🛠️ STEP 3: Upload File ke Hosting

### File yang DIGANTI (3 file):
```
qtt.html         → versi baru (ada maintenance banner)
qtt-app.js       → versi baru (base64 upload + maintenance mode)
sheets.js        → versi baru (cuma Registration)
index.html       → versi baru (ada link QTT)
```

### File yang TETAP SAMA (jangan diapa-apain):
```
firebase.js      ← shared init
utils.js         ← shared helpers
countries.js     ← cuma form.html
auth.js          ← cuma form.html
firestore.js     ← cuma form.html
app.js           ← cuma form.html
ui.js            ← cuma form.html
style.css        ← shared styles
form.html        ← sudah final
gdsi_rules.html ← static
gdsi_tnc.html   ← static
```

---

## 🛠️ STEP 4: Test Flow

| Step | Expected Result |
|------|----------------|
| 1. Buka index.html | Ada tombol "QTT Submit" |
| 2. Klik QTT Submit | Pindah ke qtt.html |
| 3. Login Google | Profile bar muncul |
| 4. Belum registrasi | Error: "Registrasi Tidak Ditemukan" |
| 5. Sudah registrasi | Submit Mode muncul |
| 6. Upload video + Submit | Success modal |
| 7. Refresh | View Mode (sudah submit) |

---

## 🔒 Maintenance Mode (1 Baris Ganti)

Di `qtt-app.js` baris 14:

```javascript
// TUTUP QTT:
const MAINTENANCE_MODE = true;

// BUKA QTT:
const MAINTENANCE_MODE = false;
```

Save → upload → done.

---

## 🐛 Troubleshooting Lengkap

| Problem | Penyebab | Solusi |
|---------|----------|--------|
| QTT putih setelah login | Firestore Rules belum update | Update rules (Step 1) |
| "Gagal memuat data" | Rules nggak allow read users/{uid} | Cek rules, publish ulang |
| "Permission denied" saat submit | Rules nggak allow write qtt_submissions | Cek rules QTT section |
| Video nggak ke-upload | Apps Script URL salah | Cek URL, deploy ulang |
| Sheet QTT nggak ke-create | Apps Script nggak jalan | Cek execution log |
| CORS error | Deploy access bukan "Anyone" | Redeploy dengan "Anyone" |
| Base64 terlalu lama | File besar (>50MB) | Normal, tunggu aja |
| Maintenance mode nggak jalan | Browser cache | Hard refresh (Ctrl+Shift+R) |

---

## 📁 Struktur Folder Drive (Otomatis)

```
📁 GDSI_QTT_Videos/                    ← auto-create
└── 📁 Event_2026_Q1/                  ← dari CONFIG.EVENT_FOLDER_NAME
    ├── 📁 RacerOne_abc12345/
    │   └── 🎥 RacerOne_20260603_143022.mp4
    └── 📁 DriftKing_def67890/
        └── 🎥 DriftKing_20260603_151530.mp4
```

---

## 📊 Arsitektur Data Final

```
┌─────────────────────────────────────────────┐
│  GOOGLE SPREADSHEET (1 file, 2 sheets)      │
│  ├── GDSI_Registrations      ← form.html     │
│  └── GDSI_QTT_Submissions    ← qtt.html      │
└─────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (1 project)             │
│  ├── handleRegistration() → Sheet Regis     │
│  └── handleQttSubmit() → Drive + Sheet QTT  │
└─────────────────────────────────────────────┘
                    ↑
┌─────────────────────────────────────────────┐
│  FRONTEND                                   │
│  ├── form.html → Registration               │
│  ├── qtt.html → QTT Submission              │
│  └── index.html → Landing + Links           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  FIRESTORE                                  │
│  ├── users/{uid} → source of truth          │
│  └── qtt_submissions/{uid} → metadata only  │
└─────────────────────────────────────────────┘
```

---

**Built for GDSI — Grand Drift Series Indonesia**
