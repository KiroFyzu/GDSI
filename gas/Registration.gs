// ============================================================
// REGISTRATION.GS — Pendaftaran peserta
// Berisi: handleRegistration (simpan ke Sheet + trigger email),
// getParticipants (buat admin CMS daftar peserta).
// ============================================================

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
function getParticipants() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('GDSI_Registrations');
    if (!sheet) return jsonResponse({ success: true, data: [], message: 'Sheet GDSI_Registrations belum ada' });

    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return jsonResponse({ success: true, data: [] });

    var headers = rows[0];   // Timestamp,UID,Name,Email,WhatsApp,UsernameID,Country,ClubTeam,Car,Engine,RegisteredAt
    var data = [];
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[1]) continue; // skip empty rows
      data.push({
        no          : i,
        timestamp   : row[0] ? Utilities.formatDate(new Date(row[0]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '',
        uid         : row[1] || '',
        name        : row[2] || '',
        email       : row[3] || '',
        whatsapp    : row[4] || '',
        usernameId  : row[5] || '',
        country     : row[6] || '',
        clubTeam    : row[7] || '',
        car         : row[8] || '',
        engine      : row[9] || '',
        registeredAt: row[10] || ''
      });
    }

    // Cross-reference QTT status
    var qttSheet = ss.getSheetByName('GDSI_QTT_Submissions');
    var qttUids  = {};
    if (qttSheet) {
      var qttRows = qttSheet.getDataRange().getValues();
      for (var j = 1; j < qttRows.length; j++) {
        var qRow = qttRows[j];
        if (qRow[2]) qttUids[qRow[2]] = {
          submittedAt : qRow[0] ? Utilities.formatDate(new Date(qRow[0]), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '',
          videoUrl    : qRow[8] || '',
          fileSize    : qRow[12] || ''
        };
      }
    }

    data.forEach(function(p) {
      p.qttStatus = qttUids[p.uid] ? 'Submitted' : 'Belum';
      p.qttData   = qttUids[p.uid] || null;
    });

    return jsonResponse({ success: true, data: data, total: data.length });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ============================================
// GET QTT LIST — dari GDSI_QTT_Submissions sheet
// ============================================
