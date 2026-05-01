/**
 * Lattice Open Tournament — Registration logger
 * ----------------------------------------------
 * Bound to a Google Sheet. Receives POST requests from the registration
 * web app and appends a row per registration.
 *
 * Setup (~5 minutes):
 *   1. Create a new Google Sheet. Name it whatever you want.
 *   2. Extensions → Apps Script. Delete the placeholder code and paste this in.
 *   3. Save. Run the `setupSheet` function once to create headers
 *      (Apps Script will ask for permission — grant it).
 *   4. Deploy → New deployment → Web app
 *        - Description: "Lattice Open Registrations"
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy the resulting Web app URL.
 *   5. Add that URL as VITE_SHEETS_URL in Vercel → Project Settings → Environment
 *      Variables, then redeploy.
 *
 * Re-deploying after edits: Deploy → Manage deployments → pencil icon
 * → Version: New version → Deploy. Same URL is preserved.
 */

const SHEET_NAME = "Registrations";

const HEADERS = [
  "Timestamp",
  "Registration ID",
  "Full Name",
  "Discord Username",
  "IGN",
  "Rank",
  "Servers",
  "Streamer?",
  "Team Type",
  "Team Name",
  "Captain Confirmed?",
  "Captain Responsibility Acknowledged?",
  "Team Name Approval",
  "Discord TOS",
  "Tournament TOS",
  "RPMA TOS",
  "Broadcasting TOS",
  "Payment Status",
];

/**
 * Run this ONCE manually from the Apps Script editor to create the
 * sheet tab and header row. Safe to re-run — it's idempotent.
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // Write headers
  sheet
    .getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight("bold")
    .setBackground("#fbbf24")
    .setFontColor("#0a0e1a");

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);

  Logger.log("Sheet ready with " + HEADERS.length + " columns.");
}

/**
 * POST handler — called by the registration form.
 * Body must be a JSON string (Content-Type: text/plain to skip CORS preflight).
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "Empty request body." });
    }

    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Auto-create on first run if someone forgot to call setupSheet()
    if (!sheet) {
      setupSheet();
      sheet = ss.getSheetByName(SHEET_NAME);
    }

    const teamNameApproval =
      data.teamType === "full" ? "Pending Review" : "N/A";

    const row = [
      new Date(),
      data.registrationId || "",
      data.fullName || "",
      data.discordName || "",
      data.ign || "",
      data.rank || "",
      Array.isArray(data.servers) ? data.servers.join(", ") : "",
      data.isStreamer ? "Yes" : "No",
      data.teamType || "",
      data.teamName || "",
      data.confirmedCaptain ? "Yes" : "No",
      data.acknowledgedCaptainResponsibility ? "Yes" : "No",
      teamNameApproval,
      data.agreedDiscordTOS ? "Yes" : "No",
      data.agreedTournamentTOS ? "Yes" : "No",
      data.agreedRPMA ? "Yes" : "No",
      data.agreedBroadcastTOS ? "Yes" : "No",
      data.paymentStatus || "pending",
    ];

    sheet.appendRow(row);

    return jsonResponse({
      ok: true,
      registrationId: data.registrationId,
      rowNumber: sheet.getLastRow(),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/**
 * Friendly GET handler — visit the web app URL in a browser to verify
 * the deployment is live.
 */
function doGet() {
  return jsonResponse({
    ok: true,
    service: "Lattice Open · Registration Logger",
    method: "POST your registration JSON to this URL.",
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
