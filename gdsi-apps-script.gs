// ============================================
// GOOGLE APPS SCRIPT - GDSI Handler
// Deploy: Web App → Execute as: Me → Access: Anyone
// Handles: Registration, QTT Submit, Email Confirmations
// ============================================

// ============================================
// CONFIG — WAJIB DIISI SESUAI EVENT & EMAIL
// ============================================
var CONFIG = {
  // Folder Google Drive
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Season_1_Round_2_QTT",  // ← Ganti per event, atau kosongkan ""
  MAX_FILE_SIZE_MB: 100,

  // Email sender
  // Untuk kirim dari admin@gdsi.my.id:
  //   1. Buka Gmail → Settings → Accounts → Add another email
  //   2. Tambahkan admin@gdsi.my.id
  //   3. ImprovMX akan forward kode verifikasi ke Gmail kamu
  //   4. Verifikasi → selesai
  //   5. Set FROM_EMAIL di bawah ini
  // Kalau belum setup alias, kosongkan → email dikirim dari akun Google kamu
  FROM_EMAIL: "admin@gdsi.my.id",   // ← Isi alias Gmail kamu, atau kosongkan ""
  FROM_NAME: "Tim GDSI",

  // Branding
  SITE_URL: "https://gdsi.my.id",     // ← URL website kamu
  EVENT_NAME: "Grand Drift Series Indonesia 2026"
};

// ============================================
// MAIN: doPost
// ============================================
function doPost(e) {
  try {
    var data;

    // Registration (sheets.js) sends JSON via fetch with Content-Type application/json.
    // QTT (qtt-app.js) sends FormData, accessed via e.parameter in Apps Script.
    // Detect by trying JSON parse first; fall back to e.parameter for FormData.
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      // FormData path — qtt-app.js sends FormData
      data = e.parameter || {};
    }

    var action = data.action || 'qtt_submit';

    if (action === 'register') {
      return handleRegistration(data);
    } else if (action === 'qtt_submit') {
      return handleQttSubmit(data);
    } else {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }
  } catch (error) {
    console.error("Apps Script Error:", error);
    return jsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================
// HANDLE: Registration
// ============================================
function handleRegistration(data) {
  var sheetName = data.sheetName || 'GDSI_Registrations';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      'Timestamp', 'UID', 'Name', 'Email', 'WhatsApp',
      'UsernameID', 'Country', 'ClubTeam', 'Car', 'Engine', 'RegisteredAt'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#b70013');
    headerRange.setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  }

  sheet.appendRow([
    new Date(),
    data.uid || '',
    data.name || '',
    data.email || '',
    data.whatsapp || '',
    data.usernameId || '',
    data.country || '',
    data.clubTeam || '',
    data.car || '',
    data.engine || '',
    data.registeredAt || new Date().toISOString()
  ]);

  // Send confirmation email
  if (data.email) {
    try {
      sendRegistrationEmail(data);
    } catch (emailErr) {
      console.error("Email error (registration):", emailErr);
      // Don't fail registration if email fails
    }
  }

  return jsonResponse({
    success: true,
    message: 'Registration saved'
  });
}

