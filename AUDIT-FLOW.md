# GDSI — Audit Flow Lengkap

---

## 1. FLOW START → END (Pertama kali user masuk)

```
[1] User buka index.html
     ↓
     Lihat hero, CTA, video embed, social links
     Dark/light otomatis ikut jam HP
     Toggle ID/EN tersimpan ke localStorage

[2] Klik "Registrasi" → form.html
     ↓
     MAINTENANCE CHECK
     ├─ VITE_FORM_MAINTENANCE_MODE=true →
     │    Banner "Registrasi Ditutup" tampil
     │    Semua input + tombol disabled
     │    STOP — tidak bisa lanjut
     └─ false → lanjut

     AUTH CHECK
     ├─ Belum login →
     │    Auth overlay muncul (blur backdrop)
     │    User klik "Login dengan Google"
     │    Google Sign-In popup
     │    Berhasil → overlay hilang, form editable
     └─ Sudah login → langsung

     REGISTRATION CHECK (Firestore /users/{uid})
     ├─ Sudah terdaftar →
     │    Form populated + readonly
     │    Toast "Data registrasi ditemukan"
     │    Banner "Form Terkunci" tampil
     │    User bisa lihat data via tombol "Lihat Data"
     └─ Belum terdaftar → form editable

[3] User isi form & submit
     ↓
     CLIENT VALIDATION
     ├─ Nama wajib → error toast jika kosong
     ├─ WhatsApp format → error toast
     ├─ Username format (Name#1234) → error toast
     ├─ Engine dari daftar → error toast
     ├─ Country wajib → error toast
     └─ Semua OK → lanjut

     FIRESTORE TRANSACTION (atomic)
     ├─ /users/{uid} exists? → throw 'already-registered'
     ├─ /usernames/{username} exists? → throw 'username-taken'
     └─ OK → tulis /users/{uid} + /usernames/{username}

     PARALLEL (non-blocking)
     └─ syncToGoogleSheets() → POST JSON ke Apps Script
            → Apps Script: tulis GDSI_Registrations sheet
            → Apps Script: kirim email konfirmasi ke user

     SUCCESS UI
     ├─ showSuccessModal() → modal konfirmasi muncul
     ├─ Form → readonly mode
     ├─ Toast "Registrasi berhasil!"
     └─ Banner "Form Terkunci"

[4] Klik "Submit QTT" → qtt.html
     ↓
     MAINTENANCE CHECK (VITE_QTT_MAINTENANCE_MODE)
     ├─ true → banner tampil, upload zone + tombol disabled
     └─ false → lanjut

     AUTH CHECK
     └─ Sama seperti form.html

     DATA LOAD
     ├─ /users/{uid} tidak ada → ERROR STATE
     │    Tampil: "Registrasi Tidak Ditemukan"
     │    Tombol: "Registrasi Sekarang" → form.html
     ├─ /users/{uid} ada + /qtt_submissions/{uid} ada →
     │    VIEW MODE: tampil detail submission + video link/preview
     └─ /users/{uid} ada + /qtt_submissions/{uid} tidak ada →
          SUBMIT MODE: upload zone aktif

[5] User upload video
     ↓
     CLIENT VALIDATION
     ├─ Format: .mp4 / .mov / .webm → error jika salah
     ├─ Size: max 100MB → error jika lebih
     └─ OK → preview tampil, submit aktif

     SUBMIT FLOW
     ├─ STEP 1: Upload ke Cloudinary (progress bar %)
     │    URL compressed (q_auto:eco, 720p max)
     │    URL original (backup)
     │    Public ID tersimpan
     ├─ STEP 2: POST FormData ke Apps Script
     │    action: 'qtt_submit'
     │    uid, username, vehicle, engine, country, email
     │    videoUrl (Cloudinary), originalUrl, publicId
     │    → Apps Script: tulis GDSI_QTT_Submissions sheet
     │    → Apps Script: kirim email konfirmasi QTT
     └─ STEP 3: Tulis Firestore /qtt_submissions/{uid}
          videoUrl, gdUrl, cloudinaryPublicId
          submittedAt, submissionStatus: 'submitted'

     SUCCESS UI
     └─ Modal sukses → auto reload → VIEW MODE
```

