/**
 * GET /api/discord/callback?code=...&state=...
 *
 * Discord redirects here after the user authorizes. We:
 *   1. Verify the state matches the cookie (CSRF guard)
 *   2. Exchange the code for an access token (server-to-server, secret-protected)
 *   3. Fetch the user's Discord profile
 *   4. Sign their ID + username into a short-lived JWT
 *   5. Redirect back to /register with the JWT in a query param
 *
 * The frontend then includes the JWT in the registration POST. Apps Script
 * doesn't verify the JWT — we re-verify it here in /api/submit instead, so
 * the secret stays in serverless-land.
 *
 * Required env vars:
 *   DISCORD_CLIENT_ID
 *   DISCORD_CLIENT_SECRET
 *   DISCORD_REDIRECT_URI
 *   AUTH_JWT_SECRET   — random 32+ char string, generate with: openssl rand -hex 32
 */

import crypto from "node:crypto";

function signJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const head = enc(header);
  const body = enc({ ...payload, iat: Math.floor(Date.now() / 1000) });
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${head}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${head}.${body}.${sig}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

export default async function handler(req, res) {
  const { code, state } = req.query;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const jwtSecret = process.env.AUTH_JWT_SECRET;

  if (!code || !state) {
    return res.status(400).send("Missing code or state.");
  }
  if (!clientId || !clientSecret || !redirectUri || !jwtSecret) {
    return res.status(500).send("Server OAuth configuration incomplete.");
  }

  // CSRF guard
  const cookies = parseCookies(req);
  if (!cookies.discord_oauth_state || cookies.discord_oauth_state !== state) {
    return res.status(403).send("State mismatch — please retry sign-in.");
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Token exchange failed:", text);
      return res.status(502).send("Discord token exchange failed.");
    }
    const tokenJson = await tokenRes.json();

    // Fetch user identity
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      return res.status(502).send("Failed to fetch Discord user.");
    }
    const user = await userRes.json();

    // Sign a 30-min JWT containing the verified identity
    const token = signJWT(
      {
        sub: user.id,
        username: user.username,
        global_name: user.global_name || user.username,
        exp: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      jwtSecret
    );

    // Clear the state cookie (one-time use)
    res.setHeader(
      "Set-Cookie",
      "discord_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );

    // Redirect back to the SPA with the JWT. The React app reads it from the
    // URL hash (so it doesn't appear in server logs as a query param).
    res.redirect(302, `/?auth=${encodeURIComponent(token)}#/register`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth flow failed.");
  }
}
