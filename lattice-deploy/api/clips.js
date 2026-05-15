/**
 * GET /api/clips
 *
 * Public — returns all clips, newest first. Edge-cached for 5s.
 *
 * Required env: SHEETS_WEBHOOK_URL
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
      body: JSON.stringify({ action: "getClips" }),
    });
    const result = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
    return res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    console.error("/api/clips failed:", err);
    return res.status(502).json({ ok: false, error: "Could not reach store." });
  }
}
