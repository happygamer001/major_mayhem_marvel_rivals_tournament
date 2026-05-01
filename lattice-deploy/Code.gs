/**
 * LATTICE OPEN — Registration webhook v2 (LOCKDOWN)
 * --------------------------------------------------
 * Layers active in this version:
 *   1. Cloudflare Turnstile  → blocks bots
 *   2. Invite codes          → only pre-approved players can register
 *   3. Discord OAuth         → handled by Vercel serverless function (separate)
 *
 * The frontend POSTs:
 *   {
 *     ...registrationFields,
 *     turnstileToken: "...",
 *     inviteCode: "ABC12345",
 *     discordId: "snowflake from OAuth",
 *     discordUsername: "verified handle from OAuth"
 *   }
 *
 * Apps Script:
 *   - verifies the Turnstile token with Cloudflare
 *   - looks up the invite code in the "Invites" tab
 *   - if both pass, appends the registration AND marks the invite as redeemed
 */

/* ─────────────────────────── CONFIG ─────────────────────────── */

const REG_SHEET = "Registrations";
const INVITES_SHEET = "Invites";

// Set this in: Apps Script editor → ⚙ Project Settings → Script Properties.
// Key: TURNSTILE_SECRET_KEY  Value: (from Cloudflare dashboard)
// We read it at runtime so the secret never lives in the source.

const REG_HEADERS = [
  "Timestamp",
  "Invite Code",
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

const INVITE_HEADERS = [
  "Code",
  "Status",         // "Active" | "Redeemed" | "Revoked"
  "Issued To",      // optional — name/Discord of the invited person
  "Issued At",
  "Redeemed At",
  "Redeemed By IGN",
];

/* ─────────────────────────── ENTRYPOINTS ─────────────────────────── */

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: "lattice-open-registrations",
    version: "v2-lockdown",
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

    // ─── Layer 2: Invite code ───
    if (!data.inviteCode) {
      return jsonResponse({ ok: false, error: "Invite code required." }, 400);
    }
    const inviteResult = validateAndRedeemInvite(data.inviteCode, data.ign);
    if (!inviteResult.ok) {
      return jsonResponse({ ok: false, error: inviteResult.error }, 403);
    }

    // ─── Layer 3: Discord OAuth (verified upstream by serverless fn) ───
    // We trust discordId/discordUsername in the payload because the React app
    // only ever has those values after a successful Discord OAuth round-trip
    // through our Vercel /api/discord/* endpoints. Apps Script doesn't need
    // to re-verify — it just records what came through.
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
      " (Discord: " + data.discordUsername + ", code: " + data.inviteCode + ")"
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

/* ─────────────────────────── LAYER 2: INVITE CODES ─────────────────────────── */

/**
 * Atomically validate + redeem an invite code.
 * Uses LockService to prevent two parallel registrations from claiming the
 * same code (race condition).
 */
function validateAndRedeemInvite(code, ign) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // up to 10s

  try {
    const sheet = getOrCreateSheet(INVITES_SHEET, INVITE_HEADERS);
    const data = sheet.getDataRange().getValues();
    const normalizedCode = String(code).trim().toUpperCase();

    // Row 0 is headers — start at 1.
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === normalizedCode) {
        const status = data[i][1];
        if (status === "Redeemed") {
          return { ok: false, error: "This invite code has already been used." };
        }
        if (status === "Revoked") {
          return { ok: false, error: "This invite code is no longer valid." };
        }
        if (status !== "Active") {
          return { ok: false, error: "Invite code is in an unknown state." };
        }

        // Mark as redeemed — sheet rows are 1-indexed in the API.
        const rowIndex = i + 1;
        sheet.getRange(rowIndex, 2).setValue("Redeemed"); // Status
        sheet.getRange(rowIndex, 5).setValue(new Date());  // Redeemed At
        sheet.getRange(rowIndex, 6).setValue(ign || "");   // Redeemed By IGN
        return { ok: true };
      }
    }

    return { ok: false, error: "Invite code not found." };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run this from the Apps Script editor to mint a batch of invite codes.
 *   1. Open the editor
 *   2. Select "generateInviteCodes" from the function dropdown
 *   3. Click ▶ Run
 *   4. New codes appear in the Invites tab as "Active"
 */
function generateInviteCodes() {
  const COUNT = 20; // change as needed
  const sheet = getOrCreateSheet(INVITES_SHEET, INVITE_HEADERS);
  const rows = [];
  for (let i = 0; i < COUNT; i++) {
    rows.push([generateCode(), "Active", "", new Date(), "", ""]);
  }
  sheet
    .getRange(sheet.getLastRow() + 1, 1, rows.length, INVITE_HEADERS.length)
    .setValues(rows);
  Logger.log("Generated " + COUNT + " invite codes.");
  SpreadsheetApp.getUi().alert(
    "Generated " + COUNT + " invite codes. Check the Invites tab."
  );
}

function generateCode() {
  // 8 chars, A-Z + 2-9 (no 0/O/1/I to avoid confusion when reading aloud).
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
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
    data.inviteCode,
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