// ============================================
// HANDLE: QTT Submit
// ============================================
function handleQttSubmit(data) {
  var uid = data.uid;
  var username = data.username;
  var vehicle = data.vehicle;
  var engine = data.engine;
  var country = data.country;
  var email = data.email;
  var videoBase64 = data.videoBase64 || '';
  var videoName = data.videoName || 'video.mp4';
  var videoMime = data.videoMime || 'video/mp4';

  // Accept either Cloudinary URL (new) or base64 (legacy)
  var hasVideo = (data.videoUrl || data.cloudinaryUrl || videoBase64);
  if (!hasVideo || !uid || !username) {
    return jsonResponse({ success: false, error: "Missing required fields (uid, username, video)" });
  }

  // STEP 1: Handle video — either URL (from Cloudinary) or base64 (legacy)
  // qtt-app.js sends Cloudinary URL, not base64. Base64 path kept for backward compat.
  var videoUrl = data.videoUrl || data.cloudinaryUrl || '';
  var originalUrl = data.originalUrl || '';
  var videoBlob = null;
  var fileSizeMBStr = '—';

  if (!videoUrl && videoBase64) {
    // Legacy base64 path
    try {
      var videoBytes = Utilities.base64Decode(videoBase64);
      videoBlob = Utilities.newBlob(videoBytes, videoMime, videoName);
      var fileSizeMB = videoBytes.length / (1024 * 1024);
      if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
        return jsonResponse({
          success: false,
          error: "File too large: " + fileSizeMB.toFixed(2) + "MB. Max: " + CONFIG.MAX_FILE_SIZE_MB + "MB"
        });
      }
      fileSizeMBStr = fileSizeMB.toFixed(2) + " MB";
    } catch (decodeErr) {
      return jsonResponse({ success: false, error: "Failed to decode video: " + decodeErr.toString() });
    }
  }

  // STEP 2: Folder structure
  var parentFolder = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME, null);
  var workingFolder = parentFolder;
  if (CONFIG.EVENT_FOLDER_NAME && CONFIG.EVENT_FOLDER_NAME.trim() !== "") {
    workingFolder = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parentFolder);
  }
  var safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_");
  var participantFolderName = safeUsername + "_" + uid.substring(0, 8);
  var participantFolder = getOrCreateFolder(participantFolderName, workingFolder);

  // STEP 3: Save to Drive (if blob available) or record Cloudinary URL
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var ext = videoName.split(".").pop() || "mp4";
  var fileName = safeUsername + "_" + timestamp + "." + ext;
  var fileId = '';

  if (videoBlob) {
    // Legacy: upload actual file blob
    var uploadedFile = participantFolder.createFile(videoBlob);
    uploadedFile.setName(fileName);
    uploadedFile.setDescription(
      "GDSI QTT Submission\n" +
      "Event: " + (CONFIG.EVENT_FOLDER_NAME || "Default") + "\n" +
      "UID: " + uid + "\nUsername: " + username +
      "\nVehicle: " + vehicle + "\nEngine: " + engine +
      "\nCountry: " + country + "\nEmail: " + email
    );
    uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    videoUrl = uploadedFile.getUrl();
    fileId = uploadedFile.getId();
    fileSizeMBStr = (uploadedFile.getSize() / (1024 * 1024)).toFixed(2) + " MB";
  }
  // else: videoUrl is already set from Cloudinary — skip Drive upload

  // STEP 4: Write to Sheets
  var sheetName = "GDSI_QTT_Submissions";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Timestamp", "Event", "UID", "Username", "Email",
      "Vehicle", "Engine", "Country",
      "Video URL", "File ID", "File Name", "Folder Path", "File Size"
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#b70013");
    headerRange.setFontColor("#ffffff");
    sheet.autoResizeColumns(1, headers.length);
  }

  var folderPath = (CONFIG.EVENT_FOLDER_NAME ? CONFIG.EVENT_FOLDER_NAME + "/" : "") + participantFolderName;
  sheet.appendRow([
    new Date(), CONFIG.EVENT_FOLDER_NAME || "Default",
    uid, username, email, vehicle, engine, country,
    videoUrl, fileId, fileName, folderPath, fileSizeMBStr + " MB"
  ]);

  // STEP 5: Send confirmation email
  if (email) {
    try {
      sendQttEmail({
        email: email, username: username, vehicle: vehicle,
        engine: engine, country: country, videoUrl: videoUrl,
        fileName: fileName, fileSize: fileSizeMBStr + " MB",
        submittedAt: new Date().toISOString()
      });
    } catch (emailErr) {
      console.error("Email error (QTT):", emailErr);
    }
  }

  return jsonResponse({
    success: true,
    videoUrl: videoUrl, fileId: fileId, fileName: fileName,
    folderPath: folderPath, fileSize: fileSizeMBStr + " MB"
  });
}

