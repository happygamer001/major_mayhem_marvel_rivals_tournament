/**
 * POST /api/paypal/capture-order
 *
 * After the buyer authorizes on PayPal, this endpoint finalizes the charge.
 * Returns the captured payment details which the frontend then includes in
 * the registration submission to Apps Script.
 *
 * Required body:
 *   { authToken: "<JWT>", orderId: "<from create-order>" }
 *
 * Returns on success:
 *   {
 *     ok: true,
 *     orderId: "...",
 *     captureId: "...",  // the actual transaction ID (use for refunds)
 *     amount: "30.00",
 *     payerEmail: "buyer@example.com",
 *     payerName: "Buyer Name"
 *   }
 *
 * Required env vars: same as create-order
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
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("PayPal token request failed");
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret || !process.env.PAYPAL_CLIENT_ID) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  const { authToken, orderId } = req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired. Please sign in again." });
  }
  if (!orderId) {
    return res.status(400).json({ ok: false, error: "Missing orderId." });
  }

  try {
    const accessToken = await getPaypalAccessToken();

    const captureRes = await fetch(
      `${paypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!captureRes.ok) {
      const text = await captureRes.text();
      console.error("PayPal capture error:", text);
      return res
        .status(502)
        .json({ ok: false, error: "Could not capture PayPal payment." });
    }

    const result = await captureRes.json();

    // Defensive: confirm capture actually succeeded
    if (result.status !== "COMPLETED") {
      console.error("Capture not COMPLETED:", JSON.stringify(result));
      return res
        .status(502)
        .json({ ok: false, error: `Payment not completed (status: ${result.status})` });
    }

    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
    const amount = capture?.amount?.value;
    const captureId = capture?.id;
    const payerEmail = result.payer?.email_address;
    const payerName = [
      result.payer?.name?.given_name,
      result.payer?.name?.surname,
    ]
      .filter(Boolean)
      .join(" ");

    return res.json({
      ok: true,
      orderId,
      captureId,
      amount,
      payerEmail,
      payerName,
    });
  } catch (err) {
    console.error("capture-order failed:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Server error capturing payment." });
  }
}
