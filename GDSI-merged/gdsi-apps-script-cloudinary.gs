// GDSI Apps Script — QTT Handler (Cloudinary URL → Google Drive)
// ============================================================
// Receives: videoUrl (Cloudinary) + metadata
// Does: Download from Cloudinary URL → Save to GD folder
// Returns: GD videoUrl
// ============================================================

var CONFIG = {
  PARENT_FOLDER_NAME: "GDSI_QTT_Videos",
  EVENT_FOLDER_NAME: "Event_2026_Q1",
  MAX_FILE_SIZE_MB: 100
};

function doPost(e) {
  try {
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
    var uid = e.parameter.uid;
    var username = e.parameter.username;
    var vehicle = e.parameter.vehicle;
    var engine = e.parameter.engine;
    var country = e.parameter.country;
    var email = e.parameter.email || '';
    var videoUrl = e.parameter.videoUrl;        // ← compressed URL (primary)
    var originalUrl = e.parameter.originalUrl || '';  // ← original URL (backup)
    var publicId = e.parameter.publicId || '';
    var videoName = e.parameter.videoName;
    var videoMime = e.parameter.videoMime || 'video/mp4';

    if (!videoUrl) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No video URL received'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Download video from Cloudinary URL
    console.log('Downloading from Cloudinary:', videoUrl);
    var response = UrlFetchApp.fetch(videoUrl, {
      method: 'GET',
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to download from Cloudinary: HTTP ' + response.getResponseCode()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var videoBlob = response.getBlob();
    var fileSizeMB = videoBlob.getBytes().length / (1024 * 1024);

    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'File too large: ' + fileSizeMB.toFixed(2) + 'MB (max ' + CONFIG.MAX_FILE_SIZE_MB + 'MB)'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Create folder structure
    var parentFolder = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME);
    var eventFolder = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parentFolder);
    var userFolderName = sanitizeFolderName(username) + '_' + uid.substring(0, 8);
    var userFolder = getOrCreateFolder(userFolderName, eventFolder);

    // Generate filename
    var now = new Date();
    var timestamp = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
    var ext = videoName.split('.').pop() || 'mp4';
    var newFileName = sanitizeFolderName(username) + '_' + timestamp + '.' + ext;

    // Save to Drive
    var videoFile = userFolder.createFile(videoBlob);
    videoFile.setName(newFileName);
    videoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var gdUrl = videoFile.getUrl();
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
      videoUrl: gdUrl,
      cloudinaryUrl: videoUrl,
      cloudinaryPublicId: publicId,
      submittedAt: now.toISOString()
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      videoUrl: gdUrl,
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
        'Email', 'File Name', 'File Size', 'GD Video URL', 'Cloudinary Compressed URL', 
        'Cloudinary Original URL', 'Cloudinary Public ID', 'Submitted At'
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
      data.cloudinaryUrl || '',
      data.cloudinaryOriginalUrl || '',
      data.cloudinaryPublicId || '',
      data.submittedAt || ''
    ]);
  } catch (e) {
    console.error('Sheet logging error:', e);
  }
}

function testSetup() {
  var parent = getOrCreateFolder(CONFIG.PARENT_FOLDER_NAME);
  var event = getOrCreateFolder(CONFIG.EVENT_FOLDER_NAME, parent);
  console.log('Folders created successfully');
  console.log('Parent folder ID:', parent.getId());
  console.log('Event folder ID:', event.getId());
}
