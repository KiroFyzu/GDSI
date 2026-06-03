// GDSI Apps Script — QTT Handler (Binary Upload Version)
// ============================================================
// This version receives FormData with binary file (NOT base64)
// ============================================================

var CONFIG = {
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Event_2026_Q1",
  MAX_FILE_SIZE_MB: 50
};

function doPost(e) {
  try {
    // Check if this is a QTT submission
    var action = e.parameter.action || e.parameters.action;

    if (action === 'qtt_submit') {
      return handleQttSubmit(e);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleQttSubmit(e) {
  try {
    // Get parameters from FormData
    var uid = e.parameter.uid;
    var username = e.parameter.username;
    var vehicle = e.parameter.vehicle;
    var engine = e.parameter.engine;
    var country = e.parameter.country;
    var email = e.parameter.email || '';
    var videoName = e.parameter.videoName;
    var videoMime = e.parameter.videoMime || 'video/mp4';

    // Get binary file from FormData
    var videoBlob = e.parameter.videoFile;

    if (!videoBlob) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No video file received'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Check file size
    var fileSizeMB = videoBlob.getBytes().length / (1024 * 1024);
    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'File too large: ' + fileSizeMB.toFixed(2) + 'MB (max ' + CONFIG.MAX_FILE_SIZE_MB + 'MB)'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Create or get parent folder
    var parentFolder = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME);
    var eventFolder = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parentFolder);

    // Create user folder: Username_UID
    var userFolderName = sanitizeFolderName(username) + '_' + uid.substring(0, 8);
    var userFolder = getOrCreateFolder(userFolderName, eventFolder);

    // Generate filename: Username_YYYYMMDD_HHMMSS.ext
    var now = new Date();
    var timestamp = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
    var ext = videoName.split('.').pop() || 'mp4';
    var newFileName = sanitizeFolderName(username) + '_' + timestamp + '.' + ext;

    // Save video to Drive (BINARY, not base64!)
    var videoFile = userFolder.createFile(videoBlob);
    videoFile.setName(newFileName);

    // Set sharing to anyone with link can view
    videoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Get video URL
    var videoUrl = videoFile.getUrl();
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + videoFile.getId();

    // Log to Sheet
    logToSheet({
      uid: uid,
      username: username,
      vehicle: vehicle,
      engine: engine,
      country: country,
      email: email,
      fileName: newFileName,
      fileSize: fileSizeMB.toFixed(2) + ' MB',
      videoUrl: videoUrl,
      submittedAt: now.toISOString()
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      videoUrl: videoUrl,
      downloadUrl: downloadUrl,
      fileName: newFileName,
      fileSize: fileSizeMB.toFixed(2) + ' MB'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateFolder(name, parent) {
  var query = 'title = "' + name + '" and mimeType = "application/vnd.google-apps.folder"';
  if (parent) {
    query += ' and "' + parent.getId() + '" in parents';
  }

  var folders = DriveApp.searchFolders(query);
  if (folders.hasNext()) {
    return folders.next();
  }

  if (parent) {
    return parent.createFolder(name);
  }
  return DriveApp.createFolder(name);
}

function sanitizeFolderName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
}

function logToSheet(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = 'GDSI_QTT_Submissions';
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = [
        'Timestamp', 'UID', 'Username', 'Vehicle', 'Engine', 'Country',
        'Email', 'File Name', 'File Size', 'Video URL', 'Submitted At'
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
      data.username || '',
      data.vehicle || '',
      data.engine || '',
      data.country || '',
      data.email || '',
      data.fileName || '',
      data.fileSize || '',
      data.videoUrl || '',
      data.submittedAt || ''
    ]);

  } catch (e) {
    console.error('Sheet logging error:', e);
  }
}

// Test function (run manually in Apps Script editor)
function testSetup() {
  var parent = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME);
  var event = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parent);
  console.log('Folders created successfully');
  console.log('Parent folder ID:', parent.getId());
  console.log('Event folder ID:', event.getId());
}
