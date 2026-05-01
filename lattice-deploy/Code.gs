/**
 * LATTICE OPEN — Registration webhook v3 (DISCORD + TURNSTILE)
 * -------------------------------------------------------------
 * Layers active in this version:
 *   1. Cloudflare Turnstile  → blocks bots
 *   2. Discord OAuth         → handled by Vercel serverless function (separate)
 *
 * Layer 2 (invite codes) was removed. Anyone with a Discord account can
 * register, subject to Turnstile + manual mod review of submissions.
 */

/* ─────────────────────────── CONFIG ─────────────────────────── */

const REG_SHEET = "Registrations";

// Turnstile secret lives in: Apps Script editor → ⚙ Project Settings →
// Script Properties. Key: TURNSTILE_SECRET_KEY

const REG_HEADERS = [
  "Timestamp",
  "Discord ID (OAuth)",
  "Discord Username (OAuth)",
  "Full Name",
  "Discord (self-reported)",
  "IGN",
  "Rank",
  "Servers",
  "Streamer?",
  "Team Type",
  "Team Name",
  "Seats",
  "Fee Charged",
  "Captain Confirmed",
  "Captain Responsibility Ack",
  "Discord TOS",
  "Tournament TOS",
  "RPMA",
  "Broadcasting TOS",
  "Payment Status",
  "Team Name Approval",
  "Notes",
];

/* ─────────────────────────── ENTRYPOINTS ─────────────────────────── */

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: "lattice-open-registrations",
    version: "v3-no-invites",
    message: "Endpoint live. POST registrations here.",
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No payload received." }, 400);
    }

    const data = JSON.parse(e.postData.contents);

    // ─── Layer 1: Cloudflare Turnstile ───
    if (!data.turnstileToken) {
      return jsonResponse({ ok: false, error: "Missing captcha token." }, 400);
    }
    const captchaOk = verifyTurnstile(data.turnstileToken);
    if (!captchaOk) {
      return jsonResponse({ ok: false, error: "Captcha verification failed." }, 403);
    }

    // ─── Layer 2: Discord OAuth (verified upstream by serverless fn) ───
    // The React app only ever has discordId/discordUsername after a successful
    // Discord OAuth round-trip through our Vercel /api/discord/* endpoints.
    if (!data.discordId || !data.discordUsername) {
      return jsonResponse(
        { ok: false, error: "Discord identity not verified." },
        403
      );
    }

    // Light field validation
    const missing = ["fullName", "ign", "rank", "teamType"].filter(
      (f) => !data[f] || typeof data[f] !== "string" || !data[f].trim()
    );
    if (missing.length > 0) {
      return jsonResponse(
        { ok: false, error: "Missing fields: " + missing.join(", ") },
        400
      );
    }

    // All gates passed — append the registration.
    const sheet = getOrCreateSheet(REG_SHEET, REG_HEADERS);
    sheet.appendRow(buildRow(data));

    Logger.log(
      "Registration recorded: " + data.fullName + " / " + data.ign +
      " (Discord: " + data.discordUsername + ")"
    );
    return jsonResponse({ ok: true, message: "Registration recorded." });
  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return jsonResponse({ ok: false, error: err.toString() }, 500);
  }
}

/* ─────────────────────────── LAYER 1: TURNSTILE ─────────────────────────── */

function verifyTurnstile(token) {
  const secret = PropertiesService.getScriptProperties().getProperty(
    "TURNSTILE_SECRET_KEY"
  );
  if (!secret) {
    Logger.log("WARN: TURNSTILE_SECRET_KEY not set in Script Properties.");
    return false;
  }

  try {
    const response = UrlFetchApp.fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "post",
        payload: { secret: secret, response: token },
        muteHttpExceptions: true,
      }
    );
    const result = JSON.parse(response.getContentText());
    return result.success === true;
  } catch (err) {
    Logger.log("Turnstile verification error: " + err.toString());
    return false;
  }
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    writeHeaders(sheet, headers);
  } else if (sheet.getLastRow() === 0) {
    writeHeaders(sheet, headers);
  }
  return sheet;
}

function writeHeaders(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet
    .getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#fbbf24")
    .setFontColor("#000000");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function buildRow(data) {
  const isFull = data.teamType === "full";
  const isIncomplete = data.teamType === "solo" || data.teamType === "partial";
  const yn = (v) => (v ? "Yes" : "No");
  const ynNA = (cond, v) => (cond ? yn(v) : "N/A");

  // Compute seats per the per-member fee model (must match frontend).
  const PER_MEMBER_FEE = 5;
  const seats =
    data.teamType === "solo"
      ? 1
      : data.teamType === "full"
      ? 6
      : data.teamType === "partial"
      ? Number(data.partialMemberCount) || 0
      : 0;
  const fee = seats * PER_MEMBER_FEE;

  const teamTypeLabel = {
    solo: "Solo Player",
    partial: "Partial Team (" + (data.partialMemberCount || "?") + ")",
    full: "Full Team (6)",
  }[data.teamType] || data.teamType;

  return [
    new Date(),
    data.discordId,
    data.discordUsername,
    data.fullName,
    data.discordName,
    data.ign,
    data.rank,
    Array.isArray(data.servers) ? data.servers.join(", ") : "",
    yn(data.isStreamer),
    teamTypeLabel,
    isFull ? data.teamName : "—",
    seats,
    "$" + fee,
    ynNA(isFull, data.confirmedCaptain),
    ynNA(isFull, data.acknowledgedCaptainResponsibility),
    yn(data.agreedDiscordTOS),
    yn(data.agreedTournamentTOS),
    ynNA(isIncomplete, data.agreedRPMA),
    yn(data.agreedBroadcastTOS),
    data.paymentStatus || "Pending",
    isFull ? "Pending Review" : "N/A",
    "",
  ];
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