// ============================================
// EMAIL: Registration Confirmation
// ============================================
function sendRegistrationEmail(data) {
  var subject = "🏁 Pendaftaran Berhasil / Registration Confirmed — " + CONFIG.EVENT_NAME;
  var recipientName = data.name || data.username || "Peserta";
  var regDate = data.registeredAt
    ? Utilities.formatDate(new Date(data.registeredAt), "Asia/Jakarta", "dd MMM yyyy, HH:mm 'WIB'")
    : Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMM yyyy, HH:mm 'WIB'");

  var rows = [
    ["Nama / Name", data.name || "-"],
    ["Email", data.email || "-"],
    ["WhatsApp", data.whatsapp || "-"],
    ["Username ID", data.usernameId || "-"],
    ["Negara / Country", data.country || "-"],
    ["Klub / Team", data.clubTeam || "-"],
    ["Mobil / Car", data.car || "-"],
    ["Mesin / Engine", data.engine || "-"],
    ["Waktu Registrasi / Registered At", regDate]
  ];

  var tableRows = rows.map(function(r) {
    return '<tr><td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#a08c89;font-size:13px;width:40%;white-space:nowrap;">' + r[0] + '</td>'
      + '<td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#ece0df;font-size:13px;font-weight:600;">' + (r[1] || '-') + '</td></tr>';
  }).join('');

  var html = buildEmailTemplate({
    title: "Pendaftaran Berhasil!",
    subtitle: "Registration Confirmed",
    badge: "PESERTA TERDAFTAR · REGISTERED PARTICIPANT",
    greeting: "Halo " + recipientName + "! 👋",
    bodyHtml: '<p style="color:#d8c2bf;font-size:15px;line-height:1.7;margin:0 0 8px;">Selamat! Kamu sudah resmi terdaftar di <strong style="color:#ff5566;">' + CONFIG.EVENT_NAME + '</strong>.</p>'
      + '<p style="color:#a08c89;font-size:13px;line-height:1.7;margin:0 0 24px;">Congratulations! You are now officially registered for ' + CONFIG.EVENT_NAME + '.</p>',
    tableHtml: tableRows,
    tableCaption: "Detail Registrasi / Registration Details",
    noteHtml: '<p style="margin:0 0 8px;font-size:13px;color:#d8c2bf;"><strong>Langkah Selanjutnya / Next Steps:</strong></p>'
      + '<ol style="margin:0;padding-left:18px;color:#a08c89;font-size:13px;line-height:1.9;">'
      + '<li>Submit video QTT kamu di halaman QTT sebelum deadline.</li>'
      + '<li>Pastikan video: <strong style="color:#ece0df;">720p, Kamera 3, Tire Smoke OFF, Telemetry ON</strong></li>'
      + '<li>Bergabunglah ke komunitas GDSI untuk info terbaru.</li>'
      + '</ol>',
    ctaText: "Buka Halaman QTT",
    ctaUrl: CONFIG.SITE_URL + "/qtt",
    closing: "Semangat dan Good Luck di lintasan! 🔥"
  });

  sendEmail(data.email, subject, html);
}

