/**
 * GET /api/discord/auth
 *
 * Kicks off Discord OAuth. Redirects the browser to Discord's authorization
 * page. After the user clicks "Authorize", Discord redirects back to
 * /api/discord/callback with a one-time code.
 *
 * Required environment variables (set in Vercel → Settings → Env Vars):
 *   DISCORD_CLIENT_ID
 *   DISCORD_REDIRECT_URI   — e.g. https://your-domain.vercel.app/api/discord/callback
 */

import crypto from "node:crypto";

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      ok: false,
      error: "Server is missing Discord OAuth configuration.",
    });
  }

  // Random state token — guards against CSRF on the callback.
  // We set it as an httpOnly cookie and verify it matches in the callback.
  const state = crypto.randomBytes(16).toString("hex");

  // 10-minute cookie window — plenty for the OAuth round-trip.
  res.setHeader(
    "Set-Cookie",
    `discord_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
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
