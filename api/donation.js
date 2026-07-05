const PAYWUZ_BASE_URL = (process.env.PAYWUZ_BASE_URL || 'https://api.paywuz.id/v1').replace(/\/+$/, '');
const MIN_AMOUNT = 5000;
const PAYMENT_METHOD = 'QRIS';

function json(res, status, data) {
  return res.status(status).json(data);
}

function getPaywuzApiKey() {
  return process.env.PAYWUZ_API_KEY || '';
}

function getSiteUrl(req) {
  if (process.env.GDSI_SITE_URL) return process.env.GDSI_SITE_URL.replace(/\/+$/, '');

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function buildOrderId() {
  return `DONATE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function paywuzRequest(path, init = {}) {
  const apiKey = getPaywuzApiKey();
  if (!apiKey) {
    const err = new Error('PAYWUZ_API_KEY belum diset di Vercel Environment Variables.');
    err.status = 500;
    throw err;
  }

  const response = await fetch(`${PAYWUZ_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    body = null;
  }

  if (!response.ok) {
    const err = new Error(body?.message || `Paywuz API error HTTP ${response.status}`);
    err.status = response.status;
    err.code = body?.error;
    throw err;
  }

  return body?.data || body;
}

async function createDonation(req, res) {
  const amount = Number.parseInt(req.body?.amount, 10);
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT) {
    return json(res, 400, {
      success: false,
      error: `Nominal minimal Rp ${MIN_AMOUNT.toLocaleString('id-ID')}`
    });
  }

  const orderId = buildOrderId();
  const donorName = String(req.body?.donorName || '').trim().slice(0, 100);
  const donorEmail = String(req.body?.donorEmail || '').trim().slice(0, 120);
  const redirectUrl = `${getSiteUrl(req)}/donation?orderId=${encodeURIComponent(orderId)}`;

  const transaction = await paywuzRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      amount,
      paymentMethod: PAYMENT_METHOD,
      redirectUrl,
      metadata: { donorName, donorEmail }
    })
  });

  return json(res, 200, {
    success: true,
    orderId,
    amount: transaction.amount || amount,
    status: transaction.status || 'pending',
    paymentUrl: transaction.paymentUrl,
    paymentMethod: transaction.paymentMethod || PAYMENT_METHOD,
    totalPayment: transaction.totalPayment
  });
}

async function checkDonationStatus(req, res) {
  const orderId = String(req.query?.orderId || '').trim();
  if (!orderId) {
    return json(res, 400, { success: false, error: 'orderId required' });
  }

  const transaction = await paywuzRequest(`/transactions/${encodeURIComponent(orderId)}`);
  return json(res, 200, {
    success: true,
    orderId,
    status: transaction.status,
    amount: transaction.amount,
    paymentMethod: transaction.paymentMethod,
    totalPayment: transaction.totalPayment,
    paidAt: transaction.paidAt || null
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return await createDonation(req, res);
    if (req.method === 'GET') return await checkDonationStatus(req, res);

    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { success: false, error: 'method_not_allowed' });
  } catch (err) {
    console.error('[donation api]', err);
    return json(res, err.status || 500, {
      success: false,
      error: err.message || 'Terjadi kesalahan saat menghubungi Paywuz.'
    });
  }
}
