/**
 * POST /api/submit
 *
 * The single place all registrations flow through. This function:
 *   1. Verifies the Discord auth JWT (proves the user actually went through OAuth)
 *   2. Forwards the verified identity + form payload to the Apps Script webhook
 *   3. Returns the Apps Script response to the client
 *
 * Why this exists instead of the React app POSTing directly to Apps Script:
 *   - The JWT secret stays server-side (browser never sees it)
 *   - Apps Script trusts the discordId/username because it can only come from
 *     a JWT we minted, which can only be minted after a real OAuth flow
 *   - Single chokepoint to add rate limiting / logging later
 *
 * Required env vars:
 *   AUTH_JWT_SECRET
 *   SHEETS_WEBHOOK_URL    — the Apps Script /exec URL
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!jwtSecret || !sheetsUrl) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  const { authToken, ...registration } = req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord identity expired — please sign in again." });
  }

  // Inject the verified identity. The client-supplied discordId is ignored —
  // we trust only what we can verify.
  const payload = {
    ...registration,
    discordId: verified.sub,
    discordUsername: verified.global_name || verified.username,
  };

  try {
    const upstream = await fetch(sheetsUrl, {
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
