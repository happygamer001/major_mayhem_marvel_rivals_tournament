/**
 * POST /api/admin/verify
 *
 * Checks if the Discord-authenticated user is in the Mods tab. Used by the
 * admin UI to gate access — non-mods get a "you are not authorized" page
 * instead of the seeding interface.
 *
 * Body: { authToken: "<JWT>" }
 * Returns: { ok: true, isMod: bool, displayName, role }
 *
 * Required env vars:
 *   AUTH_JWT_SECRET, SHEETS_WEBHOOK_URL, ADMIN_SHARED_SECRET
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
  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  const adminSecret = process.env.ADMIN_SHARED_SECRET;
  if (!jwtSecret || !webhookUrl || !adminSecret) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  const { authToken } = req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired." });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "verifyMod",
        adminSecret,
        discordId: verified.sub,
      }),
    });
    const result = await upstream.json();
    return res.json(result);
  } catch (err) {
    console.error("verify-mod failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach mod registry." });
  }
}
