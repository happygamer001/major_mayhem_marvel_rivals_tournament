/**
 * submitRegistration — sends a registration to the Google Sheet via Apps Script.
 *
 * The Apps Script URL is read from VITE_SHEETS_URL (set in Vercel env vars,
 * or in a local .env.local file for development).
 *
 * Why Content-Type is text/plain:
 *   Google Apps Script web apps don't respond to OPTIONS preflight requests.
 *   Sending JSON with Content-Type: application/json triggers a preflight,
 *   which fails. Sending the same JSON string with Content-Type: text/plain
 *   is a "simple request" — no preflight, works clean. Apps Script reads
 *   the body via e.postData.contents and JSON.parse it server-side.
 */
export async function submitRegistration(data) {
  const url = import.meta.env.VITE_SHEETS_URL;

  if (!url) {
    console.warn(
      "[submitRegistration] VITE_SHEETS_URL is not set — registration was NOT logged. " +
        "Set it in Vercel → Project Settings → Environment Variables, then redeploy."
    );
    return { ok: false, error: "missing_url" };
  }

  // Generate a short, human-readable ID client-side. Format: LO-<base36 timestamp>-<6 random chars>
  const registrationId = `LO-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  const payload = {
    ...data,
    registrationId,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json.ok) {
      throw new Error(json.error || "Unknown error from sheet");
    }
    return { ok: true, registrationId, ...json };
  } catch (err) {
    console.error("[submitRegistration] failed:", err);
    return { ok: false, error: err.message, registrationId };
  }
}