---

## 2. FLOW END → START (Balik ke awal)

```
[QTT VIEW MODE]
     ↓
     User lihat statusnya: Submitted ✅
     Klik "Open Video" → Cloudinary player/download
     Klik ← (back) → kembali ke index.html

[FORM READONLY]
     ↓
     User lihat data mereka di modal "Info"
     Tidak bisa edit apapun (by design — rules Firestore)
     Klik ← → index.html

[INDEX]
     ↓
     Lihat video embed (lazy-load, autoplay saat scroll)
     Lihat rules → gdsi_rules.html
     Lihat T&C → gdsi_tnc.html
     Toggle bahasa → persists di semua halaman
     Dark/light → auto per jam, tidak perlu aksi

[RULES / TNC]
     ↓
     Baca konten (bilingual ID/EN)
     Klik ← → balik ke index
```

---

## 3. FLOW REPEAT (User balik setelah sudah daftar)

### Skenario A: Kembali ke form.html (sudah daftar)
```
Login → onAuthStateChanged → checkRegistration(uid)
 → data ADA di Firestore
 → populateForm(data) → form filled
 → setFormMode('readonly') → semua disabled
 → Toast "Data registrasi ditemukan"
 → Banner "Form Terkunci" tampil
 → Tombol "Lihat Data" → showInfoModal()
```
⚠️ **Catatan**: WhatsApp ditampilkan dalam format `+62XXXXXXXXX` (normalized), bukan format asli yang user ketik.

### Skenario B: Kembali ke qtt.html (sudah submit)
```
Login → loadParticipantData(uid)
 → /users/{uid} ADA
 → /qtt_submissions/{uid} ADA
 → showViewMode() → tampil detail + video preview
 → Submit button tidak ada di view mode
```

### Skenario C: Kembali ke qtt.html (daftar tapi belum QTT)
```
Login → loadParticipantData(uid)
 → /users/{uid} ADA
 → /qtt_submissions/{uid} TIDAK ADA
 → showSubmitMode() → upload zone aktif
```

### Skenario D: Buka qtt.html TANPA daftar dulu
```
Login → loadParticipantData(uid)
 → /users/{uid} TIDAK ADA
 → showErrorState()
 → Tampil: "Registrasi Tidak Ditemukan"
 → Tombol: "Registrasi Sekarang" → form.html
```

### Skenario E: User logout lalu login akun beda
```
→ onAuthStateChanged (baru) fires
→ checkRegistration(uid_baru)
→ Mulai dari awal (fresh state untuk akun baru)
```

---

## 4. APA YANG TERJADI PADA USER (State Machine)

| State | Trigger | Yang User Lihat | Bisa Dilakukan |
|---|---|---|---|
| **Belum login** | Buka form/qtt | Auth overlay blur | Login Google |
| **Login, belum daftar** | onAuthStateChanged | Form kosong, editable | Isi + submit |
| **Submit berhasil** | submitRegistration OK | Modal konfirmasi | Tutup modal |
| **Sudah daftar (kembali)** | checkRegistration | Form readonly + banner | Lihat data saja |
| **QTT: belum daftar** | loadParticipantData | Error state | Klik → form.html |
| **QTT: daftar, belum submit** | loadParticipantData | Upload zone | Upload + submit |
| **QTT: sudah submit** | loadParticipantData | View mode + video | Lihat data + buka video |
| **Maintenance form** | VITE_FORM_MAINTENANCE_MODE=true | Banner merah, form disabled | Tidak ada |
| **Maintenance QTT** | VITE_QTT_MAINTENANCE_MODE=true | Banner, upload disabled | Tidak ada |
| **Offline** | Network lost | Toast peringatan | Tunggu koneksi |

