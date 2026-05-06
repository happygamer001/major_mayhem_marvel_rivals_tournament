/**
 * POST /api/admin/init-bracket
 *
 * Mod-gated. Accepts a seeded list of 16 teams and writes them into the
 * bracket's WB-R1 slots in the Google Sheet.
 *
 * Body:
 *   {
 *     authToken: "<JWT>",
 *     seededTeams: [
 *       { teamId: "...", teamName: "..." },
 *       ...16 entries
 *     ]
 *   }
 *
 * The order of the array IS the seed order. Position 0 plays position 1 in
 * WB-R1-M1, position 2 plays position 3 in WB-R1-M2, etc. So mods set the
 * pairings client-side via drag-and-drop, then submit the final order.
 *
 * Two-layer auth:
 *   1. Discord JWT must be valid
 *   2. The authenticated Discord ID must be in the Mods sheet
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

async function callAppsScript(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  return res.json();
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

  const { authToken, seededTeams } = req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired." });
  }

  // Mod check
  const modCheck = await callAppsScript(webhookUrl, {
    action: "verifyMod",
    adminSecret,
    discordId: verified.sub,
  });
  if (!modCheck.isMod) {
    return res
      .status(403)
      .json({ ok: false, error: "Only mods can initialize the bracket." });
  }

  // Validate payload shape
  if (!Array.isArray(seededTeams) || seededTeams.length !== 16) {
    return res.status(400).json({
      ok: false,
      error: "Need exactly 16 seeded teams.",
    });
  }
  for (const t of seededTeams) {
    if (!t.teamId || !t.teamName) {
      return res.status(400).json({
        ok: false,
        error: "Each team must have teamId and teamName.",
      });
    }
  }

  try {
    const result = await callAppsScript(webhookUrl, {
      action: "initBracket",
      adminSecret,
      seededTeams,
    });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("init-bracket failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach bracket store." });
  }
}
