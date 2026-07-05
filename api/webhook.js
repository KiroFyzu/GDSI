import { createHmac, timingSafeEqual } from 'node:crypto';

export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verifyPaywuzSignature(rawBody, apiKey, signatureHeader) {
  if (!apiKey || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', apiKey).update(rawBody, 'utf8').digest('hex')}`;
  if (expected.length !== signatureHeader.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['x-paywuz-signature'];
  const event = req.headers['x-paywuz-event'];
  const deliveryId = req.headers['x-paywuz-delivery'];

  if (!verifyPaywuzSignature(rawBody, process.env.PAYWUZ_API_KEY, signature)) {
    console.warn('[paywuz webhook] invalid signature');
    return res.status(403).json({ error: 'invalid_signature' });
  }

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'invalid_json' });
  }

  console.log('[paywuz webhook] received', {
    event,
    deliveryId,
    orderId: payload.orderId,
    status: payload.status
  });

  return res.status(200).json({ received: true });
}
