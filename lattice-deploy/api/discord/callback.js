/**
 * GET /api/discord/callback?code=...&state=...
 *
 * Discord redirects here after the user authorizes. We:
 *   1. Verify the CSRF half of the state matches the cookie
 *   2. Extract the return_to half of the state to know where to redirect
 *   3. Exchange the code for an access token (server-to-server)
 *   4. Fetch the user's Discord profile
 *   5. Sign their ID + username into a short-lived JWT
 *   6. Redirect back to the appropriate page (/ or /admin) with the JWT
 *
 * Required env vars:
 *   DISCORD_CLIENT_ID
 *   DISCORD_CLIENT_SECRET
 *   DISCORD_REDIRECT_URI
 *   AUTH_JWT_SECRET   — random 32+ char string, generate with: openssl rand -hex 32
 */

import crypto from "node:crypto";

const VALID_RETURN_TO = new Set(["admin", "register", "streamers"]);

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

  // State format: "{csrfToken}.{returnTo}"
  const [csrfFromState, returnToFromState] = String(state).split(".");
  const returnTo = VALID_RETURN_TO.has(returnToFromState)
    ? returnToFromState
    : "register";

  // CSRF guard
  const cookies = parseCookies(req);
  if (!cookies.discord_oauth_state || cookies.discord_oauth_state !== csrfFromState) {
    return res.status(403).send("State mismatch — please retry sign-in.");
  }

  try {
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

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      return res.status(502).send("Failed to fetch Discord user.");
    }
    const user = await userRes.json();

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

    // Redirect to the appropriate destination
    let dest = "/";
    if (returnTo === "admin") dest = "/admin";
    else if (returnTo === "streamers") dest = "/streamers";
    res.redirect(302, `${dest}?auth=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("OAuth flow failed.");
  }
}
