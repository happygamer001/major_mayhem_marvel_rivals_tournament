/**
 * LATTICE OPEN — Apps Script (Complete)
 * ──────────────────────────────────────────────────────────────────────
 * This is the canonical Code.gs. Replace your entire existing Code.gs
 * with the contents of this file.
 *
 * What it does:
 *   • Receives registration submissions from /api/submit (Vercel)
 *   • Verifies Cloudflare Turnstile tokens server-side
 *   • Logs each registration as a row in the Registrations tab
 *   • Provides bracket admin endpoints for /admin (Vercel)
 *   • Manages mods, bracket initialization, and BYE auto-progression
 *
 * Required Script Properties (Project Settings → Script Properties):
 *   TURNSTILE_SECRET_KEY — Cloudflare Turnstile secret (private key)
 *   ADMIN_SHARED_SECRET  — long random string, must match Vercel env var
 *
 * Deploy as Web App with: Execute as Me, Who has access: Anyone.
 * Re-deploy via "Manage deployments → New version" after every code change.
 * ──────────────────────────────────────────────────────────────────────
 */

/* ════════════════════ CONFIG ════════════════════ */

const REG_SHEET = "Registrations";
const MODS_SHEET = "Mods";
const BRACKET_SHEET = "Bracket";
const MATCHES_SHEET = "Matches";
const STREAMERS_SHEET = "Streamers";
const CLIPS_SHEET = "Clips";
const SPONSORS_SHEET = "Sponsors";
const SPONSOR_INQUIRIES_SHEET = "SponsorInquiries";

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
  "PayPal Order ID",
  "PayPal Capture ID",
  "PayPal Amount",
  "PayPal Payer Email",
  "Captain Confirmed",
  "Captain Responsibility Ack",
  "Discord TOS",
  "Tournament TOS",
  "RPMA",
  "Broadcasting TOS",
  "Payment Status",
  "Team Name Approval",
  "Notes"
];

const MODS_HEADERS = ["Discord ID", "Display Name", "Role", "Added At"];

const BRACKET_HEADERS = [
  "match_id",
  "round",
  "team_a_id",
  "team_a_label",
  "team_b_id",
  "team_b_label",
  "team_a_score",
  "team_b_score",
  "winner_id",
  "loser_id",
  "status",
  "feeds_winner_to",
  "feeds_loser_to",
  "streaming_url",
  "updated_at"
];

const MATCHES_HEADERS = [
  "Timestamp",
  "Match ID",
  "Reported By (Discord ID)",
  "Reported By (Username)",
  "Team A Score",
  "Team B Score",
  "Winner ID",
  "Action",
  "Notes"
];

const STREAMERS_HEADERS = [
  "Timestamp",
  "Discord ID",
  "Discord Username",
  "Streamer Name",
  "Twitch URL",
  "Family Friendly",
  "Status",
  "Featured",
  "Has Tournament Registration",
  "Approved By",
  "Approved At",
  "Notes"
];

const CLIPS_HEADERS = [
  "Timestamp",
  "Twitch Clip URL",
  "Streamer Name",
  "Streamer Twitch URL",
  "Caption",
  "Featured",
  "Added By (Discord ID)",
  "Added By (Username)",
  "Added At"
];

const SPONSORS_HEADERS = [
  "Timestamp",
  "Sponsor Name",
  "Tier",
  "Logo URL",
  "Website URL",
  "Description",
  "Promo Code",
  "Promo Details",
  "Display Order",
  "Active",
  "Added By",
  "Added At"
];

const SPONSOR_INQUIRIES_HEADERS = [
  "Timestamp",
  "Name",
  "Email",
  "Company",
  "Sponsorship Interest",
  "Budget Range",
  "Message",
  "Status",
  "Notes"
];

const BYE_TEAM = { teamId: "__BYE__", teamName: "(BYE)" };

/* ════════════════════ ENTRY POINTS ════════════════════ */

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: "lattice-open-registrations",
    version: "v4-bracket-byes",
    message: "Endpoint live. POST registrations or bracket actions here."
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "No payload received." });
    }

    const data = JSON.parse(e.postData.contents);

    // Bracket actions take precedence — if "action" is present, route there.
    if (data.action) {
      const bracketResponse = routeBracketAction(data);
      if (bracketResponse) return bracketResponse;
    }

    // Registration flow continues below.
    if (!data.turnstileToken) {
      return jsonResponse({ ok: false, error: "Missing captcha token." });
    }
    if (!verifyTurnstile(data.turnstileToken)) {
      return jsonResponse({ ok: false, error: "Captcha verification failed." });
    }
    if (!data.discordId || !data.discordUsername) {
      return jsonResponse({ ok: false, error: "Discord identity not verified." });
    }

    const missing = ["fullName", "ign", "rank", "teamType"].filter(function (f) {
      return !data[f] || typeof data[f] !== "string" || !data[f].trim();
    });
    if (missing.length > 0) {
      return jsonResponse({
        ok: false,
        error: "Missing fields: " + missing.join(", ")
      });
    }

    const sheet = getOrCreateSheet(REG_SHEET, REG_HEADERS);
    sheet.appendRow(buildRegistrationRow(data));

    Logger.log(
      "Registration recorded: " + data.fullName + " / " + data.ign +
      " (Discord: " + data.discordUsername + ")"
    );

    // Fire Discord notification (silently no-op if not configured)
    try {
      notifyDiscordRegistration(data);
    } catch (notifyErr) {
      Logger.log("Discord notify failed: " + notifyErr.toString());
    }

    return jsonResponse({ ok: true, message: "Registration recorded." });
  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

/* ════════════════════ ROUTING ════════════════════ */

function routeBracketAction(data) {
  const adminSecret = PropertiesService.getScriptProperties().getProperty(
    "ADMIN_SHARED_SECRET"
  );
  const isFromTrustedBackend =
    adminSecret && data.adminSecret === adminSecret;

  switch (data.action) {
    case "verifyMod":
      return jsonResponse(verifyMod(data.discordId));
    case "getMods":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse({ ok: true, mods: getMods() });
    case "initBracket":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(initBracket(data.seededTeams || []));
    case "submitResult":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(submitMatchResult(data));
    case "revertResult":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(revertMatchResult(data));
    case "setStream":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(setMatchStream(data));
    case "submitStreamerApplication":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(submitStreamerApplication(data));
    case "approveStreamer":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(approveStreamer(data));
    case "rejectStreamer":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(rejectStreamer(data));
    case "toggleFeaturedStreamer":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(toggleFeaturedStreamer(data));
    case "addClip":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(addClip(data));
    case "removeClip":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(removeClip(data));
    case "toggleFeaturedClip":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(toggleFeaturedClip(data));
    case "listAllStreamers":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse({ ok: true, streamers: listAllStreamers() });
    case "listAllClips":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse({ ok: true, clips: listAllClips() });
    case "getStreamers":
      return jsonResponse({ ok: true, streamers: getApprovedStreamers() });
    case "getClips":
      return jsonResponse({ ok: true, clips: getPublicClips() });
    case "getSponsors":
      return jsonResponse({ ok: true, sponsors: getSponsors() });
    case "submitSponsorInquiry":
      return jsonResponse(submitSponsorInquiry(data));
    case "listAllSponsors":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse({ ok: true, sponsors: listAllSponsors() });
    case "addSponsor":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(addSponsor(data));
    case "updateSponsor":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(updateSponsor(data));
    case "listSponsorInquiries":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse({ ok: true, inquiries: listSponsorInquiries() });
    case "updateInquiryStatus":
      if (!isFromTrustedBackend) {
        return jsonResponse({ ok: false, error: "Unauthorized." });
      }
      return jsonResponse(updateInquiryStatus(data));
    case "getBracket":
      return jsonResponse({ ok: true, bracket: getBracket() });
    default:
      return null;
  }
}

/* ════════════════════ TURNSTILE VERIFICATION ════════════════════ */

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
        muteHttpExceptions: true
      }
    );
    const result = JSON.parse(response.getContentText());
    return result.success === true;
  } catch (err) {
    Logger.log("Turnstile verification error: " + err.toString());
    return false;
  }
}

/* ════════════════════ REGISTRATION ROW ════════════════════ */

function buildRegistrationRow(data) {
  const isFull = data.teamType === "full";
  const isIncomplete = data.teamType === "solo" || data.teamType === "partial";
  const yn = function (v) { return v ? "Yes" : "No"; };
  const ynNA = function (cond, v) { return cond ? yn(v) : "N/A"; };

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

  const teamTypeLabel =
    data.teamType === "solo"
      ? "Solo Player"
      : data.teamType === "partial"
      ? "Partial Team (" + (data.partialMemberCount || "?") + ")"
      : data.teamType === "full"
      ? "Full Team (6)"
      : data.teamType;

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
    data.paypalOrderId || "",
    data.paypalCaptureId || "",
    data.paypalAmount ? "$" + data.paypalAmount : "",
    data.paypalPayerEmail || "",
    ynNA(isFull, data.confirmedCaptain),
    ynNA(isFull, data.acknowledgedCaptainResponsibility),
    yn(data.agreedDiscordTOS),
    yn(data.agreedTournamentTOS),
    ynNA(isIncomplete, data.agreedRPMA),
    yn(data.agreedBroadcastTOS),
    data.paymentStatus || "Pending",
    isFull ? "Pending Review" : "N/A",
    ""
  ];
}