---

## 5. EMAIL FLOW

```
Registrasi:
 form.html → Firestore (berhasil) → syncToGoogleSheets()
  → POST JSON ke Apps Script
  → GAS: handleRegistration()
  → GAS: tulis Sheets
  → GAS: sendRegistrationEmail() → GmailApp
  → User terima email: "🏁 Pendaftaran Berhasil"
     dengan preview: nama, email, WA, username, country, club, car, engine, waktu

QTT:
 qtt-app.js → Cloudinary (upload) → POST FormData ke Apps Script
  → GAS: handleQttSubmit()
  → GAS: tulis Sheets
  → GAS: sendQttEmail() → GmailApp
  → User terima email: "✅ Video QTT Diterima"
     dengan preview: username, car, engine, country, file, size, waktu, link video
```

---

## 6. BUG YANG SUDAH DIFIX DI SESSION INI

| # | Bug | Status |
|---|---|---|
| 1 | GAS doPost: JSON vs FormData mismatch | ✅ Fixed — auto-detect format |
| 2 | Form tidak ada maintenance mode | ✅ Fixed — VITE_FORM_MAINTENANCE_MODE |
| 3 | QTT error state tanpa CTA | ✅ Sudah ada tombol "Registrasi Sekarang" |
| 4 | Admin CMS PATCH gagal di doc baru | ✅ Fixed — add updateMask |
| 5 | Firestore rules blokir gdsi_cms | ✅ Fixed — allow read/write gdsi_cms |
| 6 | Double rgb() wrap di Tailwind config | ✅ Fixed |
| 7 | Social pill link terlalu cepat (150ms) | ✅ Fixed → 1050ms setelah animasi |

---

## 7. CARA AKTIFKAN / MATIKAN MAINTENANCE

### Dari Vercel Dashboard (Recommended — tanpa redeploy):
1. Buka Vercel → Project → **Settings → Environment Variables**
2. Cari `VITE_FORM_MAINTENANCE_MODE` → Edit → ubah ke `true`
3. Klik **Save** → Vercel auto-rebuild dalam ~1 menit
4. Form langsung tertutup

### Matikan lagi:
1. Ubah kembali ke `false` → Save → rebuild

### Lokasi env var yang perlu ada di Vercel:
```
VITE_FORM_MAINTENANCE_MODE=false    ← form registrasi
VITE_QTT_MAINTENANCE_MODE=false     ← qtt submission
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GDSI_APPS_SCRIPT_URL=...
VITE_CLOUDINARY_CLOUD_NAME=...
VITE_CLOUDINARY_UPLOAD_PRESET=...
```

---

## 8. PERTANYAAN YANG PERLU DIJAWAB

**Q1 — Update data registrasi**: Saat ini Firestore rules `allow update: if false` — user tidak bisa update apapun setelah daftar. Bagaimana kalau user salah input car atau engine? Apakah ada window waktu untuk edit, atau memang by design tidak bisa sama sekali?

**Q2 — Multi-submit QTT**: Saat ini satu user = satu submit, tidak bisa kirim ulang. Kalau panitia mau kasih kesempatan resubmit (karena video spec salah), alurnya harus dihapus manual dari Firestore dulu. Apakah mau dibuatkan fitur "request resubmit" dari admin panel?

**Q3 — Cloudinary backup**: Video tersimpan di Cloudinary + link-nya di Firestore. Tapi file asli tidak diupload ke Google Drive lagi (karena sekarang pakai URL, bukan base64). Apakah ini OK, atau Drive tetap harus jadi primary storage?

**Q4 — Email dari `admin@gdsi.my.id`**: Sudah setup alias di Gmail belum? Kalau belum, email akan keluar dari akun Google pribadi kamu (bukan admin@gdsi.my.id). Ini penting untuk kesan profesional.
