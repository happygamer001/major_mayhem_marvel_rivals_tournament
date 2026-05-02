/**
 * POST /api/paypal/create-order
 *
 * Creates a PayPal order with the correct amount based on team composition.
 * The price is calculated SERVER-SIDE from teamType + partialMemberCount —
 * never trust the client to tell us the total.
 *
 * Required body:
 *   {
 *     authToken: "<JWT from Discord OAuth>",
 *     teamType: "solo" | "partial" | "full",
 *     partialMemberCount: 2-5 (only when teamType === "partial")
 *   }
 *
 * Returns:
 *   { ok: true, orderId: "...", amount: "30.00" }
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV (sandbox|live)
 *   AUTH_JWT_SECRET
 */

import crypto from "node:crypto";

const PER_MEMBER_FEE = 5; // must match frontend computeFee()

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

function computeSeats(teamType, partialMemberCount) {
  if (teamType === "solo") return 1;
  if (teamType === "full") return 6;
  if (teamType === "partial") {
    const n = Number(partialMemberCount);
    if (n >= 2 && n <= 5) return n;
  }
  return 0;
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token request failed: ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (
    !jwtSecret ||
    !process.env.PAYPAL_CLIENT_ID ||
    !process.env.PAYPAL_CLIENT_SECRET
  ) {
    return res
      .status(500)
      .json({ ok: false, error: "Server is missing PayPal configuration." });
  }

  const { authToken, teamType, partialMemberCount } = req.body || {};

  // Verify Discord identity — same gate as everywhere else
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired. Please sign in again." });
  }

  const seats = computeSeats(teamType, partialMemberCount);
  if (seats === 0) {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid team composition." });
  }

  const total = (seats * PER_MEMBER_FEE).toFixed(2);

  try {
    const accessToken = await getPaypalAccessToken();

    const orderRes = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: total,
              breakdown: {
                item_total: { currency_code: "USD", value: total },
              },
            },
            items: [
              {
                name: "Lattice Open Tournament Entry",
                description: `${seats} player${seats === 1 ? "" : "s"} × $${PER_MEMBER_FEE}`,
                quantity: String(seats),
                unit_amount: { currency_code: "USD", value: PER_MEMBER_FEE.toFixed(2) },
              },
            ],
            custom_id: verified.sub, // Discord ID — for refund/dispute lookup
          },
        ],
        application_context: {
          brand_name: "Major Mayhem · Lattice Open",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!orderRes.ok) {
      const text = await orderRes.text();
      console.error("PayPal create-order error:", text);
      return res
        .status(502)
        .json({ ok: false, error: "Could not create PayPal order." });
    }

    const order = await orderRes.json();
    return res.json({ ok: true, orderId: order.id, amount: total, seats });
  } catch (err) {
    console.error("create-order failed:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Server error creating order." });
  }
}
