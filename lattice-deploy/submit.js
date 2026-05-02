/**
 * POST /api/submit
 *
 * Single chokepoint for finalized registrations. Requires:
 *   - Valid Discord JWT (proves OAuth completed)
 *   - PayPal orderId (we re-verify the capture server-side)
 *
 * We RE-VERIFY the PayPal capture server-side instead of trusting the client
 * payload. A malicious client could otherwise claim "I paid, here's a fake
 * orderId" and we'd record an unpaid registration.
 *
 * Required env vars:
 *   AUTH_JWT_SECRET, SHEETS_WEBHOOK_URL,
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV
 */

import crypto from "node:crypto";

function verifyJWT(token, secret) {
  const [head, body, sig] = (token || "").split(".");
  if (!head || !body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${head}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function paypalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPaypalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal token request failed");
  return (await res.json()).access_token;
}

/**
 * Re-fetch the order from PayPal and confirm it's actually CAPTURED.
 * Don't trust the client's claim that it was paid.
 */
async function verifyPayPalCapture(orderId) {
  const token = await getPaypalAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const order = await res.json();
  if (order.status !== "COMPLETED") return null;
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") return null;
  return {
    captureId: capture.id,
    amount: capture.amount?.value,
    payerEmail: order.payer?.email_address,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (
    !process.env.AUTH_JWT_SECRET ||
    !process.env.SHEETS_WEBHOOK_URL ||
    !process.env.PAYPAL_CLIENT_ID
  ) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  const { authToken, paypalOrderId, ...registration } = req.body || {};

  // Discord identity gate
  const verified = verifyJWT(authToken, process.env.AUTH_JWT_SECRET);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord identity expired. Please sign in again." });
  }

  // PayPal proof gate — server-side verification, no client trust
  if (!paypalOrderId) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing PayPal order ID." });
  }
  const paymentProof = await verifyPayPalCapture(paypalOrderId);
  if (!paymentProof) {
    return res
      .status(402)
      .json({ ok: false, error: "Payment not verified. Please retry." });
  }

  // Inject verified identity + payment details
  const payload = {
    ...registration,
    discordId: verified.sub,
    discordUsername: verified.global_name || verified.username,
    paypalOrderId,
    paypalCaptureId: paymentProof.captureId,
    paypalAmount: paymentProof.amount,
    paypalPayerEmail: paymentProof.payerEmail,
    paymentStatus: "Paid",
  };

  try {
    const upstream = await fetch(process.env.SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const result = await upstream.json();
    return res.status(upstream.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("Sheets forward failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach registration backend." });
  }
}
