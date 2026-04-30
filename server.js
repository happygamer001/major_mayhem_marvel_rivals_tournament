/**
 * Lattice Open Tournament — Backend skeleton
 * -------------------------------------------
 * Minimal Express server that pairs with lattice-tournament.jsx
 *
 * Routes:
 *   POST /api/register          → validates + persists a registration
 *   POST /api/paypal/create     → creates a PayPal order (PLACEHOLDER)
 *   POST /api/paypal/capture    → captures a PayPal order (PLACEHOLDER)
 *   GET  /api/registrations     → admin list (lock this down before prod)
 *   GET  /api/health            → liveness check
 *
 * Storage: flat-file JSON at ./data/registrations.json.
 * Swap for Postgres / Mongo / Firestore once you pick a real DB.
 *
 * Install:
 *   npm init -y
 *   npm install express cors dotenv
 *   # for real PayPal later: npm install @paypal/checkout-server-sdk
 *
 * Run:
 *   node server.js
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "registrations.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]");

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));

/* ────────── helpers ────────── */

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

/**
 * Validates a registration payload from the React client.
 * Returns { ok: true } or { ok: false, error: "..." }
 */
function validateRegistration(body) {
  const required = ["fullName", "discordName", "ign", "rank", "teamType"];
  for (const f of required) {
    if (!body[f] || typeof body[f] !== "string" || !body[f].trim()) {
      return { ok: false, error: `Missing or invalid field: ${f}` };
    }
  }
  if (!Array.isArray(body.servers) || body.servers.length === 0) {
    return { ok: false, error: "At least one server must be selected." };
  }
  if (!["solo", "partial", "full"].includes(body.teamType)) {
    return { ok: false, error: "teamType must be solo | partial | full." };
  }
  if (!body.agreedDiscordTOS || !body.agreedTournamentTOS || !body.agreedBroadcastTOS) {
    return { ok: false, error: "All required TOS must be agreed to." };
  }
  if (body.teamType !== "full" && !body.agreedRPMA) {
    return {
      ok: false,
      error: "Solo/partial registrations must agree to the RPMA.",
    };
  }
  if (body.teamType === "full") {
    if (!body.confirmedCaptain || !body.acknowledgedCaptainResponsibility) {
      return { ok: false, error: "Full teams must confirm captain responsibility." };
    }
    if (!body.teamName || body.teamName.trim().length < 2) {
      return { ok: false, error: "Team name is required for full teams." };
    }
  }
  return { ok: true };
}

/* ────────── routes ────────── */

app.get("/api/health", (_, res) => res.json({ ok: true, ts: Date.now() }));

app.post("/api/register", (req, res) => {
  const v = validateRegistration(req.body);
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

  const id = crypto.randomUUID();
  const record = {
    id,
    createdAt: new Date().toISOString(),
    paymentStatus: "pending",
    teamNameApprovalStatus:
      req.body.teamType === "full" ? "pending_review" : "n/a",
    ...req.body,
  };

  const db = readDB();
  db.push(record);
  writeDB(db);

  // TODO: trigger Discord webhook → notify mods of new registration
  // TODO: send email confirmation via SendGrid / Resend

  res.json({ ok: true, id, registration: record });
});

app.get("/api/registrations", (req, res) => {
  // TODO: protect this route with admin auth (JWT, basic auth, etc.)
  res.json({ ok: true, registrations: readDB() });
});

/* ────────── PayPal placeholders ────────── */

/**
 * Create a PayPal order for a given registration.
 * Replace the body of this with the official PayPal SDK call:
 *
 *   const paypal = require("@paypal/checkout-server-sdk");
 *   const env = new paypal.core.SandboxEnvironment(CLIENT_ID, SECRET);
 *   const client = new paypal.core.PayPalHttpClient(env);
 *   const request = new paypal.orders.OrdersCreateRequest();
 *   request.prefer("return=representation");
 *   request.requestBody({
 *     intent: "CAPTURE",
 *     purchase_units: [{ amount: { currency_code: "USD", value: "30.00" } }],
 *   });
 *   const order = await client.execute(request);
 *   res.json({ ok: true, orderId: order.result.id });
 */
app.post("/api/paypal/create", (req, res) => {
  const { registrationId } = req.body || {};
  if (!registrationId) {
    return res.status(400).json({ ok: false, error: "registrationId required" });
  }
  const db = readDB();
  const reg = db.find((r) => r.id === registrationId);
  if (!reg) return res.status(404).json({ ok: false, error: "Registration not found." });

  const fakeOrderId = `STUB-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  res.json({
    ok: true,
    orderId: fakeOrderId,
    note: "STUB — replace with @paypal/checkout-server-sdk OrdersCreateRequest",
  });
});

/**
 * Capture a PayPal order after the buyer approves it.
 * Real impl: client.execute(new paypal.orders.OrdersCaptureRequest(orderId))
 */
app.post("/api/paypal/capture", (req, res) => {
  const { registrationId, orderId } = req.body || {};
  if (!registrationId || !orderId) {
    return res
      .status(400)
      .json({ ok: false, error: "registrationId and orderId required" });
  }
  const db = readDB();
  const reg = db.find((r) => r.id === registrationId);
  if (!reg) return res.status(404).json({ ok: false, error: "Registration not found." });

  reg.paymentStatus = "paid";
  reg.paypalOrderId = orderId;
  reg.paidAt = new Date().toISOString();
  writeDB(db);

  res.json({ ok: true, registration: reg });
});

/* ────────── start ────────── */

app.listen(PORT, () => {
  console.log(`▸ Lattice Open backend listening on http://localhost:${PORT}`);
  console.log(`▸ Registrations stored at: ${DB_FILE}`);
});