/* ════════════════════ MOD MANAGEMENT ════════════════════ */

function verifyMod(discordId) {
  if (!discordId) return { ok: false, isMod: false };
  const sheet = getOrCreateSheet(MODS_SHEET, MODS_HEADERS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(discordId).trim()) {
      return {
        ok: true,
        isMod: true,
        displayName: data[i][1],
        role: data[i][2]
      };
    }
  }
  return { ok: true, isMod: false };
}

function getMods() {
  const sheet = getOrCreateSheet(MODS_SHEET, MODS_HEADERS);
  const data = sheet.getDataRange().getValues();
  const mods = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      mods.push({
        discordId: String(data[i][0]),
        displayName: data[i][1],
        role: data[i][2],
        addedAt: data[i][3]
      });
    }
  }
  return mods;
}

/* ════════════════════ BRACKET STRUCTURE ════════════════════ */

/**
 * The 31-match double-elimination bracket for 16 teams, with Grand Finals
 * bracket reset.
 *
 * Each entry: [match_id, round, feeds_winner_to, feeds_loser_to]
 *
 * Special destinations:
 *   "CHAMPION"     → winner takes the title
 *   "ELIMINATED"   → loser is out
 *   "RUNNER_UP"    → loser of GF-2 finishes 2nd
 *   "GF-2:reset"   → only used if LB winner wins GF-1 (bracket reset)
 *
 * Slot suffix ":A" or ":B" indicates which side of the destination match.
 */
function getBracketTemplate() {
  return [
    ["WB-R1-M1", "WB-R1", "WB-R2-M1:A", "LB-R1-M1:A"],
    ["WB-R1-M2", "WB-R1", "WB-R2-M1:B", "LB-R1-M1:B"],
    ["WB-R1-M3", "WB-R1", "WB-R2-M2:A", "LB-R1-M2:A"],
    ["WB-R1-M4", "WB-R1", "WB-R2-M2:B", "LB-R1-M2:B"],
    ["WB-R1-M5", "WB-R1", "WB-R2-M3:A", "LB-R1-M3:A"],
    ["WB-R1-M6", "WB-R1", "WB-R2-M3:B", "LB-R1-M3:B"],
    ["WB-R1-M7", "WB-R1", "WB-R2-M4:A", "LB-R1-M4:A"],
    ["WB-R1-M8", "WB-R1", "WB-R2-M4:B", "LB-R1-M4:B"],

    ["WB-R2-M1", "WB-QF", "WB-SF-M1:A", "LB-R2-M1:B"],
    ["WB-R2-M2", "WB-QF", "WB-SF-M1:B", "LB-R2-M2:B"],
    ["WB-R2-M3", "WB-QF", "WB-SF-M2:A", "LB-R2-M3:B"],
    ["WB-R2-M4", "WB-QF", "WB-SF-M2:B", "LB-R2-M4:B"],

    ["WB-SF-M1", "WB-SF", "WB-F:A", "LB-R4-M1:B"],
    ["WB-SF-M2", "WB-SF", "WB-F:B", "LB-R4-M2:B"],

    ["WB-F", "WB-F", "GF-1:A", "LB-R5:B"],

    ["LB-R1-M1", "LB-R1", "LB-R2-M1:A", "ELIMINATED"],
    ["LB-R1-M2", "LB-R1", "LB-R2-M2:A", "ELIMINATED"],
    ["LB-R1-M3", "LB-R1", "LB-R2-M3:A", "ELIMINATED"],
    ["LB-R1-M4", "LB-R1", "LB-R2-M4:A", "ELIMINATED"],

    ["LB-R2-M1", "LB-R2", "LB-R3-M1:A", "ELIMINATED"],
    ["LB-R2-M2", "LB-R2", "LB-R3-M1:B", "ELIMINATED"],
    ["LB-R2-M3", "LB-R2", "LB-R3-M2:A", "ELIMINATED"],
    ["LB-R2-M4", "LB-R2", "LB-R3-M2:B", "ELIMINATED"],

    ["LB-R3-M1", "LB-R3", "LB-R4-M1:A", "ELIMINATED"],
    ["LB-R3-M2", "LB-R3", "LB-R4-M2:A", "ELIMINATED"],

    ["LB-R4-M1", "LB-R4", "LB-R5:A", "ELIMINATED"],
    ["LB-R4-M2", "LB-R4", "LB-R5:B", "ELIMINATED"],

    ["LB-R5", "LB-SF", "LB-F:A", "ELIMINATED"],

    ["LB-F", "LB-F", "GF-1:B", "ELIMINATED"],

    ["GF-1", "GF-1", "CHAMPION", "GF-2:reset"],
    ["GF-2", "GF-2", "CHAMPION", "RUNNER_UP"]
  ];
}

/* ════════════════════ BRACKET INITIALIZATION ════════════════════ */

/**
 * Wipes any existing Bracket tab, writes the 31-row template, optionally
 * seeds 2-16 teams (padding the rest with BYEs), then runs propagateByes
 * to auto-resolve any matches involving a BYE.
 */
function initBracket(seededTeams) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BRACKET_SHEET);
    if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(BRACKET_SHEET);
    }
    writeHeaders(sheet, BRACKET_HEADERS);

    const template = getBracketTemplate();
    const rows = template.map(function (entry) {
      const matchId = entry[0];
      const round = entry[1];
      const feedsW = entry[2];
      const feedsL = entry[3];
      return [
        matchId,
        round,
        "", "", "", "", "", "", "", "",
        "pending",
        feedsW,
        feedsL,
        "",  // streaming_url
        new Date()
      ];
    });

    sheet.getRange(2, 1, rows.length, BRACKET_HEADERS.length).setValues(rows);

    getOrCreateSheet(MATCHES_SHEET, MATCHES_HEADERS);

    const validCount =
      Array.isArray(seededTeams) &&
      seededTeams.length >= 2 &&
      seededTeams.length <= 16;

    if (validCount) {
      seedTeams(sheet, seededTeams);
      propagateByes(sheet);
    }

    const byeCount = validCount ? 16 - seededTeams.length : 0;

    // Discord webhook
    if (validCount) {
      try {
        notifyDiscordBracketInitialized(seededTeams.length);
      } catch (notifyErr) {
        Logger.log("Discord notify failed: " + notifyErr.toString());
      }
    }

    return {
      ok: true,
      message: validCount
        ? "Bracket initialized with " +
          seededTeams.length +
          " team" +
          (seededTeams.length === 1 ? "" : "s") +
          (byeCount > 0
            ? " (" + byeCount + " BYE" + (byeCount === 1 ? "" : "s") + ")"
            : "") +
          "."
        : "Bracket initialized. Awaiting seed."
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Writes team IDs/names into WB-R1 slots.
 * Pairs of consecutive teams play each other:
 *   teams[0] vs teams[1]  → WB-R1-M1
 *   teams[2] vs teams[3]  → WB-R1-M2
 *   ...etc through M8.
 *
 * If fewer than 16 teams are provided, remaining slots are filled with BYEs.
 */
function seedTeams(bracketSheet, seededTeams) {
  const padded = seededTeams.slice();
  while (padded.length < 16) padded.push(BYE_TEAM);

  const data = bracketSheet.getDataRange().getValues();
  const colIndex = function (name) {
    return BRACKET_HEADERS.indexOf(name);
  };

  for (let pair = 0; pair < 8; pair++) {
    const matchId = "WB-R1-M" + (pair + 1);
    const teamA = padded[pair * 2];
    const teamB = padded[pair * 2 + 1];

    for (let i = 1; i < data.length; i++) {
      if (data[i][colIndex("match_id")] === matchId) {
        const rowNum = i + 1;
        bracketSheet.getRange(rowNum, colIndex("team_a_id") + 1).setValue(teamA.teamId);
        bracketSheet.getRange(rowNum, colIndex("team_a_label") + 1).setValue(teamA.teamName);
        bracketSheet.getRange(rowNum, colIndex("team_b_id") + 1).setValue(teamB.teamId);
        bracketSheet.getRange(rowNum, colIndex("team_b_label") + 1).setValue(teamB.teamName);
        bracketSheet.getRange(rowNum, colIndex("status") + 1).setValue("ready");
        bracketSheet.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());
        break;
      }
    }
  }
}

/* ════════════════════ BYE PROPAGATION ════════════════════ */

