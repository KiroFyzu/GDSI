# GDSI QTT Setup Guide

## Quick Start

### 1. Copy File ke Web Hosting

```
📁 root/
├── index.html              ← (tetap)
├── form.html               ← (tetap)
├── qtt.html                ← ✅ GANTI dengan file baru
├── qtt-app.js              ← ✅ GANTI dengan file baru
├── sheets.js               ← ✅ GANTI dengan file baru
├── firebase.js             ← (tetap)
├── utils.js                ← (tetap)
├── auth.js                 ← (tetap)
├── firestore.js            ← (tetap)
├── ui.js                   ← (tetap)
├── app.js                  ← (tetap)
├── countries.js            ← (tetap)
├── style.css               ← (tetap)
├── gdsi_rules.html         ← (tetap)
├── gdsi_tnc.html           ← (tetap)
└── /assets/
    └── gdsi.png            ← (tetap)
```

**Cuma 3 file yang diganti:**
1. `qtt.html` → versi baru (ada maintenance banner)
2. `qtt-app.js` → versi baru (base64 upload + maintenance mode)
3. `sheets.js` → versi baru (cuma Registration, QTT di-handle Apps Script)

---

### 2. Setup Google Apps Script

#### Step 2.1: Buat Project Baru
1. Buka [script.google.com](https://script.google.com)
2. Klik **New Project**
3. Hapus semua kode default
4. Paste isi `gdsi-apps-script.gs`

#### Step 2.2: Ganti Config (WAJIB)
```javascript
var CONFIG = {
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Event_2026_Q1",  // ← GANTI INI per event
};
```

#### Step 2.3: Deploy Web App
1. Klik **Deploy** → **New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Access: **Anyone**
5. Klik **Deploy**
6. Copy **Web App URL**

#### Step 2.4: Update qtt-app.js
```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXX/exec';
// ↑ Paste URL dari Step 2.3
```

---

### 3. Cara Aktifkan Maintenance Mode

**Cuma ganti 1 baris di `qtt-app.js`:**

```javascript
// BARIS 14-15 di qtt-app.js

// QTT DITUTUP (maintenance mode ON):
const MAINTENANCE_MODE = true;

// QTT DIBUKA (normal operation):
const MAINTENANCE_MODE = false;
```

**Efeknya:**
- Banner kuning muncul: "QTT Sedang Ditutup Sementara"
- Upload zone disabled
- Submit button disabled
- Participant yang sudah submit tetap bisa lihat View Mode

---

### 4. Test Flow

| Step | Expected Result |
|------|----------------|
| 1. Buka qtt.html | Muncul overlay login |
| 2. Login Google | Profile bar muncul |
| 3. Belum registrasi | Error state: "Registrasi Tidak Ditemukan" |
| 4. Sudah registrasi, belum QTT | Submit Mode muncul |
| 5. Upload video + Submit | Success modal, lalu View Mode |
| 6. Refresh page | View Mode (sudah submit) |
| 7. MAINTENANCE_MODE = true | Banner kuning, submit disabled |

---

### 5. Folder Structure di Google Drive

```
📁 GDSI_QTT_Videos/                    ← PARENT_FOLDER_NAME
└── 📁 Event_2026_Q1/                  ← EVENT_FOLDER_NAME
    ├── 📁 RacerOne_abc12345/
    │   └── 🎥 RacerOne_20260603_143022.mp4
    ├── 📁 DriftKing_def67890/
    │   └── 🎥 DriftKing_20260603_151530.mp4
    └── 📁 SlideMaster_ghi11111/
        └── 🎥 SlideMaster_20260603_162045.mp4
```

---

### 6. Firestore Schema

#### users/{uid} (Source of Truth)
```javascript
{
  uid: "abc123",
  name: "Racer One",
  email: "racer@email.com",
  usernameId: "RacerOne#8888",
  country: "Indonesia",
  clubTeam: "Team Drift",
  car: "Nissan Silvia S15",
  engine: "SR",
  isRegistered: true,
  registeredAt: Timestamp
}
```

#### qtt_submissions/{uid} (Metadata Only)
```javascript
{
  uid: "abc123",
  videoUrl: "https://drive.google.com/...",
  submittedAt: Timestamp,
  submissionStatus: "submitted",
  fileName: "RacerOne_20260603_143022.mp4",
  fileSize: "45.2 MB"
  // NO username, vehicle, engine, country here!
}
```

---

### 7. Troubleshooting

| Problem | Solution |
|---------|----------|
| Video nggak ke-upload | Cek Apps Script URL, cek execution log |
| Sheet nggak ke-create | Pastikan spreadsheet punya permission |
| CORS error | Pastikan deploy "Access: Anyone" |
| File too large | Max 100MB (bisa diubah di CONFIG) |
| Base64 terlalu lama | Normal untuk file >50MB, tunggu aja |
| Maintenance mode nggak jalan | Hard refresh (Ctrl+Shift+R) |

---

**Built for GDSI — Grand Drift Series Indonesia**
