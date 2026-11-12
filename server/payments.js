/**
 * ZYREX STORE — Razorpay integration (TEST MODE ready).
 *
 * Orders are created on the server with the secret key, and every payment is
 * verified with an HMAC-SHA256 signature before an order is confirmed. Card
 * numbers, CVV and UPI credentials never touch this application.
 *
 * When RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are absent the module reports
 * "not configured" and the API refuses online payment instead of faking success.
 */
import crypto from 'node:crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export const razorpayConfigured = () => Boolean(KEY_ID && KEY_SECRET);

export const razorpayPublicConfig = () => ({
  configured: razorpayConfigured(),
  key_id: KEY_ID ? KEY_ID : '',
  mode: KEY_ID.startsWith('rzp_live_') ? 'live' : 'test',
  provider: 'razorpay',
});

/**
 * Create a Razorpay order. Amount is in paise.
 * @returns {Promise<{ok:boolean, order?:object, error?:string}>}
 */
export async function createRazorpayOrder({ amountInPaise, receipt, notes = {} }) {
  if (!razorpayConfigured()) {
    return { ok: false, error: 'Razorpay is not configured on the server.' };
  }
  if (!Number.isInteger(amountInPaise) || amountInPaise < 100) {
    return { ok: false, error: 'Invalid order amount.' };
  }
  try {
    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amountInPaise, currency: 'INR', receipt, notes, payment_capture: 1 }),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error?.description || `Razorpay rejected the order (${response.status}).` };
    }
    return { ok: true, order: data };
  } catch (err) {
    return { ok: false, error: `Could not reach Razorpay: ${err.message}` };
  }
}

/**
 * Verify the checkout signature: HMAC_SHA256(order_id + "|" + payment_id, secret).
 * A missing or mismatched signature must never confirm an order.
 */
export function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpayConfigured()) return false;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(razorpay_signature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verify a Razorpay webhook signature against the raw request body. */
export function verifyWebhookSignature(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Fetch a payment from Razorpay so order state comes from the gateway, not the client. */
export async function fetchPayment(paymentId) {
  if (!razorpayConfigured()) return { ok: false, error: 'Razorpay is not configured on the server.' };
  try {
    const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data?.error?.description || 'Payment lookup failed.' };
    return { ok: true, payment: data };
  } catch (err) {
    return { ok: false, error: `Could not reach Razorpay: ${err.message}` };
  }
}