/**
 * Walks the bracket repeatedly, auto-resolving any match where one or both
 * sides are BYEs. The cascade terminates when an iteration changes nothing.
 *
 *   BYE vs Real    → Real auto-wins, BYE drops to LB
 *   Real vs BYE    → same, symmetric
 *   BYE vs BYE     → both flagged completed-bye, propagates BYE further
 */
function propagateByes(bracketSheet) {
  const colIndex = function (name) {
    return BRACKET_HEADERS.indexOf(name);
  };
  const MAX_ITERATIONS = 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    const data = bracketSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[colIndex("status")];
      if (status !== "ready") continue;

      const teamA_id = row[colIndex("team_a_id")];
      const teamB_id = row[colIndex("team_b_id")];
      const teamA_label = row[colIndex("team_a_label")];
      const teamB_label = row[colIndex("team_b_label")];

      const aIsBye = teamA_id === BYE_TEAM.teamId;
      const bIsBye = teamB_id === BYE_TEAM.teamId;

      if (!aIsBye && !bIsBye) continue;

      const rowNum = i + 1;
      let winnerId, winnerLabel, loserId, loserLabel;

      if (aIsBye && bIsBye) {
        winnerId = BYE_TEAM.teamId;
        winnerLabel = BYE_TEAM.teamName;
        loserId = BYE_TEAM.teamId;
        loserLabel = BYE_TEAM.teamName;
      } else if (aIsBye) {
        winnerId = teamB_id;
        winnerLabel = teamB_label;
        loserId = BYE_TEAM.teamId;
        loserLabel = BYE_TEAM.teamName;
      } else {
        winnerId = teamA_id;
        winnerLabel = teamA_label;
        loserId = BYE_TEAM.teamId;
        loserLabel = BYE_TEAM.teamName;
      }

      bracketSheet.getRange(rowNum, colIndex("winner_id") + 1).setValue(winnerId);
      bracketSheet.getRange(rowNum, colIndex("loser_id") + 1).setValue(loserId);
      bracketSheet.getRange(rowNum, colIndex("status") + 1).setValue("completed-bye");
      bracketSheet.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());

      const feedsWinner = row[colIndex("feeds_winner_to")];
      const feedsLoser = row[colIndex("feeds_loser_to")];

      writeToSlot(bracketSheet, feedsWinner, winnerId, winnerLabel);
      writeToSlot(bracketSheet, feedsLoser, loserId, loserLabel);

      changed = true;
    }

    if (!changed) break;
  }
}

/**
 * Writes a team into a destination slot reference like "WB-R2-M1:A".
 * Marks the destination match "ready" if both sides are now populated.
 *
 * Sentinel destinations (CHAMPION, ELIMINATED, RUNNER_UP, *:reset) are
 * ignored here — they're handled by result-entry logic in Chunk 2.
 */
function writeToSlot(bracketSheet, destination, teamId, teamLabel) {
  if (!destination) return;
  if (
    destination === "CHAMPION" ||
    destination === "ELIMINATED" ||
    destination === "RUNNER_UP" ||
    destination.indexOf(":reset") === destination.length - 6
  ) {
    return;
  }

  const colonIdx = destination.lastIndexOf(":");
  if (colonIdx === -1) return;
  const targetMatchId = destination.slice(0, colonIdx);
  const slot = destination.slice(colonIdx + 1);

  const colIndex = function (name) {
    return BRACKET_HEADERS.indexOf(name);
  };
  const data = bracketSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex("match_id")] === targetMatchId) {
      const rowNum = i + 1;
      const idCol =
        slot === "A" ? colIndex("team_a_id") + 1 : colIndex("team_b_id") + 1;
      const labelCol =
        slot === "A" ? colIndex("team_a_label") + 1 : colIndex("team_b_label") + 1;

      bracketSheet.getRange(rowNum, idCol).setValue(teamId);
      bracketSheet.getRange(rowNum, labelCol).setValue(teamLabel);
      bracketSheet.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());

      const teamA = bracketSheet.getRange(rowNum, colIndex("team_a_id") + 1).getValue();
      const teamB = bracketSheet.getRange(rowNum, colIndex("team_b_id") + 1).getValue();
      const currentStatus = bracketSheet
        .getRange(rowNum, colIndex("status") + 1)
        .getValue();
      if (teamA && teamB && currentStatus === "pending") {
        bracketSheet.getRange(rowNum, colIndex("status") + 1).setValue("ready");
      }
      return;
    }
  }
}

/* ════════════════════ RESULT ENTRY & PROGRESSION ════════════════════ */

/**
 * Records a match result and advances the winner/loser into their
 * destination slots. Concurrency-safe via LockService.
 *
 * Expected data shape:
 *   {
 *     action: "submitResult",
 *     adminSecret: "...",
 *     matchId: "WB-R1-M1",
 *     winnerId: "team-005",
 *     teamAScore: 3,    // optional
 *     teamBScore: 1,    // optional
 *     reportedById: "847362910583046193",
 *     reportedByUsername: "tournamentmod",
 *     notes: ""         // optional free-text
 *   }
 *
 * Returns: { ok: bool, error?, message?, championId?, runnerUpId? }
 *   championId is set when GF concludes without a reset (or after GF-2).
 *   runnerUpId is set when GF-2 completes.
 */
