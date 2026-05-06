/**
 * POST /api/admin/revert-result
 *
 * Reverts a previously-entered match result. Mod-only.
 * Option A semantics: rejected if downstream matches already have results.
 *
 * Body: { authToken: "<JWT>", matchId: "WB-R1-M1", notes: "optional" }
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

  const { authToken, matchId, notes } = req.body || {};
  const verified = verifyJWT(authToken, jwtSecret);
  if (!verified) {
    return res
      .status(401)
      .json({ ok: false, error: "Discord session expired." });
  }

  const modCheck = await callAppsScript(webhookUrl, {
    action: "verifyMod",
    adminSecret,
    discordId: verified.sub,
  });
  if (!modCheck.isMod) {
    return res
      .status(403)
      .json({ ok: false, error: "Only mods can revert results." });
  }

  if (!matchId || typeof matchId !== "string") {
    return res.status(400).json({ ok: false, error: "matchId is required." });
  }

  try {
    const result = await callAppsScript(webhookUrl, {
      action: "revertResult",
      adminSecret,
      matchId,
      notes: notes || "",
      reportedById: verified.sub,
      reportedByName: verified.global_name || verified.username,
    });
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("revert-result failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach bracket store." });
  }
}
