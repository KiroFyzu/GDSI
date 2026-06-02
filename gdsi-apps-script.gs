// ============================================
// GOOGLE APPS SCRIPT - GDSI QTT Upload Handler
// Deploy as Web App (Execute as: Me, Access: Anyone)
// ============================================
// Supports TWO sheets in ONE spreadsheet:
//   - GDSI_Registrations
//   - GDSI_QTT_Submissions
//
// Video upload via base64 (more reliable than FormData blob)
// Folder structure: GDSI_QTT_Videos/Event_Folder/Participant_Folder/
// ============================================

// ============================================
// CONFIG — GANTI SESUAI EVENT
// ============================================
var CONFIG = {
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Season_1_Round_2_QTT",  // ← GANTI per event, atau kosongin ""
  // Contoh: "Event_2026_Q1", "Season_3_QTT", "GDSI_2026_Mei"
  // Kalau dikosongin (""), participant langsung di bawah PARENT_FOLDER
  MAX_FILE_SIZE_MB: 100
};

// ============================================
// MAIN: doPost
// ============================================
function doPost(e) {
  try {
    // Parse JSON payload
    var data = JSON.parse(e.postData.contents);

    var action = data.action || 'qtt_submit';

    // Route berdasarkan action
    if (action === 'register') {
      return handleRegistration(data);
    } else if (action === 'qtt_submit') {
      return handleQttSubmit(data);
    } else {
      return jsonResponse({ success: false, error: "Unknown action: " + action });
    }

  } catch (error) {
    console.error("Apps Script Error:", error);
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

// ============================================
// HANDLE: Registration (from form.html)
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

  return jsonResponse({
    success: true,
    message: 'Registration saved to ' + sheetName
  });
}

// ============================================
// HANDLE: QTT Submit (from qtt.html)
// ============================================
function handleQttSubmit(data) {
  var uid = data.uid;
  var username = data.username;
  var vehicle = data.vehicle;
  var engine = data.engine;
  var country = data.country;
  var email = data.email;
  var videoBase64 = data.videoBase64;
  var videoName = data.videoName || 'video.mp4';
  var videoMime = data.videoMime || 'video/mp4';

  if (!videoBase64 || !uid || !username) {
    return jsonResponse({ success: false, error: "Missing required fields" });
  }

  // ============================================
  // STEP 1: Decode base64 video
  // ============================================
  try {
    var videoBytes = Utilities.base64Decode(videoBase64);
    var videoBlob = Utilities.newBlob(videoBytes, videoMime, videoName);

    // Check file size
    var fileSizeMB = videoBytes.length / (1024 * 1024);
    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      return jsonResponse({ 
        success: false, 
        error: "File too large: " + fileSizeMB.toFixed(2) + "MB. Max: " + CONFIG.MAX_FILE_SIZE_MB + "MB" 
      });
    }
  } catch (decodeErr) {
    return jsonResponse({ success: false, error: "Failed to decode video: " + decodeErr.toString() });
  }

  // ============================================
  // STEP 2: Create / Get folder structure
  // ============================================
  // GDSI_QTT_Videos/ ← parent
  //   └── Event_2026_Q1/ ← event folder (optional)
  //         └── RacerOne_abc123/ ← participant folder
  //               └── video.mp4

  var parentFolder = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME, null);

  // Event folder (optional)
  var workingFolder = parentFolder;
  if (CONFIG.EVENT_FOLDER_NAME && CONFIG.EVENT_FOLDER_NAME.trim() !== "") {
    workingFolder = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parentFolder);
  }

  // Participant folder: username_uid
  var safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_");
  var participantFolderName = safeUsername + "_" + uid.substring(0, 8);
  var participantFolder = getOrCreateFolder(participantFolderName, workingFolder);

  // ============================================
  // STEP 3: Upload video to Drive
  // ============================================
  var timestamp = Utilities.formatDate(
    new Date(), 
    Session.getScriptTimeZone(), 
    "yyyyMMdd_HHmmss"
  );
  var ext = videoName.split(".").pop() || "mp4";
  var fileName = safeUsername + "_" + timestamp + "." + ext;

  var uploadedFile = participantFolder.createFile(videoBlob);
  uploadedFile.setName(fileName);
  uploadedFile.setDescription(
    "GDSI QTT Submission\n" +
    "Event: " + (CONFIG.EVENT_FOLDER_NAME || "Default") + "\n" +
    "UID: " + uid + "\n" +
    "Username: " + username + "\n" +
    "Vehicle: " + vehicle + "\n" +
    "Engine: " + engine + "\n" +
    "Country: " + country + "\n" +
    "Email: " + email
  );

  // Make file viewable by anyone with link
  uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var videoUrl = uploadedFile.getUrl();
  var fileId = uploadedFile.getId();
  var fileSizeMB = (uploadedFile.getSize() / (1024 * 1024)).toFixed(2);

  // ============================================
  // STEP 4: Write to Google Sheets
  // ============================================
  var sheetName = "GDSI_QTT_Submissions";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Timestamp", "Event", "UID", "Username", "Email", 
      "Vehicle", "Engine", "Country",
      "Video URL", "File ID", "File Name", 
      "Folder Path", "File Size"
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
    new Date(),
    CONFIG.EVENT_FOLDER_NAME || "Default",
    uid,
    username,
    email,
    vehicle,
    engine,
    country,
    videoUrl,
    fileId,
    fileName,
    folderPath,
    fileSizeMB + " MB"
  ]);

  // ============================================
  // STEP 5: Return success response
  // ============================================
  return jsonResponse({
    success: true,
    videoUrl: videoUrl,
    fileId: fileId,
    fileName: fileName,
    folderPath: folderPath,
    fileSize: fileSizeMB + " MB"
  });
}

// ============================================
// HELPER: Get or Create Folder
// ============================================
function getOrCreateFolder(folderName, parentFolder) {
  var folders;

  if (parentFolder) {
    folders = parentFolder.getFoldersByName(folderName);
  } else {
    folders = DriveApp.getFoldersByName(folderName);
  }

  if (folders.hasNext()) {
    return folders.next();
  }

  if (parentFolder) {
    return parentFolder.createFolder(folderName);
  } else {
    return DriveApp.createFolder(folderName);
  }
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
// CORS Preflight + Status Check
// ============================================
function doGet(e) {
  return jsonResponse({ 
    status: "GDSI Upload Endpoint Active",
    version: "2.0",
    config: {
      parentFolder: CONFIG.PARENT_FOLDER_NAME,
      eventFolder: CONFIG.EVENT_FOLDER_NAME || "(none — participants directly under parent)",
      maxFileSize: CONFIG.MAX_FILE_SIZE_MB + " MB"
    },
    endpoints: {
      register: "POST with action: 'register' → saves to GDSI_Registrations",
      qtt_submit: "POST with action: 'qtt_submit' + videoBase64 → saves to GDSI_QTT_Submissions + Drive"
    }
  });
}