function submitMatchResult(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.matchId || !data.winnerId) {
      return { ok: false, error: "matchId and winnerId are required." };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bracket = ss.getSheetByName(BRACKET_SHEET);
    if (!bracket) return { ok: false, error: "Bracket not initialized." };

    const colIndex = function (name) {
      return BRACKET_HEADERS.indexOf(name);
    };
    const sheetData = bracket.getDataRange().getValues();

    // Find the match row
    let matchRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][colIndex("match_id")] === data.matchId) {
        matchRow = i;
        break;
      }
    }
    if (matchRow === -1) {
      return { ok: false, error: "Match " + data.matchId + " not found." };
    }

    const row = sheetData[matchRow];
    const status = row[colIndex("status")];
    if (status !== "ready") {
      return {
        ok: false,
        error:
          "Match " +
          data.matchId +
          " is not ready for result entry (status: " +
          status +
          ")."
      };
    }

    const teamAId = row[colIndex("team_a_id")];
    const teamBId = row[colIndex("team_b_id")];
    const teamALabel = row[colIndex("team_a_label")];
    const teamBLabel = row[colIndex("team_b_label")];

    // Validate winnerId matches one of the two teams
    if (data.winnerId !== teamAId && data.winnerId !== teamBId) {
      return {
        ok: false,
        error: "winnerId does not match either team in this match."
      };
    }

    // BYE guard — should never happen if propagateByes ran, but defensive.
    if (data.winnerId === BYE_TEAM.teamId) {
      return { ok: false, error: "Cannot declare BYE as winner." };
    }

    // Score sanity check (only if scores were provided)
    const aScore = data.teamAScore;
    const bScore = data.teamBScore;
    const hasScore =
      typeof aScore === "number" && typeof bScore === "number";
    if (hasScore) {
      if (aScore < 0 || bScore < 0) {
        return { ok: false, error: "Scores cannot be negative." };
      }
      if (aScore === bScore) {
        return {
          ok: false,
          error: "Scores tied — must declare a winner with unequal scores."
        };
      }
      const scoreImpliesA = aScore > bScore;
      const declaredA = data.winnerId === teamAId;
      if (scoreImpliesA !== declaredA) {
        return {
          ok: false,
          error: "Score does not match declared winner."
        };
      }
    }

    const winnerIsA = data.winnerId === teamAId;
    const winnerLabel = winnerIsA ? teamALabel : teamBLabel;
    const loserId = winnerIsA ? teamBId : teamAId;
    const loserLabel = winnerIsA ? teamBLabel : teamALabel;

    // Write match result
    const rowNum = matchRow + 1;
    if (hasScore) {
      bracket.getRange(rowNum, colIndex("team_a_score") + 1).setValue(aScore);
      bracket.getRange(rowNum, colIndex("team_b_score") + 1).setValue(bScore);
    }
    bracket.getRange(rowNum, colIndex("winner_id") + 1).setValue(data.winnerId);
    bracket.getRange(rowNum, colIndex("loser_id") + 1).setValue(loserId);
    bracket.getRange(rowNum, colIndex("status") + 1).setValue("completed");
    // Clear the streaming URL — match is over, the cast moves on
    bracket.getRange(rowNum, colIndex("streaming_url") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());

    // Advance winner and loser to their destinations
    const result = advanceTeamFromMatch(
      bracket,
      data.matchId,
      data.winnerId,
      winnerLabel,
      loserId,
      loserLabel,
      row[colIndex("feeds_winner_to")],
      row[colIndex("feeds_loser_to")]
    );

    // Re-run BYE propagation in case advancement created a new BYE situation
    propagateByes(bracket);

    // Audit log
    appendMatchAudit({
      matchId: data.matchId,
      reportedById: data.reportedById || "",
      reportedByUsername: data.reportedByUsername || "",
      teamAScore: hasScore ? aScore : "",
      teamBScore: hasScore ? bScore : "",
      winnerId: data.winnerId,
      action: "result_entered",
      notes: data.notes || ""
    });

    // Discord webhook for the completed match
    try {
      notifyDiscordMatchResult({
        match_id: data.matchId,
        team_a_id: teamAId,
        team_b_id: teamBId,
        team_a_label: teamALabel,
        team_b_label: teamBLabel,
        team_a_score: hasScore ? aScore : "",
        team_b_score: hasScore ? bScore : "",
        winner_id: data.winnerId,
        feeds_winner_to: row[colIndex("feeds_winner_to")]
      });
    } catch (notifyErr) {
      Logger.log("Discord notify failed: " + notifyErr.toString());
    }

    return {
      ok: true,
      message: "Result recorded for " + data.matchId + ".",
      championId: result.championId || null,
      runnerUpId: result.runnerUpId || null,
      bracketResetTriggered: result.bracketResetTriggered || false
    };
  } catch (err) {
    Logger.log("submitMatchResult error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Advances the winner and loser from a completed match into their
 * destination slots. Returns a summary indicating whether a champion was
 * declared, whether the bracket reset was triggered, etc.
 */
function advanceTeamFromMatch(
  bracket,
  matchId,
  winnerId,
  winnerLabel,
  loserId,
  loserLabel,
  feedsWinner,
  feedsLoser
) {
  const result = { championId: null, runnerUpId: null, bracketResetTriggered: false };

  // Handle winner destination
  if (feedsWinner === "CHAMPION") {
    result.championId = winnerId;
  } else if (feedsWinner) {
    writeToSlot(bracket, feedsWinner, winnerId, winnerLabel);
  }

  // Handle loser destination
  if (feedsLoser === "ELIMINATED") {
    // No-op: tournament-eliminated, no slot to write
  } else if (feedsLoser === "RUNNER_UP") {
    result.runnerUpId = loserId;
  } else if (feedsLoser && feedsLoser.indexOf(":reset") !== -1) {
    // Bracket reset case: GF-1 has feedsWinner=CHAMPION, feedsLoser=GF-2:reset.
    // The "tentative champion" was already declared above when we processed
    // feedsWinner=CHAMPION. But standard double-elim rules say:
    //   - If WB winner wins GF-1 → tournament ends, they're champion
    //   - If LB winner wins GF-1 → bracket reset, GF-2 is played
    //
    // GF-1's slot A was fed from WB-F, slot B from LB-F. So:
    //   - Winner came from slot A → WB winner won → champion stays declared
    //   - Winner came from slot B → LB winner won → trigger reset
    const matchRow = findMatchRow(bracket, matchId);
    if (matchRow !== -1) {
      const colIndex = function (name) {
        return BRACKET_HEADERS.indexOf(name);
      };
      const data = bracket.getDataRange().getValues();
      const teamAId = data[matchRow][colIndex("team_a_id")];
      const winnerWasSlotA = teamAId === winnerId;

      if (!winnerWasSlotA) {
        // LB winner won GF-1 → trigger reset, un-declare champion
        result.bracketResetTriggered = true;
        result.championId = null;

        // Both teams advance to GF-2:
        //   loser of GF-1 (WB winner, now with their first loss) → GF-2:A
        //   winner of GF-1 (LB winner) → GF-2:B
        writeToSlot(bracket, "GF-2:A", loserId, loserLabel);
        writeToSlot(bracket, "GF-2:B", winnerId, winnerLabel);
      }
      // If winner was in slot A: WB winner won, championId stays set,
      // GF-2 stays pending forever (it's never reached).
    }
  } else if (feedsLoser) {
    writeToSlot(bracket, feedsLoser, loserId, loserLabel);
  }

  return result;
}

/**
 * Helper: find the row index (0-indexed in the data array) of a match by ID.
 * Returns -1 if not found.
 */
function findMatchRow(bracket, matchId) {
  const colIndex = BRACKET_HEADERS.indexOf("match_id");
  const data = bracket.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] === matchId) return i;
  }
  return -1;
}

/**
 * Reverts a completed match — undoes the result and clears it back to "ready".
 *
 * Refuses (Option A behavior) if any downstream match has been completed.
 * The mod must revert downstream first, then revert this match.
 *
 * Expected data shape:
 *   {
 *     action: "revertResult",
 *     adminSecret: "...",
 *     matchId: "WB-R1-M1",
 *     reportedById: "...",
 *     reportedByUsername: "...",
 *     notes: ""
 *   }
 */
function revertMatchResult(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.matchId) {
      return { ok: false, error: "matchId is required." };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bracket = ss.getSheetByName(BRACKET_SHEET);
    if (!bracket) return { ok: false, error: "Bracket not initialized." };

    const colIndex = function (name) {
      return BRACKET_HEADERS.indexOf(name);
    };
    const sheetData = bracket.getDataRange().getValues();

    let matchRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (sheetData[i][colIndex("match_id")] === data.matchId) {
        matchRow = i;
        break;
      }
    }
    if (matchRow === -1) {
      return { ok: false, error: "Match " + data.matchId + " not found." };
    }

    const row = sheetData[matchRow];
    const status = row[colIndex("status")];
    if (status !== "completed") {
      return {
        ok: false,
        error:
          "Match " +
          data.matchId +
          " cannot be reverted (status: " +
          status +
          "). Only manually-completed matches can be reverted; BYE auto-resolutions cannot."
      };
    }

    const feedsWinner = row[colIndex("feeds_winner_to")];
    const feedsLoser = row[colIndex("feeds_loser_to")];

    // Option A guard: refuse if any downstream match is already completed
    const blockingMatches = [];
    [feedsWinner, feedsLoser].forEach(function (dest) {
      if (!dest) return;
      if (
        dest === "CHAMPION" ||
        dest === "ELIMINATED" ||
        dest === "RUNNER_UP"
      ) {
        return;
      }
      // Strip slot suffix to get just the match ID
      const colonIdx = dest.lastIndexOf(":");
      if (colonIdx === -1) return;
      const downstreamMatchId = dest.slice(0, colonIdx);
      const downstreamRow = findMatchRow(bracket, downstreamMatchId);
      if (downstreamRow === -1) return;
      const downstreamStatus = sheetData[downstreamRow][colIndex("status")];
      if (downstreamStatus === "completed") {
        blockingMatches.push(downstreamMatchId);
      }
    });

    if (blockingMatches.length > 0) {
      return {
        ok: false,
        error:
          "Cannot revert " +
          data.matchId +
          ": downstream match(es) already completed: " +
          blockingMatches.join(", ") +
          ". Revert those first."
      };
    }

    // Clear the result fields on this match
    const rowNum = matchRow + 1;
    bracket.getRange(rowNum, colIndex("team_a_score") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("team_b_score") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("winner_id") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("loser_id") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("status") + 1).setValue("ready");
    bracket.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());

    // Clear the destination slots that we previously populated.
    // (Only clear team data, not entire match — the destination match may
    //  have been "ready" with both slots filled, but is now waiting on us
    //  to determine which team is in the slot we feed.)
    [
      { dest: feedsWinner, role: "winner" },
      { dest: feedsLoser, role: "loser" }
    ].forEach(function (entry) {
      if (!entry.dest) return;
      if (
        entry.dest === "CHAMPION" ||
        entry.dest === "ELIMINATED" ||
        entry.dest === "RUNNER_UP"
      ) {
        return;
      }
      // GF-2:reset is special — clearing it means undoing a bracket reset
      const isReset = entry.dest.indexOf(":reset") !== -1;
      const cleanDest = isReset ? "GF-2:B" : entry.dest; // resets always feed B for the LB winner

      const colonIdx = cleanDest.lastIndexOf(":");
      if (colonIdx === -1) return;
      const targetMatchId = cleanDest.slice(0, colonIdx);
      const slot = cleanDest.slice(colonIdx + 1);
      clearSlot(bracket, targetMatchId, slot);

      // If this was a reset, also clear GF-2:A (the WB winner's slot)
      if (isReset) {
        clearSlot(bracket, "GF-2", "A");
      }
    });

    appendMatchAudit({
      matchId: data.matchId,
      reportedById: data.reportedById || "",
      reportedByUsername: data.reportedByUsername || "",
      teamAScore: "",
      teamBScore: "",
      winnerId: "",
      action: "result_reverted",
      notes: data.notes || ""
    });

    return {
      ok: true,
      message: "Result for " + data.matchId + " reverted."
    };
  } catch (err) {
    Logger.log("revertMatchResult error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: clears a specific slot (A or B) in a destination match.
 * If both slots become empty, sets status back to "pending".
 */
function clearSlot(bracket, matchId, slot) {
  const colIndex = function (name) {
    return BRACKET_HEADERS.indexOf(name);
  };
  const matchRow = findMatchRow(bracket, matchId);
  if (matchRow === -1) return;
  const rowNum = matchRow + 1;

  if (slot === "A") {
    bracket.getRange(rowNum, colIndex("team_a_id") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("team_a_label") + 1).setValue("");
  } else {
    bracket.getRange(rowNum, colIndex("team_b_id") + 1).setValue("");
    bracket.getRange(rowNum, colIndex("team_b_label") + 1).setValue("");
  }

  // Re-check status: if both slots are now empty, go back to "pending"
  const teamA = bracket.getRange(rowNum, colIndex("team_a_id") + 1).getValue();
  const teamB = bracket.getRange(rowNum, colIndex("team_b_id") + 1).getValue();
  const currentStatus = bracket
    .getRange(rowNum, colIndex("status") + 1)
    .getValue();
  if (!teamA && !teamB && currentStatus === "ready") {
    bracket.getRange(rowNum, colIndex("status") + 1).setValue("pending");
  }
  bracket.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());
}

/**
 * Append a row to the Matches audit log.
 */
function appendMatchAudit(entry) {
  const sheet = getOrCreateSheet(MATCHES_SHEET, MATCHES_HEADERS);
  sheet.appendRow([
    new Date(),
    entry.matchId,
    entry.reportedById,
    entry.reportedByUsername,
    entry.teamAScore,
    entry.teamBScore,
    entry.winnerId,
    entry.action,
    entry.notes
  ]);
}

/**
 * Sets (or clears) the streaming URL for a match. Mod-only; called via
 * /api/admin/set-stream. Pass an empty string for url to clear.
 *
 * Expected data shape:
 *   {
 *     action: "setStream",
 *     adminSecret: "...",
 *     matchId: "WB-R3-M1",
 *     url: "https://twitch.tv/major_mayhem",  // or "" to clear
 *     reportedById: "...",
 *     reportedByUsername: "..."
 *   }
 */
function setMatchStream(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.matchId) {
      return { ok: false, error: "matchId is required." };
    }
    const url = (data.url || "").trim();
    // Light URL validation: must be empty or start with http(s)://
    if (url && !/^https?:\/\//i.test(url)) {
      return {
        ok: false,
        error: "URL must start with http:// or https://"
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bracket = ss.getSheetByName(BRACKET_SHEET);
    if (!bracket) return { ok: false, error: "Bracket not initialized." };

    const colIndex = function (name) {
      return BRACKET_HEADERS.indexOf(name);
    };
    const matchRow = findMatchRow(bracket, data.matchId);
    if (matchRow === -1) {
      return { ok: false, error: "Match " + data.matchId + " not found." };
    }
    const rowNum = matchRow + 1;

    bracket.getRange(rowNum, colIndex("streaming_url") + 1).setValue(url);
    bracket.getRange(rowNum, colIndex("updated_at") + 1).setValue(new Date());

    // Audit log entry (use the same Matches tab; action distinguishes)
    appendMatchAudit({
      matchId: data.matchId,
      reportedById: data.reportedById || "",
      reportedByUsername: data.reportedByUsername || "",
      teamAScore: "",
      teamBScore: "",
      winnerId: "",
      action: url ? "stream_set" : "stream_cleared",
      notes: url || ""
    });

    // Discord webhook — only post when the stream is going LIVE, not when
    // clearing. Read the team labels from the row we just updated.
    if (url) {
      try {
        const row = bracket
          .getRange(rowNum, 1, 1, BRACKET_HEADERS.length)
          .getValues()[0];
        notifyDiscordMatchLive(
          {
            match_id: data.matchId,
            team_a_label: row[colIndex("team_a_label")],
            team_b_label: row[colIndex("team_b_label")]
          },
          url
        );
      } catch (notifyErr) {
        Logger.log("Discord notify failed: " + notifyErr.toString());
      }
    }

    return {
      ok: true,
      message: url
        ? "Stream URL set for " + data.matchId + "."
        : "Stream URL cleared for " + data.matchId + "."
    };
  } catch (err) {
    Logger.log("setMatchStream error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/* ════════════════════ BRACKET READ ════════════════════ */

function getBracket() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(BRACKET_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, idx) {
      obj[h] = row[idx];
    });
    return obj;
  });
}

