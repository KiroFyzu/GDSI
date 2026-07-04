// ============================================================
// EMAIL.GS — Semua template & pengiriman email
// Berisi: 3 email (registrasi, QTT, donasi), 1 template HTML
// bersama (buildEmailTemplate), dan 1 wrapper GmailApp (sendEmail).
// ============================================================

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
function sendDonationThankYouEmail_(d) {
  var subject = 'Terima Kasih atas Donasimu / Thank You for Your Donation — ' + (CONFIG.EVENT_NAME || 'GDSI');
  var amountStr = 'Rp ' + Number(d.amount).toLocaleString('id-ID');
  var paidAtStr = d.paidAt
    ? Utilities.formatDate(new Date(d.paidAt), 'Asia/Jakarta', "dd MMM yyyy, HH:mm 'WIB'")
    : Utilities.formatDate(new Date(), 'Asia/Jakarta', "dd MMM yyyy, HH:mm 'WIB'");

  var rows = [
    ['Nama / Name', d.name || '(anonim)'],
    ['Nominal / Amount', amountStr],
    ['ID Transaksi / Transaction ID', d.orderId],
    ['Waktu / Time', paidAtStr]
  ];
  var tableRows = rows.map(function(r) {
    return '<tr><td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#a08c89;font-size:13px;width:40%;white-space:nowrap;">' + r[0] + '</td>'
      + '<td style="padding:10px 16px;border-bottom:1px solid #2e2a29;color:#ece0df;font-size:13px;font-weight:600;">' + r[1] + '</td></tr>';
  }).join('');

  var html = buildEmailTemplate({
    title: 'Terima Kasih!',
    subtitle: 'Donation Confirmed',
    badge: 'DONASI DITERIMA · DONATION RECEIVED',
    greeting: 'Halo ' + (d.name || 'Sahabat GDSI') + '! 🙏',
    bodyHtml: '<p style="color:#d8c2bf;font-size:15px;line-height:1.7;margin:0 0 8px;">Terima kasih atas donasi <strong style="color:#ff5566;">' + amountStr + '</strong> yang kamu berikan untuk <strong style="color:#ff5566;">' + (CONFIG.EVENT_NAME || 'GDSI') + '</strong>.</p>'
      + '<p style="color:#a08c89;font-size:13px;line-height:1.7;margin:0 0 24px;">Thank you for your donation of ' + amountStr + ' to support ' + (CONFIG.EVENT_NAME || 'GDSI') + '.</p>',
    tableHtml: tableRows,
    tableCaption: 'Detail Donasi / Donation Details',
    noteHtml: '<p style="margin:0;font-size:13px;color:#d8c2bf;">Dukunganmu membantu kami terus menghadirkan kompetisi drifting virtual berkualitas untuk komunitas Indonesia. Sampai jumpa di lintasan! 🏁</p>',
    ctaText: 'Kunjungi GDSI',
    ctaUrl: CONFIG.SITE_URL || 'https://gdsi.my.id',
    closing: 'Dengan penuh terima kasih, Tim GDSI 🙏'
  });

  sendEmail(d.email, subject, html);
}

// ============================================================
// TEST: jalankan manual dari Apps Script editor untuk cek
// integrasi Paywuz tanpa perlu buka website
// ============================================================
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
