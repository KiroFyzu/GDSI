// ============================================================
// QTT.GS — Submission video Qualifying Time Trial
// Berisi: handleQttSubmit (download dari Cloudinary → simpan ke
// Drive → log ke Sheet), getQttList (buat admin CMS), dan
// getOrCreateFolder (helper Drive, dipakai QTT saja).
// ============================================================

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

  var uploadedFile;
  if (videoBlob) {
    // Legacy path: blob was decoded from base64
    uploadedFile = participantFolder.createFile(videoBlob);
  } else if (videoUrl) {
    // New path (qtt-app.js): download from Cloudinary → save to Drive
    // This keeps Google Drive as primary storage per the original flow design
    try {
      var response = UrlFetchApp.fetch(videoUrl, { muteHttpExceptions: true });
      var blob = response.getBlob().setName(fileName);
      uploadedFile = participantFolder.createFile(blob);
      fileSizeMBStr = (blob.getBytes().length / (1024 * 1024)).toFixed(2) + " MB";
    } catch (fetchErr) {
      // If Cloudinary download fails, store URL reference instead
      console.error("Could not download from Cloudinary:", fetchErr);
      uploadedFile = null;
    }
  }

  if (uploadedFile) {
    uploadedFile.setName(fileName);
    uploadedFile.setDescription(
      "GDSI QTT Submission\n" +
      "Event: " + (CONFIG.EVENT_FOLDER_NAME || "Default") + "\n" +
      "UID: " + uid + "\nUsername: " + username +
      "\nVehicle: " + vehicle + "\nEngine: " + engine +
      "\nCountry: " + country + "\nEmail: " + email +
      "\nCloudinary: " + videoUrl
    );
    uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    videoUrl = uploadedFile.getUrl();   // override with Drive link
    fileId = uploadedFile.getId();
  }

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
function getQttList() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('GDSI_QTT_Submissions');
    if (!sheet) return jsonResponse({ success: true, data: [], message: 'Sheet GDSI_QTT_Submissions belum ada' });

    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return jsonResponse({ success: true, data: [] });

    var data = [];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[2]) continue;
      data.push({
        no          : i,
        timestamp   : row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '',
        event       : row[1] || '',
        uid         : row[2] || '',
        username    : row[3] || '',
        email       : row[4] || '',
        vehicle     : row[5] || '',
        engine      : row[6] || '',
        country     : row[7] || '',
        videoUrl    : row[8] || '',
        fileId      : row[9] || '',
        fileName    : row[10] || '',
        folderPath  : row[11] || '',
        fileSize    : row[12] || ''
      });
    }

    return jsonResponse({ success: true, data: data, total: data.length });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================
// TEST FUNCTIONS (jalankan manual dari editor)
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