// ============================================
// EMAIL: QTT Submission Confirmation
// ============================================
function sendQttEmail(data) {
  var subject = "✅ Video QTT Diterima! / QTT Video Received — " + CONFIG.EVENT_NAME;
  var recipientName = data.username || "Peserta";
  var submittedAt = data.submittedAt
    ? Utilities.formatDate(new Date(data.submittedAt), "Asia/Jakarta", "dd MMM yyyy, HH:mm 'WIB'")
    : Utilities.formatDate(new Date(), "Asia/Jakarta", "dd MMM yyyy, HH:mm 'WIB'");

  var rows = [
    ["Username ID", data.username || "-"],
    ["Mobil / Car", data.vehicle || "-"],
    ["Mesin / Engine", data.engine || "-"],
    ["Negara / Country", data.country || "-"],
    ["Nama File / File Name", data.fileName || "-"],
    ["Ukuran File / File Size", data.fileSize || "-"],
    ["Waktu Submit / Submitted At", submittedAt],
    ["Status", "✅ Diterima · Received"]
  ];

  var tableRows = rows.map(function(r) {
    return '<tr><td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#a08c89;font-size:13px;width:40%;white-space:nowrap;">' + r[0] + '</td>'
      + '<td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#ece0df;font-size:13px;font-weight:600;">' + (r[1] || '-') + '</td></tr>';
  }).join('');

  var videoLinkRow = data.videoUrl
    ? '<tr><td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#a08c89;font-size:13px;">Link Video</td>'
      + '<td style="padding:10px 16px;border-bottom:1px solid #2e2a29;"><a href="' + data.videoUrl + '" style="color:#ff5566;font-size:13px;font-weight:600;text-decoration:none;">Lihat Video di Drive ↗</a></td></tr>'
    : '';

  var html = buildEmailTemplate({
    title: "Video QTT Diterima!",
    subtitle: "QTT Submission Received",
    badge: "QTT SUBMITTED · DITERIMA",
    greeting: "Halo " + recipientName + "! 🎉",
    bodyHtml: '<p style="color:#d8c2bf;font-size:15px;line-height:1.7;margin:0 0 8px;">Video QTT kamu sudah <strong style="color:#4ade80;">berhasil diterima</strong>! Kami akan mereview dan menghubungi kamu jika ada yang perlu dikoreksi.</p>'
      + '<p style="color:#a08c89;font-size:13px;line-height:1.7;margin:0 0 24px;">Your QTT video has been <strong style="color:#4ade80;">successfully received</strong>! We will review it and contact you if any corrections are needed.</p>',
    tableHtml: tableRows + videoLinkRow,
    tableCaption: "Detail Submission / Submission Details",
    noteHtml: '<p style="margin:0 0 8px;font-size:13px;color:#d8c2bf;"><strong>Yang perlu diingat / Reminders:</strong></p>'
      + '<ul style="margin:0;padding-left:18px;color:#a08c89;font-size:13px;line-height:1.9;">'
      + '<li>Simpan email ini sebagai bukti submission kamu.</li>'
      + '<li>Hasil QTT akan diumumkan melalui channel komunitas GDSI resmi.</li>'
      + '<li>Keep the faith, stay in control! 🔥</li>'
      + '</ul>',
    ctaText: "Lihat Halaman QTT",
    ctaUrl: CONFIG.SITE_URL + "/qtt",
    closing: "Semangat! Good luck di kompetisi! 🏁"
  });

  sendEmail(data.email, subject, html);
}

// ============================================
// HELPER: Build HTML Email Template
// ============================================
function buildEmailTemplate(opts) {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + opts.title + '</title></head>'
    + '<body style="margin:0;padding:0;background:#0e0c0c;font-family:\'Helvetica Neue\',Arial,sans-serif;">'

    // Outer wrapper
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0e0c0c;padding:32px 16px;">'
    + '<tr><td align="center">'

    // Card
    + '<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#1e1a19;border-radius:16px;overflow:hidden;border:1px solid #4a3835;">'

    // Header strip
    + '<tr><td style="background:#b70013;height:4px;"></td></tr>'

    // Logo row
    + '<tr><td style="padding:24px 32px 0;background:#1e1a19;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td><span style="font-size:11px;font-weight:700;letter-spacing:.15em;color:#a08c89;text-transform:uppercase;">GRAND DRIFT SERIES INDONESIA</span></td>'
    + '<td align="right"><span style="background:#b70013;color:#fff;font-size:10px;font-weight:700;letter-spacing:.1em;padding:4px 12px;border-radius:99px;text-transform:uppercase;">' + opts.badge + '</span></td>'
    + '</tr></table></td></tr>'

    // Title block
    + '<tr><td style="padding:20px 32px 24px;background:#1e1a19;">'
    + '<h1 style="margin:0 0 4px;font-size:26px;font-weight:800;color:#ece0df;letter-spacing:-.02em;">' + opts.title + '</h1>'
    + '<p style="margin:0;font-size:13px;color:#a08c89;text-transform:uppercase;letter-spacing:.06em;">' + opts.subtitle + '</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 32px;"><div style="height:1px;background:#4a3835;"></div></td></tr>'

    // Body
    + '<tr><td style="padding:28px 32px;">'
    + '<p style="margin:0 0 16px;font-size:16px;font-weight:700;color:#ece0df;">' + opts.greeting + '</p>'
    + opts.bodyHtml
    + '</td></tr>'

    // Table caption
    + '<tr><td style="padding:0 32px 12px;">'
    + '<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.1em;color:#a08c89;text-transform:uppercase;">' + opts.tableCaption + '</p>'
    + '</td></tr>'

    // Data table
    + '<tr><td style="padding:0 20px 24px;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0a0a;border-radius:12px;overflow:hidden;border:1px solid #2e2a29;">'
    + opts.tableHtml
    + '</table></td></tr>'

    // Note box
    + '<tr><td style="padding:0 32px 28px;">'
    + '<div style="background:#2e2a29;border-radius:12px;padding:16px 20px;border-left:3px solid #b70013;">'
    + opts.noteHtml
    + '</div></td></tr>'

    // CTA button
    + '<tr><td style="padding:0 32px 28px;text-align:center;">'
    + '<a href="' + opts.ctaUrl + '" style="display:inline-block;background:#b70013;color:#fff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:14px 32px;border-radius:99px;">' + opts.ctaText + ' →</a>'
    + '</td></tr>'

    // Closing message
    + '<tr><td style="padding:0 32px 24px;text-align:center;">'
    + '<p style="margin:0;font-size:14px;color:#d8c2bf;font-style:italic;">' + opts.closing + '</p>'
    + '</td></tr>'

    // Divider
    + '<tr><td style="padding:0 32px;"><div style="height:1px;background:#4a3835;"></div></td></tr>'

    // Footer
    + '<tr><td style="padding:20px 32px;background:#1e1a19;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
    + '<td><p style="margin:0;font-size:11px;color:#6f6765;">© 2026 Grand Drift Series Indonesia. All Rights Reserved.</p>'
    + '<p style="margin:4px 0 0;font-size:11px;color:#6f6765;">Email ini dikirim otomatis. Hubungi kami di <a href="mailto:' + CONFIG.FROM_EMAIL + '" style="color:#a08c89;">' + CONFIG.FROM_EMAIL + '</a></p>'
    + '</td>'
    + '<td align="right"><span style="font-size:18px;font-weight:900;color:#b70013;letter-spacing:-.03em;">GDSI</span></td>'
    + '</tr></table></td></tr>'

    + '</table>'   // end card
    + '</td></tr></table>'  // end outer
    + '</body></html>';
}