/* ════════════════════ HELPERS ════════════════════ */

/* ════════════════════ STREAMER HUB ════════════════════ */

/**
 * Submit a streamer application. Lands as "pending" until a mod approves.
 *
 * Expected data:
 *   {
 *     action: "submitStreamerApplication",
 *     adminSecret: "...",      // server-side relay only
 *     discordId: "...",
 *     discordUsername: "...",
 *     streamerName: "...",
 *     twitchUrl: "https://twitch.tv/...",
 *     familyFriendly: true|false,
 *     notes: ""                // optional, applicant-provided
 *   }
 *
 * Soft-gate behavior: we check whether the Discord ID exists in the
 * Registrations sheet and record that as a flag. We DO NOT block the
 * application — mods see the flag and decide.
 *
 * Idempotency: if the same Discord ID applies twice, the second one
 * UPDATES the existing row instead of creating a duplicate. This lets
 * applicants fix typos or re-apply after rejection.
 */
function submitStreamerApplication(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.discordId || !data.streamerName || !data.twitchUrl) {
      return {
        ok: false,
        error: "discordId, streamerName, and twitchUrl are required."
      };
    }
    if (!/^https?:\/\//i.test(String(data.twitchUrl).trim())) {
      return {
        ok: false,
        error: "Twitch URL must start with http:// or https://"
      };
    }

    const sheet = getOrCreateSheet(STREAMERS_SHEET, STREAMERS_HEADERS);
    const sheetData = sheet.getDataRange().getValues();
    const colIndex = function (name) {
      return STREAMERS_HEADERS.indexOf(name);
    };

    // Soft-gate check: does this Discord ID exist in Registrations?
    const hasRegistration = checkTournamentRegistration(data.discordId);

    // Look for existing row with same Discord ID
    let existingRow = -1;
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][colIndex("Discord ID")]).trim() === String(data.discordId).trim()) {
        existingRow = i;
        break;
      }
    }

    if (existingRow !== -1) {
      // Update existing row — reset to pending status
      const rowNum = existingRow + 1;
      sheet.getRange(rowNum, colIndex("Timestamp") + 1).setValue(new Date());
      sheet.getRange(rowNum, colIndex("Discord Username") + 1).setValue(data.discordUsername || "");
      sheet.getRange(rowNum, colIndex("Streamer Name") + 1).setValue(data.streamerName);
      sheet.getRange(rowNum, colIndex("Twitch URL") + 1).setValue(data.twitchUrl);
      sheet.getRange(rowNum, colIndex("Family Friendly") + 1).setValue(data.familyFriendly ? "Yes" : "No");
      sheet.getRange(rowNum, colIndex("Status") + 1).setValue("pending");
      sheet.getRange(rowNum, colIndex("Has Tournament Registration") + 1).setValue(hasRegistration ? "Yes" : "No");
      sheet.getRange(rowNum, colIndex("Notes") + 1).setValue(data.notes || "");
      // Clear approval fields since we're back to pending
      sheet.getRange(rowNum, colIndex("Approved By") + 1).setValue("");
      sheet.getRange(rowNum, colIndex("Approved At") + 1).setValue("");
      return {
        ok: true,
        message: "Application updated. Pending mod review."
      };
    }

    // Append new row
    sheet.appendRow([
      new Date(),
      data.discordId,
      data.discordUsername || "",
      data.streamerName,
      data.twitchUrl,
      data.familyFriendly ? "Yes" : "No",
      "pending",
      "No",  // Featured defaults to No
      hasRegistration ? "Yes" : "No",
      "",
      "",
      data.notes || ""
    ]);

    // Discord webhook
    try {
      notifyDiscordStreamerApplication(data);
    } catch (notifyErr) {
      Logger.log("Discord notify failed: " + notifyErr.toString());
    }

    return {
      ok: true,
      message: "Application submitted. Pending mod review."
    };
  } catch (err) {
    Logger.log("submitStreamerApplication error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: returns true if the given Discord ID has a tournament registration.
 */
function checkTournamentRegistration(discordId) {
  if (!discordId) return false;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const regSheet = ss.getSheetByName(REG_SHEET);
  if (!regSheet || regSheet.getLastRow() < 2) return false;
  const data = regSheet.getDataRange().getValues();
  // Discord ID (OAuth) is column index 1 in REG_HEADERS
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(discordId).trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Mod action: approve a streamer. Sets Status=approved.
 */
function approveStreamer(data) {
  return updateStreamerStatus(data, "approved");
}

/**
 * Mod action: reject a streamer.
 */
function rejectStreamer(data) {
  return updateStreamerStatus(data, "rejected");
}

function updateStreamerStatus(data, newStatus) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.discordId) {
      return { ok: false, error: "discordId is required." };
    }
    const sheet = getOrCreateSheet(STREAMERS_SHEET, STREAMERS_HEADERS);
    const sheetData = sheet.getDataRange().getValues();
    const colIndex = function (name) {
      return STREAMERS_HEADERS.indexOf(name);
    };
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][colIndex("Discord ID")]).trim() === String(data.discordId).trim()) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, colIndex("Status") + 1).setValue(newStatus);
        sheet.getRange(rowNum, colIndex("Approved By") + 1).setValue(data.approvedByUsername || "");
        sheet.getRange(rowNum, colIndex("Approved At") + 1).setValue(new Date());
        return { ok: true, message: "Streamer " + newStatus + "." };
      }
    }
    return { ok: false, error: "Streamer not found." };
  } catch (err) {
    Logger.log("updateStreamerStatus error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mod action: flip featured status on a streamer.
 *
 * Expected data: { action: "toggleFeaturedStreamer", discordId: "...", featured: true|false }
 */
function toggleFeaturedStreamer(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.discordId) return { ok: false, error: "discordId is required." };
    const sheet = getOrCreateSheet(STREAMERS_SHEET, STREAMERS_HEADERS);
    const sheetData = sheet.getDataRange().getValues();
    const colIndex = function (name) {
      return STREAMERS_HEADERS.indexOf(name);
    };
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][colIndex("Discord ID")]).trim() === String(data.discordId).trim()) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, colIndex("Featured") + 1).setValue(data.featured ? "Yes" : "No");
        return { ok: true, message: "Featured status updated." };
      }
    }
    return { ok: false, error: "Streamer not found." };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Public read: returns all streamers with status=approved, with sensitive
 * mod-only fields stripped.
 */
