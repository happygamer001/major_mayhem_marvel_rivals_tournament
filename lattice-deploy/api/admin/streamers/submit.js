/**
 * POST /api/streamers/submit
 *
 * Submits a streamer application. Requires a valid Discord JWT (user must
 * be signed in). The application lands in the Streamers sheet as "pending".
 *
 * Body:
 *   {
 *     authToken: "<JWT>",
 *     streamerName: "...",
 *     twitchUrl: "https://twitch.tv/...",
 *     familyFriendly: true|false,
 *     notes: ""    // optional
 *   }
 *
 * Required env: AUTH_JWT_SECRET, SHEETS_WEBHOOK_URL, ADMIN_SHARED_SECRET
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

  const { authToken, streamerName, twitchUrl, familyFriendly, notes } =
    req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired. Sign in again." });
  }

  if (!streamerName || !String(streamerName).trim()) {
    return res
      .status(400)
      .json({ ok: false, error: "Streamer name is required." });
  }
  if (!twitchUrl || !/^https?:\/\//i.test(String(twitchUrl).trim())) {
    return res.status(400).json({
      ok: false,
      error: "Twitch URL must start with http:// or https://"
    });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "submitStreamerApplication",
        adminSecret,
        discordId: verified.sub,
        discordUsername: verified.username || verified.global_name || "",
        streamerName: String(streamerName).trim(),
        twitchUrl: String(twitchUrl).trim(),
        familyFriendly: !!familyFriendly,
        notes: notes ? String(notes).trim() : "",
      }),
    });
    const result = await upstream.json();
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error("streamer submit failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach store." });
  }
}
