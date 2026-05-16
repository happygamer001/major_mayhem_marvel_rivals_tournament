/**
 * POST /api/sponsors/inquiry
 *
 * Public — accepts a "Become a Sponsor" inquiry. Protected by Cloudflare
 * Turnstile (the same captcha used on tournament registration). On success
 * the inquiry is written to the SponsorInquiries sheet tab and an email
 * notification fires to the organizer (handled in Apps Script).
 *
 * Body:
 *   {
 *     name: "...",
 *     email: "...",
 *     company: "...",
 *     interest: "...",
 *     budget: "...",
 *     message: "...",
 *     turnstileToken: "..."
 *   }
 *
 * Required env:
 *   SHEETS_WEBHOOK_URL
 *   TURNSTILE_SECRET_KEY
 */

async function verifyTurnstile(token, secret, remoteIp) {
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteIp) form.append("remoteip", remoteIp);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      }
    );
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!webhookUrl) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  const { name, email, company, interest, budget, message, turnstileToken } =
    req.body || {};

  // Turnstile check — only enforced if the secret is configured, so the
  // form still works in environments where Turnstile isn't set up yet.
  if (turnstileSecret) {
    if (!turnstileToken) {
      return res
        .status(400)
        .json({ ok: false, error: "Captcha verification required." });
    }
    const remoteIp =
      req.headers["cf-connecting-ip"] ||
      req.headers["x-forwarded-for"] ||
      "";
    const ok = await verifyTurnstile(
      turnstileToken,
      turnstileSecret,
      String(remoteIp).split(",")[0].trim()
    );
    if (!ok) {
      return res
        .status(400)
        .json({ ok: false, error: "Captcha verification failed." });
    }
  }

  if (!name || !email) {
    return res
      .status(400)
      .json({ ok: false, error: "Name and email are required." });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "submitSponsorInquiry",
        name,
        email,
        company: company || "",
        interest: interest || "",
        budget: budget || "",
        message: message || "",
      }),
    });
    const result = await upstream.json();
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error("/api/sponsors/inquiry failed:", err);
    return res.status(502).json({ ok: false, error: "Could not reach store." });
  }
}