function getApprovedStreamers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(STREAMERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return STREAMERS_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex("Status")]) !== "approved") continue;
    result.push({
      discordId: String(data[i][colIndex("Discord ID")]),
      streamerName: String(data[i][colIndex("Streamer Name")]),
      twitchUrl: String(data[i][colIndex("Twitch URL")]),
      familyFriendly: String(data[i][colIndex("Family Friendly")]) === "Yes",
      featured: String(data[i][colIndex("Featured")]) === "Yes"
    });
  }
  return result;
}

/**
 * Mod-only read: returns ALL streamers including pending/rejected.
 * Used by the admin queue.
 */
function listAllStreamers() {
  const sheet = getOrCreateSheet(STREAMERS_SHEET, STREAMERS_HEADERS);
  if (sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return STREAMERS_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][colIndex("Discord ID")]) continue;
    result.push({
      timestamp: data[i][colIndex("Timestamp")],
      discordId: String(data[i][colIndex("Discord ID")]),
      discordUsername: String(data[i][colIndex("Discord Username")]),
      streamerName: String(data[i][colIndex("Streamer Name")]),
      twitchUrl: String(data[i][colIndex("Twitch URL")]),
      familyFriendly: String(data[i][colIndex("Family Friendly")]) === "Yes",
      status: String(data[i][colIndex("Status")]),
      featured: String(data[i][colIndex("Featured")]) === "Yes",
      hasTournamentRegistration: String(data[i][colIndex("Has Tournament Registration")]) === "Yes",
      approvedBy: String(data[i][colIndex("Approved By")] || ""),
      approvedAt: data[i][colIndex("Approved At")] || "",
      notes: String(data[i][colIndex("Notes")] || "")
    });
  }
  return result;
}

/* ────────── CLIPS ────────── */

/**
 * Mod action: add a Twitch clip to the showcase.
 *
 * Expected data:
 *   {
 *     action: "addClip",
 *     adminSecret: "...",
 *     twitchClipUrl: "https://clips.twitch.tv/...",
 *     streamerName: "...",
 *     streamerTwitchUrl: "https://twitch.tv/...",
 *     caption: "",
 *     featured: true|false,
 *     addedById: "...",
 *     addedByUsername: "..."
 *   }
 */
function addClip(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.twitchClipUrl || !data.streamerName) {
      return {
        ok: false,
        error: "twitchClipUrl and streamerName are required."
      };
    }
    if (!/^https?:\/\//i.test(String(data.twitchClipUrl).trim())) {
      return {
        ok: false,
        error: "Twitch clip URL must start with http:// or https://"
      };
    }
    const sheet = getOrCreateSheet(CLIPS_SHEET, CLIPS_HEADERS);
    sheet.appendRow([
      new Date(),
      data.twitchClipUrl,
      data.streamerName,
      data.streamerTwitchUrl || "",
      data.caption || "",
      data.featured ? "Yes" : "No",
      data.addedById || "",
      data.addedByUsername || "",
      new Date()
    ]);
    return { ok: true, message: "Clip added." };
  } catch (err) {
    Logger.log("addClip error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mod action: remove a clip by its row identifier (the timestamp serves as ID
 * since clips don't have a separate primary key).
 *
 * Expected data: { action: "removeClip", clipUrl: "..." }
 * We match by clipUrl since URL is unique enough.
 */
function removeClip(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.clipUrl) return { ok: false, error: "clipUrl is required." };
    const sheet = getOrCreateSheet(CLIPS_SHEET, CLIPS_HEADERS);
    const sheetData = sheet.getDataRange().getValues();
    const colIndex = function (name) {
      return CLIPS_HEADERS.indexOf(name);
    };
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][colIndex("Twitch Clip URL")]).trim() === String(data.clipUrl).trim()) {
        sheet.deleteRow(i + 1);
        return { ok: true, message: "Clip removed." };
      }
    }
    return { ok: false, error: "Clip not found." };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Mod action: toggle featured on a clip.
 */
function toggleFeaturedClip(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!data.clipUrl) return { ok: false, error: "clipUrl is required." };
    const sheet = getOrCreateSheet(CLIPS_SHEET, CLIPS_HEADERS);
    const sheetData = sheet.getDataRange().getValues();
    const colIndex = function (name) {
      return CLIPS_HEADERS.indexOf(name);
    };
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][colIndex("Twitch Clip URL")]).trim() === String(data.clipUrl).trim()) {
        const rowNum = i + 1;
        sheet.getRange(rowNum, colIndex("Featured") + 1).setValue(data.featured ? "Yes" : "No");
        return { ok: true, message: "Featured status updated." };
      }
    }
    return { ok: false, error: "Clip not found." };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Public read: returns all clips, ordered newest first. Featured clips are
 * marked but not specially sorted — let the client decide how to display.
 */
function getPublicClips() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CLIPS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return CLIPS_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][colIndex("Twitch Clip URL")]) continue;
    result.push({
      clipUrl: String(data[i][colIndex("Twitch Clip URL")]),
      streamerName: String(data[i][colIndex("Streamer Name")]),
      streamerTwitchUrl: String(data[i][colIndex("Streamer Twitch URL")] || ""),
      caption: String(data[i][colIndex("Caption")] || ""),
      featured: String(data[i][colIndex("Featured")]) === "Yes",
      addedAt: data[i][colIndex("Added At")] || data[i][colIndex("Timestamp")]
    });
  }
  // Newest first
  result.sort(function (a, b) {
    return String(b.addedAt).localeCompare(String(a.addedAt));
  });
  return result;
}

/**
 * Mod-only: returns all clips (same shape as public, but mod use case).
 */
function listAllClips() {
  return getPublicClips();
}

/* ════════════════════ SPONSORS ════════════════════ */

/**
 * Returns all ACTIVE sponsors, sorted by tier then display order.
 * Public — no auth. Used by the /sponsors page and the site footer.
 */
function getSponsors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SPONSORS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return SPONSORS_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colIndex("Sponsor Name")]) continue;
    // Only active sponsors are exposed publicly
    if (String(row[colIndex("Active")]).toLowerCase() !== "yes") continue;
    result.push({
      name: String(row[colIndex("Sponsor Name")]),
      tier: String(row[colIndex("Tier")] || "partner").toLowerCase(),
      logoUrl: String(row[colIndex("Logo URL")] || ""),
      websiteUrl: String(row[colIndex("Website URL")] || ""),
      description: String(row[colIndex("Description")] || ""),
      promoCode: String(row[colIndex("Promo Code")] || ""),
      promoDetails: String(row[colIndex("Promo Details")] || ""),
      displayOrder: Number(row[colIndex("Display Order")]) || 999
    });
  }
  // Sort: title tier first, then partner; within tier by display order
  const tierRank = function (tier) {
    if (tier === "title") return 0;
    return 1;
  };
  result.sort(function (a, b) {
    const tr = tierRank(a.tier) - tierRank(b.tier);
    if (tr !== 0) return tr;
    return a.displayOrder - b.displayOrder;
  });
  return result;
}

