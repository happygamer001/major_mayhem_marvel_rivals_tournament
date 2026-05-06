/**
 * GET /api/discord/auth
 *
 * Kicks off Discord OAuth. Redirects the browser to Discord's authorization
 * page. After the user clicks "Authorize", Discord redirects back to
 * /api/discord/callback with a one-time code.
 *
 * Optional query param:
 *   return_to=admin   → callback redirects to /admin instead of /
 *
 * Required environment variables:
 *   DISCORD_CLIENT_ID
 *   DISCORD_REDIRECT_URI   — e.g. https://your-domain.vercel.app/api/discord/callback
 */

import crypto from "node:crypto";

// Allowlist of valid return_to values. Anything else is treated as default
// to prevent open-redirect abuse (where someone crafts a malicious
// return_to=https://evil.com link).
const VALID_RETURN_TO = new Set(["admin", "register"]);

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      ok: false,
      error: "Server is missing Discord OAuth configuration.",
    });
  }

  const requestedReturn = String(req.query?.return_to || "").trim();
  const returnTo = VALID_RETURN_TO.has(requestedReturn) ? requestedReturn : "register";

  // CSRF guard token, base32-ish for cookie safety
  const csrfToken = crypto.randomBytes(16).toString("hex");
  // Encode return_to into the OAuth state so it survives the round-trip.
  // Discord echoes state back to us; we split it on a delimiter that won't
  // appear in the random hex.
  const state = `${csrfToken}.${returnTo}`;

  // 10-minute cookie window — only the CSRF half gets stored, not return_to,
  // since return_to is also in the state and we cross-reference.
  res.setHeader(
    "Set-Cookie",
    `discord_oauth_state=${csrfToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });

  res.redirect(302, `https://discord.com/api/oauth2/authorize?${params}`);
}
