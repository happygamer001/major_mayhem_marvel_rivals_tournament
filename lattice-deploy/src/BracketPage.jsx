/**
 * GET /api/bracket
 *
 * Returns the current bracket state. Public — no auth required.
 * Used by the admin page (mods need to see matches to enter results) and
 * eventually the public bracket view.
 *
 * Cached for 5 seconds at the edge to absorb polling traffic without
 * hammering Apps Script (which has a quota of 20,000 URL fetches/day per
 * Google account).
 *
 * Required env vars: SHEETS_WEBHOOK_URL
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const webhookUrl = process.env.SHEETS_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ ok: false, error: "Server misconfigured." });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getBracket" }),
    });
    const result = await upstream.json();

    // 5-second edge cache; admin polls every 10s so this protects the upstream.
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
    return res.status(upstream.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("bracket fetch failed:", err);
    return res
      .status(502)
      .json({ ok: false, error: "Could not reach bracket store." });
  }
}