/**
 * Accepts a "Become a Sponsor" inquiry from the public /sponsors page.
 * Writes a row to the SponsorInquiries tab and emails the tournament
 * organizer. Turnstile-verified upstream by the Vercel endpoint, so we
 * don't re-check the captcha here.
 *
 * Expected data shape:
 *   {
 *     action: "submitSponsorInquiry",
 *     name: "...",
 *     email: "...",
 *     company: "...",
 *     interest: "...",        // tier they're interested in
 *     budget: "...",
 *     message: "..."
 *   }
 */
function submitSponsorInquiry(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    if (!name || !email) {
      return { ok: false, error: "Name and email are required." };
    }
    // Light email sanity check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: "Please provide a valid email address." };
    }

    const sheet = getOrCreateSheet(
      SPONSOR_INQUIRIES_SHEET,
      SPONSOR_INQUIRIES_HEADERS
    );
    sheet.appendRow([
      new Date(),
      name,
      email,
      String(data.company || ""),
      String(data.interest || ""),
      String(data.budget || ""),
      String(data.message || ""),
      "new",
      ""
    ]);

    // Fire a notification email to the organizer. Wrapped in its own
    // try/catch so an email failure never blocks the inquiry from saving.
    try {
      const recipient = "chicken@blueberrynetwork.org";
      const subject = "New sponsor inquiry — Lattice Open";
      const body =
        "A new sponsorship inquiry just came in.\n\n" +
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        "Company: " + String(data.company || "(not given)") + "\n" +
        "Interest: " + String(data.interest || "(not given)") + "\n" +
        "Budget: " + String(data.budget || "(not given)") + "\n\n" +
        "Message:\n" + String(data.message || "(no message)") + "\n\n" +
        "—\nReview inquiries in the SponsorInquiries tab of the " +
        "registration sheet.";
      MailApp.sendEmail(recipient, subject, body);
    } catch (mailErr) {
      Logger.log("Sponsor inquiry email failed: " + mailErr.toString());
    }

    // Discord webhook (separate from email — fires regardless of email status)
    try {
      notifyDiscordSponsorInquiry(data);
    } catch (notifyErr) {
      Logger.log("Discord notify failed: " + notifyErr.toString());
    }

    return {
      ok: true,
      message: "Inquiry received. We'll be in touch soon."
    };
  } catch (err) {
    Logger.log("submitSponsorInquiry error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/* ════════════════════ SPONSORS — ADMIN ════════════════════ */

/**
 * Returns ALL sponsors (active and inactive), each tagged with its sheet
 * row number as `id` so the admin UI can target specific rows for edits.
 * Mod-gated upstream.
 */
function listAllSponsors() {
  const sheet = getOrCreateSheet(SPONSORS_SHEET, SPONSORS_HEADERS);
  if (sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return SPONSORS_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colIndex("Sponsor Name")]) continue;
    result.push({
      id: i + 1, // 1-based sheet row number
      name: String(row[colIndex("Sponsor Name")]),
      tier: String(row[colIndex("Tier")] || "partner").toLowerCase(),
      logoUrl: String(row[colIndex("Logo URL")] || ""),
      websiteUrl: String(row[colIndex("Website URL")] || ""),
      description: String(row[colIndex("Description")] || ""),
      promoCode: String(row[colIndex("Promo Code")] || ""),
      promoDetails: String(row[colIndex("Promo Details")] || ""),
      displayOrder: Number(row[colIndex("Display Order")]) || 999,
      active: String(row[colIndex("Active")]).toLowerCase() === "yes"
    });
  }
  return result;
}

/**
 * Appends a new sponsor row.
 *
 * Expected data shape:
 *   {
 *     action: "addSponsor", adminSecret: "...",
 *     name, tier, logoUrl, websiteUrl, description,
 *     promoCode, promoDetails, displayOrder, active,
 *     addedBy
 *   }
 */