// ============================================
// HELPER: Send Email (GmailApp with alias support)
// ============================================
function sendEmail(to, subject, htmlBody) {
  var options = {
    htmlBody: htmlBody,
    name: CONFIG.FROM_NAME
  };

  // Use alias if configured (must be verified in Gmail Settings → Accounts)
  if (CONFIG.FROM_EMAIL && CONFIG.FROM_EMAIL.trim() !== '') {
    options.from = CONFIG.FROM_EMAIL;
  }

  GmailApp.sendEmail(to, subject, '', options);
}

// ============================================
// HELPER: Get or Create Folder
// ============================================
function getOrCreateFolder(folderName, parentFolder) {
  var folders = parentFolder
    ? parentFolder.getFoldersByName(folderName)
    : DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder ? parentFolder.createFolder(folderName) : DriveApp.createFolder(folderName);
}

// ============================================
// HELPER: JSON Response
// ============================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// GET — Status Check
// ============================================
function doGet(e) {
  return jsonResponse({
    status: "GDSI Endpoint Active",
    version: "3.0",
    config: {
      parentFolder: CONFIG.PARENT_FOLDER_NAME,
      eventFolder: CONFIG.EVENT_FOLDER_NAME || "(none)",
      maxFileSizeMB: CONFIG.MAX_FILE_SIZE_MB,
      emailFrom: CONFIG.FROM_EMAIL || "(default google account)",
      emailEnabled: true
    }
  });
}

// ============================================
// TEST FUNCTIONS (jalankan manual dari editor)
// ============================================
function testRegistrationEmail() {
  sendRegistrationEmail({
    name: "Test User",
    email: Session.getActiveUser().getEmail(), // kirim ke email kamu sendiri untuk test
    whatsapp: "+6281234567890",
    usernameId: "TestUser#1234",
    country: "Indonesia",
    clubTeam: "Tim Test",
    car: "Toyota AE86",
    engine: "2JZ",
    registeredAt: new Date().toISOString()
  });
  Logger.log("Registration email sent!");
}

function testQttEmail() {
  sendQttEmail({
    email: Session.getActiveUser().getEmail(),
    username: "TestUser#1234",
    vehicle: "Toyota AE86",
    engine: "2JZ",
    country: "Indonesia",
    videoUrl: "https://drive.google.com/file/d/test",
    fileName: "TestUser_20260101_120000.mp4",
    fileSize: "45.2 MB",
    submittedAt: new Date().toISOString()
  });
  Logger.log("QTT email sent!");
}