function addSponsor(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const name = String(data.name || "").trim();
    if (!name) {
      return { ok: false, error: "Sponsor name is required." };
    }
    const tier = String(data.tier || "partner").toLowerCase();
    if (tier !== "title" && tier !== "partner") {
      return { ok: false, error: "Tier must be 'title' or 'partner'." };
    }
    const sheet = getOrCreateSheet(SPONSORS_SHEET, SPONSORS_HEADERS);
    sheet.appendRow([
      new Date(),
      name,
      tier,
      String(data.logoUrl || ""),
      String(data.websiteUrl || ""),
      String(data.description || ""),
      String(data.promoCode || ""),
      String(data.promoDetails || ""),
      Number(data.displayOrder) || 1,
      data.active === false ? "No" : "Yes",
      String(data.addedBy || ""),
      new Date()
    ]);
    return { ok: true, message: "Sponsor added." };
  } catch (err) {
    Logger.log("addSponsor error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates an existing sponsor row, or deletes it.
 *
 * Expected data shape:
 *   {
 *     action: "updateSponsor", adminSecret: "...",
 *     id: <row number>,
 *     op: "edit" | "delete" | "toggleActive",
 *     // for "edit", also: name, tier, logoUrl, websiteUrl, description,
 *     //                   promoCode, promoDetails, displayOrder, active
 *   }
 */
function updateSponsor(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rowNum = Number(data.id);
    if (!rowNum || rowNum < 2) {
      return { ok: false, error: "Valid sponsor id is required." };
    }
    const sheet = getOrCreateSheet(SPONSORS_SHEET, SPONSORS_HEADERS);
    if (rowNum > sheet.getLastRow()) {
      return { ok: false, error: "Sponsor not found." };
    }
    const colIndex = function (name) {
      return SPONSORS_HEADERS.indexOf(name) + 1; // 1-based column
    };
    const op = String(data.op || "edit");

    if (op === "delete") {
      sheet.deleteRow(rowNum);
      return { ok: true, message: "Sponsor deleted." };
    }

    if (op === "toggleActive") {
      const cell = sheet.getRange(rowNum, colIndex("Active"));
      const current = String(cell.getValue()).toLowerCase() === "yes";
      cell.setValue(current ? "No" : "Yes");
      return {
        ok: true,
        message: current ? "Sponsor hidden." : "Sponsor shown."
      };
    }

    // op === "edit" — overwrite all editable fields
    const name = String(data.name || "").trim();
    if (!name) {
      return { ok: false, error: "Sponsor name is required." };
    }
    const tier = String(data.tier || "partner").toLowerCase();
    if (tier !== "title" && tier !== "partner") {
      return { ok: false, error: "Tier must be 'title' or 'partner'." };
    }
    sheet.getRange(rowNum, colIndex("Sponsor Name")).setValue(name);
    sheet.getRange(rowNum, colIndex("Tier")).setValue(tier);
    sheet.getRange(rowNum, colIndex("Logo URL")).setValue(String(data.logoUrl || ""));
    sheet.getRange(rowNum, colIndex("Website URL")).setValue(String(data.websiteUrl || ""));
    sheet.getRange(rowNum, colIndex("Description")).setValue(String(data.description || ""));
    sheet.getRange(rowNum, colIndex("Promo Code")).setValue(String(data.promoCode || ""));
    sheet.getRange(rowNum, colIndex("Promo Details")).setValue(String(data.promoDetails || ""));
    sheet.getRange(rowNum, colIndex("Display Order")).setValue(Number(data.displayOrder) || 1);
    sheet.getRange(rowNum, colIndex("Active")).setValue(data.active === false ? "No" : "Yes");
    return { ok: true, message: "Sponsor updated." };
  } catch (err) {
    Logger.log("updateSponsor error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns all sponsor inquiries, each tagged with its sheet row number
 * as `id`. Newest first. Mod-gated upstream.
 */
function listSponsorInquiries() {
  const sheet = getOrCreateSheet(
    SPONSOR_INQUIRIES_SHEET,
    SPONSOR_INQUIRIES_HEADERS
  );
  if (sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const colIndex = function (name) {
    return SPONSOR_INQUIRIES_HEADERS.indexOf(name);
  };
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colIndex("Email")]) continue;
    const ts = row[colIndex("Timestamp")];
    result.push({
      id: i + 1,
      timestamp:
        ts instanceof Date ? ts.toISOString() : String(ts || ""),
      name: String(row[colIndex("Name")] || ""),
      email: String(row[colIndex("Email")] || ""),
      company: String(row[colIndex("Company")] || ""),
      interest: String(row[colIndex("Sponsorship Interest")] || ""),
      budget: String(row[colIndex("Budget Range")] || ""),
      message: String(row[colIndex("Message")] || ""),
      status: String(row[colIndex("Status")] || "new").toLowerCase(),
      notes: String(row[colIndex("Notes")] || "")
    });
  }
  result.reverse(); // newest first
  return result;
}

/**
 * Updates an inquiry's status (and optionally notes).
 *
 * Expected data shape:
 *   {
 *     action: "updateInquiryStatus", adminSecret: "...",
 *     id: <row number>,
 *     status: "new" | "contacted" | "won" | "lost",
 *     notes: "..."  // optional
 *   }
 */
function updateInquiryStatus(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rowNum = Number(data.id);
    if (!rowNum || rowNum < 2) {
      return { ok: false, error: "Valid inquiry id is required." };
    }
    const validStatuses = ["new", "contacted", "won", "lost"];
    const status = String(data.status || "").toLowerCase();
    if (validStatuses.indexOf(status) === -1) {
      return { ok: false, error: "Invalid status." };
    }
    const sheet = getOrCreateSheet(
      SPONSOR_INQUIRIES_SHEET,
      SPONSOR_INQUIRIES_HEADERS
    );
    if (rowNum > sheet.getLastRow()) {
      return { ok: false, error: "Inquiry not found." };
    }
    const colIndex = function (name) {
      return SPONSOR_INQUIRIES_HEADERS.indexOf(name) + 1;
    };
    sheet.getRange(rowNum, colIndex("Status")).setValue(status);
    if (typeof data.notes === "string") {
      sheet.getRange(rowNum, colIndex("Notes")).setValue(data.notes);
    }
    return { ok: true, message: "Inquiry updated." };
  } catch (err) {
    Logger.log("updateInquiryStatus error: " + err.toString());
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}


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

/* ════════════════════ DISCORD WEBHOOKS ════════════════════ */

/**
 * Posts an "embed" message to one of our Discord webhook URLs.
 *
 * Configured via Script Properties:
 *   DISCORD_MOD_WEBHOOK_URL     — channel where mods get notified
 *   DISCORD_PUBLIC_WEBHOOK_URL  — public channel for fan updates
 *   DISCORD_MOD_ROLE_ID         — role to ping in mod notifications (optional)
 *
 * If the relevant URL is missing, silently does nothing — registrations and
 * other operations are NEVER broken by a missing or failing Discord webhook.
 *
 * @param {"mod"|"public"} channel  Which webhook to use
 * @param {string} title            Embed title (e.g. "New Registration")
 * @param {string} description      Embed body text
 * @param {Array<{name:string,value:string,inline?:boolean}>} fields  Optional structured fields
 * @param {number} color            Decimal color (0xfacc15 = yellow). Defaults to yellow.
 * @param {boolean} pingMods        If true and channel="mod", prepends a role mention
 */
function postDiscordEmbed(channel, title, description, fields, color, pingMods) {
  try {
    const props = PropertiesService.getScriptProperties();
    const urlKey =
      channel === "mod" ? "DISCORD_MOD_WEBHOOK_URL" : "DISCORD_PUBLIC_WEBHOOK_URL";
    const webhookUrl = props.getProperty(urlKey);
    if (!webhookUrl) {
      // Silent skip — Discord integration is optional
      return;
    }

    const embedColor = typeof color === "number" ? color : 0xfacc15; // yellow default
    const safeFields = Array.isArray(fields) ? fields.slice(0, 25) : [];

    // Optional role ping for mod-channel notifications
    let content = "";
    if (pingMods && channel === "mod") {
      const roleId = props.getProperty("DISCORD_MOD_ROLE_ID");
      if (roleId) {
        content = "<@&" + roleId + ">";
      }
    }

    const payload = {
      content: content,
      embeds: [
        {
          title: String(title || "").slice(0, 256),
          description: String(description || "").slice(0, 4000),
          color: embedColor,
          fields: safeFields.map(function (f) {
            return {
              name: String(f.name || "").slice(0, 256),
              value: String(f.value || "—").slice(0, 1024),
              inline: !!f.inline
            };
          }),
          timestamp: new Date().toISOString(),
          footer: { text: "Lattice Open" }
        }
      ]
    };
    if (pingMods && content) {
      // Only allow the mod role to be pinged — don't allow @everyone etc.
      const roleId = props.getProperty("DISCORD_MOD_ROLE_ID");
      if (roleId) {
        payload.allowed_mentions = { roles: [roleId] };
      }
    }

    UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    // Webhooks must NEVER break the actual operation.
    Logger.log("Discord webhook failed: " + err.toString());
  }
}

/**
 * Convenience wrappers for the events we care about.
 * Each wraps postDiscordEmbed with the right title/color/fields for that event.
 */

function notifyDiscordRegistration(data) {
  const fields = [
    { name: "Captain", value: String(data.discordUsername || "—"), inline: true },
    { name: "Team Type", value: String(data.teamType || "—"), inline: true },
    { name: "IGN", value: String(data.ign || "—"), inline: true },
    { name: "Rank", value: String(data.rank || "—"), inline: true },
    { name: "Servers", value: String(data.servers || "—"), inline: true },
    { name: "Streamer?", value: data.isStreamer ? "Yes" : "No", inline: true }
  ];
  if (data.teamName) {
    fields.push({ name: "Team Name", value: String(data.teamName), inline: false });
  }
  postDiscordEmbed(
    "mod",
    "🎮 New Tournament Registration",
    String(data.fullName || "A new player") + " just registered.",
    fields,
    0x10b981, // green
    true // ping mods
  );
}

function notifyDiscordSponsorInquiry(data) {
  const fields = [
    { name: "Name", value: String(data.name || "—"), inline: true },
    { name: "Email", value: String(data.email || "—"), inline: true },
    { name: "Company", value: String(data.company || "—") || "(not given)", inline: true },
    { name: "Interest", value: String(data.interest || "—"), inline: true },
    { name: "Budget", value: String(data.budget || "—") || "(not given)", inline: true }
  ];
  if (data.message) {
    fields.push({ name: "Message", value: String(data.message).slice(0, 1024), inline: false });
  }
  postDiscordEmbed(
    "mod",
    "💼 New Sponsor Inquiry",
    "A potential sponsor just reached out.",
    fields,
    0xfacc15, // yellow
    true // ping mods — inquiries are leads worth jumping on
  );
}

function notifyDiscordStreamerApplication(data) {
  const fields = [
    { name: "Streamer", value: String(data.streamerName || "—"), inline: true },
    { name: "Discord", value: "@" + String(data.discordUsername || "—"), inline: true },
    { name: "Twitch", value: String(data.twitchUrl || "—"), inline: false },
    { name: "Family Friendly", value: data.familyFriendly ? "Yes" : "No", inline: true }
  ];
  postDiscordEmbed(
    "mod",
    "📺 New Streamer Application",
    "Awaiting mod approval — review at /admin → Streamer Hub.",
    fields,
    0xa855f7, // purple
    true // ping mods
  );
}

function notifyDiscordBracketInitialized(teamCount) {
  postDiscordEmbed(
    "public",
    "⚡ Bracket Locked In",
    "The Lattice Open bracket has been initialized with " +
      String(teamCount) +
      " teams. The tournament is about to begin!",
    [],
    0xfacc15,
    false
  );
}

function notifyDiscordMatchResult(match) {
  if (!match || !match.winner_id) return;
  const winnerLabel =
    match.winner_id === match.team_a_id ? match.team_a_label : match.team_b_label;
  const loserLabel =
    match.winner_id === match.team_a_id ? match.team_b_label : match.team_a_label;

  // Special-case the championship match — bigger announcement
  if (match.feeds_winner_to === "CHAMPION") {
    postDiscordEmbed(
      "public",
      "🏆 CHAMPION CROWNED",
      "**" + String(winnerLabel) + "** has won the Lattice Open!",
      [
        {
          name: "Final Match",
          value:
            String(winnerLabel) +
            " def. " +
            String(loserLabel) +
            (match.team_a_score !== "" && match.team_b_score !== ""
              ? "  (" +
                String(match.team_a_score) +
                "–" +
                String(match.team_b_score) +
                ")"
              : ""),
          inline: false
        }
      ],
      0xef4444, // red — drama
      false
    );
    return;
  }

  // Regular completed match
  let scoreText = "";
  if (
    match.team_a_score !== "" &&
    match.team_b_score !== "" &&
    match.team_a_score !== null &&
    match.team_b_score !== null
  ) {
    const wScore =
      match.winner_id === match.team_a_id ? match.team_a_score : match.team_b_score;
    const lScore =
      match.winner_id === match.team_a_id ? match.team_b_score : match.team_a_score;
    scoreText = " " + String(wScore) + "–" + String(lScore);
  }
  postDiscordEmbed(
    "public",
    "✅ Match Result · " + String(match.match_id),
    "**" +
      String(winnerLabel) +
      "** def. " +
      String(loserLabel) +
      scoreText,
    [],
    0x10b981, // green
    false
  );
}

function notifyDiscordMatchLive(match, streamUrl) {
  if (!match || !streamUrl) return;
  postDiscordEmbed(
    "public",
    "🔴 LIVE NOW · " + String(match.match_id),
    "**" +
      String(match.team_a_label) +
      "** vs **" +
      String(match.team_b_label) +
      "**\n\n[Watch the stream →](" +
      String(streamUrl) +
      ")",
    [],
    0xef4444, // red
    false
  );
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
